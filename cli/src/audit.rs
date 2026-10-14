use crate::config::{dependencies, load_imp_config};
use crate::dependency_manifest::{DEPENDENCY_MANIFEST_FILE, read_dependency_manifest};
use crate::license_policy::package_id;
use crate::logger;
use crate::paths::{absolute, cwd, file_name, relative_posix};
use crate::specifiers::parse_specifier;
use crate::version::{VERSION, is_newer};
use anyhow::{Result, anyhow, bail};
use base64::Engine;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::time::Duration;

const OSV_API: &str = "https://api.osv.dev/v1";
const OSV_BATCH_SIZE: usize = 1000;
const OSV_LINK: &str = "https://osv.dev/vulnerability/";
const OSV_ATTEMPTS: u32 = 4;
const OSV_FIRST_BACKOFF_MS: u64 = 1000;
const OSV_LONGEST_WAIT_MS: u64 = 60000;
const OSV_TIMEOUT: Duration = Duration::from_secs(60);

pub const AUDIT_VULNERABLE: i32 = 1;
pub const AUDIT_INCOMPLETE: i32 = 2;
pub const SBOM_FILE: &str = "sbom.cdx.json";
const CYCLONEDX_VERSION: &str = "1.7";

pub struct OsvAnswer {
    pub status: u16,
    pub body: Vec<u8>,
    pub retry_after: Option<String>,
}

pub trait OsvTransport {
    fn send(&self, url: &str, body: Option<&Value>) -> Result<OsvAnswer>;
    fn sleep(&self, ms: u64);
}

struct Network;

impl OsvTransport for Network {
    fn send(&self, url: &str, body: Option<&Value>) -> Result<OsvAnswer> {
        let fetched = match body {
            Some(body) => crate::http_client::post_json(url, body, Some(OSV_TIMEOUT))?,
            None => crate::http_client::get(url, &[], Some(OSV_TIMEOUT))?,
        };
        Ok(OsvAnswer {
            status: fetched.status,
            body: fetched.body,
            retry_after: fetched.retry_after,
        })
    }

    fn sleep(&self, ms: u64) {
        std::thread::sleep(Duration::from_millis(ms));
    }
}

fn str_of<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or("")
}

fn read_manifests(root: &Path, aliases: &[String]) -> Result<Vec<Value>> {
    let mut manifests = Vec::new();
    let mut missing = Vec::new();
    for alias in aliases {
        let Some(manifest) = read_dependency_manifest(root, alias)? else {
            missing.push(alias.clone());
            continue;
        };
        if !manifest.get("packages").is_some_and(Value::is_array) {
            bail!("invalid dependencies/{alias}/{DEPENDENCY_MANIFEST_FILE} - it lists no packages");
        }
        manifests.push(manifest);
    }
    if !missing.is_empty() {
        let one = missing.len() == 1;
        bail!(
            "no {DEPENDENCY_MANIFEST_FILE} for {} - imp has no record of what {}, so it cannot check {}; run 'imp install' to record {}",
            missing.join(", "),
            if one {
                "that dependency bundles"
            } else {
                "those dependencies bundle"
            },
            if one { "it" } else { "them" },
            if one { "it" } else { "them" }
        );
    }
    Ok(manifests)
}

pub fn audited_packages(manifests: &[Value]) -> Vec<Value> {
    let mut packages: BTreeMap<String, Value> = BTreeMap::new();
    for manifest in manifests {
        for entry in manifest["packages"].as_array().into_iter().flatten() {
            let id = format!("{}:{}", str_of(entry, "registry"), package_id(entry));
            let package = packages.entry(id).or_insert_with(|| {
                let mut copy = entry.clone();
                copy["aliases"] = json!([]);
                copy
            });
            if let Some(aliases) = package["aliases"].as_array_mut() {
                aliases.push(manifest["alias"].clone());
            }
        }
    }
    let mut list: Vec<Value> = packages.into_values().collect();
    list.sort_by_key(package_id);
    list
}

