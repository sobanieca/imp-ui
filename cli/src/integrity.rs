use crate::dependency_manifest::PackageRecord;
use crate::http_client::get;
use crate::npm::{NPM_REGISTRY, matches_integrity, strongest_sri, tarball_files};
use anyhow::{Result, anyhow, bail};
use base64::Engine;
use serde_json::Value;

const NPM_SIGNING_KEYS: &str = "https://registry.npmjs.org/-/npm/v1/keys";
const JSR_API: &str = "https://api.jsr.io";

fn fetch_json(url: &str, what: &str) -> Result<Value> {
    let response = get(url, &[], None)?;
    if !response.ok() {
        bail!("could not read {what} - {url} responded {}", response.status);
    }
    response.json()
}

fn fetch_bytes(url: &str, what: &str) -> Result<Vec<u8>> {
    let response = get(url, &[], None)?;
    if !response.ok() {
        bail!("could not download {what} - {url} responded {}", response.status);
    }
    Ok(response.body)
}

pub fn bundled_file_problem(id: &str, tarball: &[(String, Vec<u8>)], bundled: &[(String, Vec<u8>)]) -> Option<String> {
    for (path, bytes) in bundled {
        match tarball.iter().find(|(name, _)| name == path) {
            None => return Some(format!("{id} bundled {path}, which the published package does not contain")),
            Some((_, published)) if published != bytes => {
                return Some(format!("{id} bundled a copy of {path} that differs from the published package"));
            }
            _ => {}
        }
    }
    None
}

fn spki_point(der: &[u8]) -> Option<&[u8]> {
    if der.len() < 65 {
        return None;
    }
    let point = &der[der.len() - 65..];
    (point[0] == 4).then_some(point)
}

fn signature_matches(key: &str, message: &str, signature: &str) -> bool {
    let engine = base64::engine::general_purpose::STANDARD;
    let (Ok(key), Ok(signature)) = (engine.decode(key), engine.decode(signature)) else { return false };
    let Some(point) = spki_point(&key) else { return false };
    let public_key = ring::signature::UnparsedPublicKey::new(&ring::signature::ECDSA_P256_SHA256_ASN1, point);
    public_key.verify(message.as_bytes(), &signature).is_ok()
}

fn parse_millis(text: &str) -> Option<u128> {
    let (date, time) = text.split_once('T')?;
    let mut parts = date.split('-').map(|part| part.parse::<i64>().ok());
    let (year, month, day) = (parts.next()??, parts.next()??, parts.next()??);
    let clock = time.trim_end_matches('Z');
    let (hms, millis) = clock.split_once('.').unwrap_or((clock, "0"));
    let mut fields = hms.split(':').map(|part| part.parse::<i64>().ok());
    let (hour, minute, second) = (fields.next()??, fields.next().flatten().unwrap_or(0), fields.next().flatten().unwrap_or(0));
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * ((month + 9) % 12) + 2) / 5 + day - 1;
    let days = era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468;
    let millis: String = millis.chars().take(3).collect();
    Some(((days * 86_400 + hour * 3600 + minute * 60 + second) * 1000) as u128 + millis.parse::<u128>().unwrap_or(0))
}

pub fn registry_signature_problem(
    name: &str,
    version: &str,
    integrity: &str,
    signatures: Option<&Value>,
    keys: &[Value],
    publish_time: &mut dyn FnMut() -> Option<String>,
) -> Option<String> {
    let id = format!("{name}@{version}");
    let signatures = signatures.and_then(Value::as_array).filter(|list| !list.is_empty());
    let Some(signatures) = signatures else { return Some(format!("{id} carries no signature of the npm registry")) };
    for signature in signatures {
        let keyid = signature.get("keyid").and_then(Value::as_str).unwrap_or("");
        let sig = signature.get("sig").and_then(Value::as_str).unwrap_or("");
        let Some(key) = keys.iter().find(|candidate| candidate.get("keyid").and_then(Value::as_str) == Some(keyid)) else {
            return Some(format!("{id} is signed with the key {keyid}, which the npm registry does not list"));
        };
        if let Some(expires) = key.get("expires").and_then(Value::as_str) {
            let Some(published) = publish_time() else {
                return Some(format!(
                    "{id} is signed with the key {keyid}, which expired on {expires}, and the npm registry gives no publish time for the version"
                ));
            };
            let before = match (parse_millis(&published), parse_millis(expires)) {
                (Some(published), Some(expires)) => published < expires,
                _ => false,
            };
            if !before {
                return Some(format!(
                    "{id} was published on {published}, after the key {keyid} that signs it expired on {expires}"
                ));
            }
        }
        let key_text = key.get("key").and_then(Value::as_str).unwrap_or("");
        if !signature_matches(key_text, &format!("{name}@{version}:{integrity}"), sig) {
            return Some(format!("{id} has a signature of the key {keyid} that does not match its name, version and hash"));
        }
    }
    None
}