pub fn osv_query(entry: &Value) -> Value {
    json!({ "package": { "name": str_of(entry, "name"), "ecosystem": "npm" }, "version": str_of(entry, "version") })
}

fn is_retryable(status: u16) -> bool {
    status == 429 || status >= 500
}

pub fn retry_delay(retry_after: Option<&str>, attempt: u32, now_millis: u128) -> u64 {
    let header = retry_after.map(str::trim).unwrap_or("");
    let requested: Option<i128> =
        if !header.is_empty() && header.bytes().all(|byte| byte.is_ascii_digit()) {
            header.parse::<i128>().ok().map(|seconds| seconds * 1000)
        } else {
            crate::time::parse_http_date(header).map(|at| at as i128 - now_millis as i128)
        };
    let delay = requested.unwrap_or((OSV_FIRST_BACKOFF_MS * 2u64.pow(attempt)) as i128);
    delay.clamp(0, OSV_LONGEST_WAIT_MS as i128) as u64
}

pub fn osv_request(osv: &dyn OsvTransport, path: &str, body: Option<&Value>) -> Result<Value> {
    let url = format!("{OSV_API}{path}");
    let mut attempt = 1;
    loop {
        let answer = osv.send(&url, body)?;
        if (200..300).contains(&answer.status) {
            return Ok(serde_json::from_slice(&answer.body)?);
        }
        if !is_retryable(answer.status) || attempt == OSV_ATTEMPTS {
            bail!(
                "the OSV database did not answer - {url} responded {}",
                answer.status
            );
        }
        osv.sleep(retry_delay(
            answer.retry_after.as_deref(),
            attempt - 1,
            crate::time::now_millis(),
        ));
        attempt += 1;
    }
}

pub fn known_vulnerability_ids(
    packages: &[Value],
    osv: &dyn OsvTransport,
) -> Result<Vec<Vec<String>>> {
    let mut ids: Vec<Vec<String>> = vec![Vec::new(); packages.len()];
    let mut pending: Vec<(usize, Value)> = packages
        .iter()
        .enumerate()
        .map(|(index, entry)| (index, osv_query(entry)))
        .collect();
    while !pending.is_empty() {
        let mut next = Vec::new();
        for batch in pending.chunks(OSV_BATCH_SIZE) {
            let queries: Vec<Value> = batch.iter().map(|(_, query)| query.clone()).collect();
            let answer = osv_request(osv, "/querybatch", Some(&json!({ "queries": queries })))?;
            let results = answer["results"]
                .as_array()
                .filter(|results| results.len() == batch.len());
            let Some(results) = results else {
                bail!(
                    "the OSV database answered {} queries with {} results",
                    batch.len(),
                    answer["results"].as_array().map(Vec::len).unwrap_or(0)
                );
            };
            for ((index, query), result) in batch.iter().zip(results) {
                for vulnerability in result["vulns"].as_array().into_iter().flatten() {
                    ids[*index].push(str_of(vulnerability, "id").to_string());
                }
                let Some(token) = result["next_page_token"]
                    .as_str()
                    .filter(|token| !token.is_empty())
                else {
                    continue;
                };
                if query["page_token"].as_str() == Some(token) {
                    bail!("the OSV database returned the same page token twice");
                }
                let mut query = query.clone();
                query["page_token"] = Value::from(token);
                next.push((*index, query));
            }
        }
        pending = next;
    }
    Ok(ids)
}

pub fn fixed_version(vulnerability: &Value, entry: &Value) -> Option<String> {
    let name = str_of(entry, "name");
    let version = str_of(entry, "version");
    let mut fixes: Vec<String> = Vec::new();
    for affected in vulnerability["affected"].as_array().into_iter().flatten() {
        if str_of(&affected["package"], "ecosystem") != "npm"
            || str_of(&affected["package"], "name") != name
        {
            continue;
        }
        for range in affected["ranges"].as_array().into_iter().flatten() {
            for event in range["events"].as_array().into_iter().flatten() {
                if let Some(fixed) = event["fixed"].as_str()
                    && is_newer(fixed, version)
                {
                    fixes.push(fixed.to_string());
                }
            }
        }
    }
    fixes.sort_by(|a, b| {
        if is_newer(a, b) {
            std::cmp::Ordering::Greater
        } else if is_newer(b, a) {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Equal
        }
    });
    fixes.into_iter().next()
}

pub struct Vulnerability {
    pub id: String,
    pub severity: Option<String>,
    pub summary: String,
    pub fixed: Option<String>,
}

pub fn describe_vulnerability(vulnerability: &Value, entry: &Value) -> Vulnerability {
    let summary = vulnerability["summary"]
        .as_str()
        .map(str::to_string)
        .or_else(|| {
            vulnerability["details"]
                .as_str()
                .map(|details| details.split('\n').next().unwrap_or("").to_string())
        })
        .unwrap_or_default();
    Vulnerability {
        id: str_of(vulnerability, "id").to_string(),
        severity: vulnerability["database_specific"]["severity"]
            .as_str()
            .map(str::to_string),
        summary: summary.trim().to_string(),
        fixed: fixed_version(vulnerability, entry),
    }
}