fn verify_npm_package(record: &mut PackageRecord, keys: &mut Option<Vec<Value>>) -> Result<()> {
    let id = record.id();
    let metadata = fetch_json(
        &format!("{NPM_REGISTRY}/{}/{}", record.name.replacen('/', "%2F", 1), record.version),
        &format!("the metadata of {id}"),
    )?;
    let integrity = metadata.pointer("/dist/integrity").and_then(Value::as_str).unwrap_or("").to_string();
    let Some((_, strongest)) = strongest_sri(&integrity) else {
        bail!("{id} has no integrity hash in the npm registry - imp installs only a package it can check");
    };
    if keys.is_none() {
        let fetched = fetch_json(NPM_SIGNING_KEYS, "the signing keys of the npm registry")?;
        let list = fetched
            .get("keys")
            .and_then(Value::as_array)
            .cloned()
            .ok_or_else(|| anyhow!("could not read the signing keys of the npm registry - {NPM_SIGNING_KEYS}"))?;
        *keys = Some(list);
    }
    let name = record.name.clone();
    let version = record.version.clone();
    let mut publish_time = || {
        fetch_json(&format!("{NPM_REGISTRY}/{}", name.replacen('/', "%2F", 1)), &format!("the publish times of {name}"))
            .ok()
            .and_then(|packument| packument.get("time").and_then(|time| time.get(&version)).and_then(Value::as_str).map(String::from))
    };
    if let Some(problem) = registry_signature_problem(
        &record.name,
        &record.version,
        &integrity,
        metadata.pointer("/dist/signatures"),
        keys.as_deref().unwrap_or(&[]),
        &mut publish_time,
    ) {
        bail!("signature check failed - {problem}; nothing was installed");
    }
    let tarball_url = metadata.pointer("/dist/tarball").and_then(Value::as_str).unwrap_or("");
    let tarball = fetch_bytes(tarball_url, &id)?;
    if !matches_integrity(&integrity, &tarball) {
        bail!(
            "integrity check failed for {id} - the downloaded package does not match the hash that the npm registry publishes; nothing was installed"
        );
    }
    let bundled: Vec<(String, Vec<u8>)> = record
        .files
        .iter()
        .map(|path| Ok((path.clone(), std::fs::read(record.directory.join(path))?)))
        .collect::<Result<_>>()?;
    if let Some(problem) = bundled_file_problem(&id, &tarball_files(&tarball)?, &bundled) {
        bail!("integrity check failed - {problem}; nothing was installed");
    }
    record.integrity = Some(strongest);
    record.attestation_listed = metadata.pointer("/dist/attestations/provenance").is_some_and(|value| !value.is_null());
    Ok(())
}

fn jsr_attestation_listed(name: &str, version: &str) -> bool {
    let trimmed = name.trim_start_matches('@');
    let Some((scope, package)) = trimmed.split_once('/') else { return false };
    match get(&format!("{JSR_API}/scopes/{scope}/packages/{package}/versions/{version}"), &[], None) {
        Ok(response) if response.ok() => response
            .json()
            .ok()
            .and_then(|value| value.get("rekorLogId").cloned())
            .is_some_and(|value| !value.is_null() && value != Value::String(String::new())),
        _ => false,
    }
}

pub fn verify_packages(packages: &mut [PackageRecord]) -> Result<()> {
    let mut keys = None;
    for record in packages.iter_mut() {
        if record.registry == "npm" {
            verify_npm_package(record, &mut keys)?;
        } else {
            record.integrity = None;
            record.attestation_listed = jsr_attestation_listed(&record.name, &record.version);
        }
    }
    Ok(())
}