pub fn audit_report(
    checked: &[(Value, Vec<Vulnerability>)],
    unchecked: &[Value],
) -> (String, bool) {
    let mut lines = Vec::new();
    let affected: Vec<&(Value, Vec<Vulnerability>)> = checked
        .iter()
        .filter(|(_, vulnerabilities)| !vulnerabilities.is_empty())
        .collect();
    for (entry, vulnerabilities) in &affected {
        let aliases: Vec<&str> = entry["aliases"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .collect();
        lines.push(format!("{} (in {})", package_id(entry), aliases.join(", ")));
        for vulnerability in vulnerabilities {
            let severity = vulnerability
                .severity
                .as_ref()
                .map(|severity| format!(" {severity}"))
                .unwrap_or_default();
            let fix = match &vulnerability.fixed {
                Some(fixed) => format!(" - fixed in {fixed}"),
                None => " - no fix yet".into(),
            };
            lines.push(format!(
                "  {}{severity} {}{fix}",
                vulnerability.id, vulnerability.summary
            ));
            lines.push(format!("    {OSV_LINK}{}", vulnerability.id));
        }
    }
    let count: usize = affected
        .iter()
        .map(|(_, vulnerabilities)| vulnerabilities.len())
        .sum();
    let packages =
        |number: usize| format!("{number} npm package{}", if number == 1 { "" } else { "s" });
    if count > 0 {
        let found = if count == 1 {
            "1 known vulnerability".to_string()
        } else {
            format!("{count} known vulnerabilities")
        };
        lines.push(format!(
            "{found} in {}, of {} checked",
            packages(affected.len()),
            checked.len()
        ));
    } else if !checked.is_empty() {
        lines.push(format!(
            "no known vulnerabilities in {}",
            packages(checked.len())
        ));
    } else {
        lines.push("no npm packages to check".into());
    }
    if !unchecked.is_empty() {
        let names: Vec<String> = unchecked.iter().map(package_id).collect();
        lines.push(format!(
            "not checked: {} - the OSV database has no records for jsr packages",
            names.join(", ")
        ));
    }
    (lines.join("\n"), count > 0)
}

pub fn check_vulnerabilities(packages: &[Value], osv: &dyn OsvTransport) -> Result<(String, bool)> {
    let (npm, unchecked): (Vec<Value>, Vec<Value>) = packages
        .iter()
        .cloned()
        .partition(|entry| str_of(entry, "registry") == "npm");
    let ids = known_vulnerability_ids(&npm, osv)?;
    let unique: BTreeSet<&String> = ids.iter().flatten().collect();
    let mut details = BTreeMap::new();
    for id in unique {
        let path = format!("/vulns/{}", crate::service_worker::encode_uri_component(id));
        details.insert(id.clone(), osv_request(osv, &path, None)?);
    }
    let checked: Vec<(Value, Vec<Vulnerability>)> = npm
        .iter()
        .zip(&ids)
        .map(|(entry, ids)| {
            (
                entry.clone(),
                ids.iter()
                    .map(|id| describe_vulnerability(&details[id], entry))
                    .collect(),
            )
        })
        .collect();
    Ok(audit_report(&checked, &unchecked))
}

fn component_hashes(integrity: &str) -> Vec<Value> {
    let Some((algorithm, digest)) = integrity.split_once('-') else {
        return Vec::new();
    };
    let alg = match algorithm {
        "sha512" => "SHA-512",
        "sha384" => "SHA-384",
        "sha256" => "SHA-256",
        "sha1" => "SHA-1",
        _ => return Vec::new(),
    };
    match base64::engine::general_purpose::STANDARD.decode(digest) {
        Ok(bytes) => vec![json!({ "alg": alg, "content": crate::http_client::hex(&bytes) })],
        Err(_) => Vec::new(),
    }
}

fn is_spdx_expression(license: &str) -> bool {
    let id = |part: &str| {
        let core = part.trim_start_matches('(').trim_end_matches(')');
        !core.is_empty()
            && core
                .chars()
                .all(|char| char.is_ascii_alphanumeric() || "_.+:-".contains(char))
    };
    let parts: Vec<&str> = license.split(' ').collect();
    parts.iter().enumerate().all(|(index, part)| {
        if index % 2 == 1 {
            matches!(*part, "AND" | "OR" | "WITH")
        } else {
            id(part)
        }
    }) && parts.len() % 2 == 1
}

fn component_licenses(license: &str) -> Vec<Value> {
    if is_spdx_expression(license) {
        vec![json!({ "expression": license })]
    } else {
        vec![json!({ "license": { "name": license } })]
    }
}

pub fn package_url(entry: &Value) -> Option<String> {
    if str_of(entry, "registry") != "npm" {
        return None;
    }
    let name = str_of(entry, "name");
    let name = name
        .strip_prefix('@')
        .map(|rest| format!("%40{rest}"))
        .unwrap_or_else(|| name.to_string());
    Some(format!("pkg:npm/{name}@{}", str_of(entry, "version")))
}

fn bom_ref(entry: &Value) -> String {
    package_url(entry)
        .unwrap_or_else(|| format!("{}:{}", str_of(entry, "registry"), package_id(entry)))
}

fn component(entry: &Value) -> Value {
    let mut component = serde_json::Map::new();
    component.insert("type".into(), "library".into());
    component.insert("bom-ref".into(), bom_ref(entry).into());
    component.insert("name".into(), str_of(entry, "name").into());
    component.insert("version".into(), str_of(entry, "version").into());
    if let Some(purl) = package_url(entry) {
        component.insert("purl".into(), purl.into());
    }
    if let Some(integrity) = entry["integrity"].as_str().filter(|text| !text.is_empty()) {
        component.insert("hashes".into(), component_hashes(integrity).into());
    }
    if let Some(license) = entry["license"].as_str().filter(|text| !text.is_empty()) {
        component.insert("licenses".into(), component_licenses(license).into());
    }
    let url = if str_of(entry, "registry") == "npm" {
        format!(
            "https://www.npmjs.com/package/{}/v/{}",
            str_of(entry, "name"),
            str_of(entry, "version")
        )
    } else {
        format!(
            "https://jsr.io/{}@{}",
            str_of(entry, "name"),
            str_of(entry, "version")
        )
    };
    component.insert(
        "externalReferences".into(),
        json!([{ "type": "distribution", "url": url }]),
    );
    Value::Object(component)
}

pub fn cyclonedx_bom(
    app_name: &str,
    manifests: &[Value],
    serial_number: &str,
    timestamp: &str,
) -> Value {
    let packages = audited_packages(manifests);
    let app_ref = format!("app:{app_name}");
    let direct: BTreeSet<String> = manifests
        .iter()
        .filter_map(|manifest| {
            let declared = parse_specifier(str_of(manifest, "specifier"))?;
            manifest["packages"]
                .as_array()?
                .iter()
                .find(|entry| {
                    Some(str_of(entry, "registry")) == declared.scheme.as_deref()
                        && str_of(entry, "name") == declared.name
                        && Some(str_of(entry, "version")) == declared.version.as_deref()
                })
                .map(bom_ref)
        })
        .collect();
    json!({
        "$schema": format!("http://cyclonedx.org/schema/bom-{CYCLONEDX_VERSION}.schema.json"),
        "bomFormat": "CycloneDX",
        "specVersion": CYCLONEDX_VERSION,
        "serialNumber": serial_number,
        "version": 1,
        "metadata": {
            "timestamp": timestamp,
            "tools": { "components": [{ "type": "application", "name": "imp", "version": VERSION }] },
            "component": { "type": "application", "bom-ref": app_ref, "name": app_name },
        },
        "components": packages.iter().map(component).collect::<Vec<_>>(),
        "dependencies": [{ "ref": app_ref, "dependsOn": direct.into_iter().collect::<Vec<_>>() }],
    })
}

fn random_uuid() -> Result<String> {
    use ring::rand::SecureRandom;
    let mut bytes = [0u8; 16];
    ring::rand::SystemRandom::new()
        .fill(&mut bytes)
        .map_err(|_| anyhow!("no random source"))?;
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex = crate::http_client::hex(&bytes);
    Ok(format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    ))
}

fn write_bom(root: &Path, manifests: &[Value], output: Option<&str>) -> Result<()> {
    let path = match output {
        Some(output) => absolute(output),
        None => root.join(SBOM_FILE),
    };
    let iso = crate::time::iso_string(crate::time::now_millis());
    let timestamp = match iso.rsplit_once('.') {
        Some((head, _)) => format!("{head}Z"),
        None => iso,
    };
    let bom = cyclonedx_bom(
        &file_name(root),
        manifests,
        &format!("urn:uuid:{}", random_uuid()?),
        &timestamp,
    );
    std::fs::write(&path, format!("{}\n", serde_json::to_string_pretty(&bom)?))?;
    let count = bom["components"].as_array().map(Vec::len).unwrap_or(0);
    println!(
        "wrote {} - CycloneDX {CYCLONEDX_VERSION}, {count} package{}",
        relative_posix(&cwd(), &path),
        if count == 1 { "" } else { "s" }
    );
    Ok(())
}

fn run(root: &Path, sbom: bool, output: Option<&str>) -> Result<i32> {
    let config = load_imp_config(root)?;
    let aliases: Vec<String> = dependencies(&config)
        .into_iter()
        .map(|(alias, _)| alias)
        .collect();
    if aliases.is_empty() {
        println!("nothing to audit - imp.json declares no dependencies, so imp vendors no package");
        return Ok(0);
    }
    let manifests = read_manifests(root, &aliases)?;
    if sbom {
        write_bom(root, &manifests, output)?;
        return Ok(0);
    }
    let (text, vulnerable) = check_vulnerabilities(&audited_packages(&manifests), &Network)?;
    println!("{text}");
    Ok(if vulnerable { AUDIT_VULNERABLE } else { 0 })
}

pub fn audit(root: &Path, sbom: bool, output: Option<String>) -> Result<i32> {
    match run(root, sbom, output.as_deref()) {
        Ok(code) => Ok(code),
        Err(error) => {
            logger::error(&format!("{error:#} - the audit did not complete"));
            Ok(AUDIT_INCOMPLETE)
        }
    }
}
