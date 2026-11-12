mod support;

use imp::audit::{
    OsvAnswer, OsvTransport, audit_report, audited_packages, describe_vulnerability,
    known_vulnerability_ids, osv_query, osv_request, retry_delay,
};
use imp::config::{ConfigChange, Insertion};
use imp::install::{
    DiskFileSystem, Prepared, ProjectFileSystem, commit_dependencies, component_skill,
};
use imp::integrity::{bundled_file_problem, registry_signature_problem};
use imp::npm::{matches_integrity, sri_digest, strongest_sri, tarball_files};
use regex::Regex;
use serde_json::{Value, json};
use std::cell::RefCell;
use std::path::Path;
use support::*;

fn project_state(dir: &Path) -> String {
    let files: Vec<String> = list_files(&dir.join("dependencies"))
        .into_iter()
        .map(|file| format!("dependencies/{file}"))
        .collect();
    let config =
        std::fs::read_to_string(dir.join("imp.json")).unwrap_or_else(|_| "(missing)".into());
    format!(
        "\n{}\n\n{}\n",
        section("files", &files.join("\n")),
        section("imp.json", &config)
    )
}

fn without_download_noise(mut run: Run) -> Run {
    run.stderr = run
        .stderr
        .split('\n')
        .filter(|line| !line.starts_with("Download ") && !line.starts_with("Downloading "))
        .collect::<Vec<_>>()
        .join("\n");
    run
}

fn mask_latest(text: &str) -> String {
    let text = Regex::new(r"@\d+\.\d+\.\d+([-+][\w.-]+)?")
        .unwrap()
        .replace_all(text, "@<latest>");
    Regex::new(r"\(\d+(\.\d+)? k?B\)")
        .unwrap()
        .replace_all(&text, "(<size>)")
        .into_owned()
}

#[test]
fn install_and_uninstall() {
    let dir = TempDir::new();
    let step = |name: &str, args: &[&str], state: bool, mask: &dyn Fn(&str) -> String| {
        let result = without_download_noise(run_imp(args, &dir.path));
        let text = transcript(&format!("imp {}  (cwd: <tmp>)", args.join(" ")), &result);
        let suffix = if state {
            project_state(&dir.path)
        } else {
            String::new()
        };
        assert_snapshot(name, &mask(&format!("{text}{suffix}")));
    };
    let plain = |text: &str| text.to_string();

    let empty = TempDir::new();
    let result = without_download_noise(run_imp(&["install"], &empty.path));
    assert_snapshot(
        "install-nothing-declared",
        &transcript("imp install  (cwd: <tmp>)", &result),
    );

    step(
        "install-pinned-npm",
        &["install", "mitt@3.0.1"],
        true,
        &plain,
    );
    step(
        "install-alias-flag",
        &["install", "mitt", "3.0.1", "--alias", "bus"],
        true,
        &plain,
    );

    let result =
        without_download_noise(run_imp(&["install", "nanoid@5.0.7/non-secure"], &dir.path));
    let usage = run_module_probe(
        &dir.join("dependencies/non-secure"),
        "import { nanoid } from './non-secure.js'\nglobalThis.__probe = `[vendored module: nanoid(7) returned ${nanoid(7).length} characters]`\n",
    );
    assert_snapshot(
        "install-npm-subpath",
        &format!(
            "{}\n{usage}\n{}",
            transcript("imp install nanoid@5.0.7/non-secure  (cwd: <tmp>)", &result),
            project_state(&dir.path)
        ),
    );

    step(
        "uninstall-removes-dependency",
        &["uninstall", "bus"],
        true,
        &plain,
    );
    step("install-update-all", &["install"], true, &mask_latest);
    step(
        "install-imp-package-rejected",
        &["install", "imp"],
        false,
        &plain,
    );
    step(
        "install-imp-alias-rejected",
        &["install", "mitt", "3.0.1", "--alias", "imp"],
        false,
        &plain,
    );

    let declared = TempDir::new();
    write(
        &declared.join("imp.json"),
        "{ \"dependencies\": { \"imp\": \"npm:imp@1.0.1\" } }\n",
    );
    let result = without_download_noise(run_imp(&["install"], &declared.path));
    assert_snapshot(
        "install-imp-alias-declared",
        &transcript("imp install  (cwd: <tmp>)", &result),
    );

    let project = TempDir::new();
    let config = "{ \"dependencies\": { \"mitt\": \"npm:mitt@3.0.1\", \"zzz\": \"npm:imp-test-no-such-package-404@1.0.0\" } }\n";
    write(&project.join("imp.json"), config);
    let result = without_download_noise(run_imp(&["install"], &project.path));
    let folder = project.join("dependencies").exists();
    let unchanged = read(&project.join("imp.json")) == config;
    assert_snapshot(
        "install-all-or-nothing",
        &format!(
            "{}\n[dependencies/ written: {folder}]\n[imp.json unchanged: {unchanged}]\n",
            transcript(
                "imp install  (cwd: <tmp>, the second package fails)",
                &result
            )
        ),
    );

    step(
        "install-unknown-package",
        &["install", "imp-test-no-such-package-404"],
        false,
        &plain,
    );
    step(
        "install-range-version-rejected",
        &["install", "mitt@^3"],
        false,
        &plain,
    );
    step(
        "uninstall-undeclared",
        &["uninstall", "lodash"],
        false,
        &plain,
    );
}

#[test]
fn install_license_policy() {
    let with_policy = |name: &str, licenses: Value, args: &[&str]| {
        let dir = TempDir::new();
        write(
            &dir.join("imp.json"),
            &format!(
                "{}\n",
                serde_json::to_string_pretty(&json!({ "licenses": licenses })).unwrap()
            ),
        );
        let result = without_download_noise(run_imp(args, &dir.path));
        let wrote = if dir.join("dependencies").exists() {
            "yes"
        } else {
            "no"
        };
        assert_snapshot(
            name,
            &format!(
                "{}\n--- wrote dependencies/ ---\n{wrote}\n",
                transcript(&format!("imp {}  (cwd: <tmp>)", args.join(" ")), &result)
            ),
        );
    };
    with_policy(
        "license-permissive-blocks-weak-copyleft",
        json!("permissive"),
        &["install", "axe-core@4.8.2"],
    );
    with_policy(
        "license-weak-copyleft-allows-mpl",
        json!("weak-copyleft"),
        &["install", "axe-core@4.8.2"],
    );
    with_policy(
        "license-allow-list-blocks-apache",
        json!(["MIT", "ISC"]),
        &["install", "long@5.2.3"],
    );
    with_policy(
        "license-or-expression-takes-permissive-branch",
        json!("permissive"),
        &["install", "node-forge@0.7.0"],
    );
    with_policy(
        "license-unknown-warns-only",
        json!("permissive"),
        &["install", "indexof@0.0.1"],
    );
    with_policy(
        "license-invalid-policy-value",
        json!("mostly-fine"),
        &["install", "mitt@3.0.1"],
    );
}

fn audit_manifests() -> Vec<Value> {
    vec![
        json!({
            "alias": "forge", "specifier": "npm:node-forge@0.7.0", "installedAt": "2026-09-01T10:00:00Z", "impImports": [],
            "packages": [{
                "name": "node-forge", "version": "0.7.0",
                "integrity": "sha512-nrGmJHbnyl7LfZyHbcgNyi0yHawEXOAnWYnw/3MJKJ7vyS2NcTqs5+sI4xcaivd6kjoUwnkD53FFRHC7m2FH4A==",
                "attestationListed": false, "license": "(BSD-3-Clause OR GPL-2.0)", "licenseText": "...",
            }],
        }),
        json!({
            "alias": "ng", "specifier": "npm:@angular/core@17.0.0", "installedAt": "2026-09-01T10:00:00Z", "impImports": [],
            "packages": [{
                "name": "@angular/core", "version": "17.0.0", "integrity": null,
                "attestationListed": false, "license": "SEE LICENSE IN LICENSE.md", "licenseText": null,
            }],
        }),
    ]
}

#[test]
fn audit_reports_the_known_vulnerabilities_of_a_package() {
    let packages = audited_packages(&audit_manifests());
    let forge = packages
        .iter()
        .find(|entry| entry["name"] == "node-forge")
        .unwrap()
        .clone();
    let advisory = json!({
        "id": "GHSA-5rrq-pxf6-6jx5",
        "summary": "Prototype Pollution in node-forge debug API.",
        "database_specific": { "severity": "LOW" },
        "affected": [
            { "package": { "name": "node-forge", "ecosystem": "npm" }, "ranges": [{ "type": "SEMVER", "events": [{ "introduced": "0" }, { "fixed": "1.0.0" }] }] },
            { "package": { "name": "node-forge", "ecosystem": "npm" }, "ranges": [{ "type": "SEMVER", "events": [{ "introduced": "0" }, { "fixed": "0.10.0" }] }] },
        ],
    });
    let unfixed =
        json!({ "id": "GHSA-xxxx-yyyy-zzzz", "details": "A second problem.\nMore text." });
    let (affected, vulnerable) = audit_report(&[(
        forge.clone(),
        vec![
            describe_vulnerability(&advisory, &forge),
            describe_vulnerability(&unfixed, &forge),
        ],
    )]);
    let (clean, clean_vulnerable) = audit_report(&[(forge.clone(), vec![])]);
    assert_snapshot(
        "audit-report",
        &format!(
            "--- query ---\n{}\n\n--- vulnerable ({vulnerable}) ---\n{affected}\n\n--- clean ({clean_vulnerable}) ---\n{clean}\n",
            osv_query(&forge)
        ),
    );
}

struct FakeOsv<F: Fn(&str, Option<&Value>) -> OsvAnswer> {
    answer: F,
    waits: RefCell<Vec<u64>>,
}

impl<F: Fn(&str, Option<&Value>) -> OsvAnswer> OsvTransport for FakeOsv<F> {
    fn send(&self, url: &str, body: Option<&Value>) -> anyhow::Result<OsvAnswer> {
        Ok((self.answer)(url, body))
    }

    fn sleep(&self, ms: u64) {
        self.waits.borrow_mut().push(ms);
    }
}

fn fake<F: Fn(&str, Option<&Value>) -> OsvAnswer>(answer: F) -> FakeOsv<F> {
    FakeOsv {
        answer,
        waits: RefCell::new(Vec::new()),
    }
}

fn osv_answer(status: u16, body: Value, retry_after: Option<&str>) -> OsvAnswer {
    OsvAnswer {
        status,
        body: body.to_string().into_bytes(),
        retry_after: retry_after.map(str::to_string),
    }
}

#[test]
fn audit_follows_every_page_of_the_osv_results() {
    let requests = RefCell::new(Vec::new());
    let osv = fake(|url, body| {
        let queries = body.unwrap()["queries"].as_array().unwrap().clone();
        let path = url.trim_start_matches("https://api.osv.dev");
        let described: Vec<String> = queries
            .iter()
            .map(|query| {
                format!(
                    "{}:{}",
                    query["package"]["name"].as_str().unwrap(),
                    query["page_token"].as_str().unwrap_or("-")
                )
            })
            .collect();
        requests
            .borrow_mut()
            .push(format!("{path} {}", described.join(",")));
        if queries[0]["page_token"].is_null() {
            return osv_answer(
                200,
                json!({ "results": [
                    { "vulns": [{ "id": "GHSA-1" }], "next_page_token": "forge-2" },
                    {},
                    { "vulns": [{ "id": "GHSA-8" }], "next_page_token": "wide-2" },
                ]}),
                None,
            );
        }
        let pages = json!({
            "forge-2": { "vulns": [{ "id": "GHSA-2" }], "next_page_token": "forge-3" },
            "forge-3": { "vulns": [{ "id": "GHSA-3" }] },
            "wide-2": { "vulns": [{ "id": "GHSA-9" }] },
        });
        let results: Vec<Value> = queries
            .iter()
            .map(|query| pages[query["page_token"].as_str().unwrap()].clone())
            .collect();
        osv_answer(200, json!({ "results": results }), None)
    });
    let ids = known_vulnerability_ids(
        &[
            json!({ "name": "forge", "version": "1.0.0" }),
            json!({ "name": "calm", "version": "2.0.0" }),
            json!({ "name": "wide", "version": "3.0.0" }),
        ],
        &osv,
    )
    .unwrap();
    check(
        ids == vec![
            vec!["GHSA-1", "GHSA-2", "GHSA-3"],
            vec![],
            vec!["GHSA-8", "GHSA-9"],
        ],
        format!("the pages were not joined: {ids:?}"),
    );
    let requests = requests.borrow().join(" | ");
    check(
        requests
            == "/v1/querybatch forge:-,calm:-,wide:- | /v1/querybatch forge:forge-2,wide:wide-2 | /v1/querybatch forge:forge-3",
        format!("unexpected requests: {requests}"),
    );
}

#[test]
fn audit_fails_when_osv_answers_fewer_results_than_it_was_asked() {
    let osv = fake(|_, _| osv_answer(200, json!({ "results": [{}] }), None));
    let error = known_vulnerability_ids(
        &[
            json!({ "name": "forge", "version": "1.0.0" }),
            json!({ "name": "calm", "version": "2.0.0" }),
        ],
        &osv,
    )
    .err()
    .map(|error| error.to_string());
    check(
        error.as_deref() == Some("the OSV database answered 2 queries with 1 results"),
        format!("a short answer was not refused: {error:?}"),
    );
}

#[test]
fn audit_retries_osv_after_a_rate_limit_or_a_server_error() {
    let answers = RefCell::new(vec![
        osv_answer(429, json!({}), Some("7")),
        osv_answer(503, json!({}), None),
        osv_answer(200, json!({ "id": "GHSA-1" }), None),
    ]);
    let osv = fake(|_, _| answers.borrow_mut().remove(0));
    let recovered = osv_request(&osv, "/vulns/GHSA-1", None).unwrap();
    check(
        recovered["id"] == "GHSA-1",
        format!("the retry did not return the answer: {recovered}"),
    );
    check(
        *osv.waits.borrow() == vec![7000, 2000],
        format!(
            "the waits did not follow Retry-After, then the backoff: {:?}",
            osv.waits.borrow()
        ),
    );

    let calls = RefCell::new(0);
    let busy = fake(|_, _| {
        *calls.borrow_mut() += 1;
        osv_answer(500, json!({}), None)
    });
    let gave_up = osv_request(&busy, "/vulns/GHSA-1", None)
        .err()
        .map(|error| error.to_string());
    check(
        *calls.borrow() == 4,
        format!(
            "a server that always fails got {} requests, not 4",
            calls.borrow()
        ),
    );
    check(
        gave_up.as_deref()
            == Some(
                "the OSV database did not answer - https://api.osv.dev/v1/vulns/GHSA-1 responded 500",
            ),
        format!("unexpected message: {gave_up:?}"),
    );

    let refused_calls = RefCell::new(0);
    let refused = fake(|_, _| {
        *refused_calls.borrow_mut() += 1;
        osv_answer(400, json!({}), None)
    });
    let _ = osv_request(&refused, "/vulns/x", None);
    check(*refused_calls.borrow() == 1, "a 400 answer was not retried");

    let now = imp::time::parse_http_date("Tue, 01 Sep 2026 10:00:00 GMT").unwrap();
    let delays = [
        retry_delay(Some("3"), 0, now),
        retry_delay(Some("Tue, 01 Sep 2026 10:00:12 GMT"), 0, now),
        retry_delay(Some("Tue, 01 Sep 2026 09:00:00 GMT"), 0, now),
        retry_delay(None, 2, now),
        retry_delay(Some("3600"), 0, now),
    ];
    check(
        delays == [3000, 12000, 0, 4000, 60000],
        format!("unexpected delays: {delays:?}"),
    );
}

#[test]
fn audit_sbom_writes_a_cyclonedx_bill_of_materials() {
    let dir = TempDir::new();
    let manifests = audit_manifests();
    let dependencies: serde_json::Map<String, Value> = manifests
        .iter()
        .map(|manifest| {
            (
                manifest["alias"].as_str().unwrap().to_string(),
                manifest["specifier"].clone(),
            )
        })
        .collect();
    write(
        &dir.join("imp.json"),
        &format!(
            "{}\n",
            serde_json::to_string_pretty(&json!({ "dependencies": dependencies })).unwrap()
        ),
    );
    for manifest in &manifests {
        write(
            &dir.join(&format!(
                "dependencies/{}/manifest.json",
                manifest["alias"].as_str().unwrap()
            )),
            &manifest.to_string(),
        );
    }
    let result = run_imp(&["audit", "--sbom"], &dir.path);
    let name = dir.path.file_name().unwrap().to_string_lossy().into_owned();
    let bom = read(&dir.join("sbom.cdx.json"));
    let bom = Regex::new(r#""urn:uuid:[0-9a-f-]+""#)
        .unwrap()
        .replace(&bom, "\"urn:uuid:<random>\"");
    let bom = Regex::new(r#""timestamp": "[^"]+""#)
        .unwrap()
        .replace(&bom, "\"timestamp\": \"<now>\"");
    let bom = bom.replace(&name, "<app>");
    let empty = TempDir::new();
    write(&empty.join("imp.json"), "{}\n");
    let nothing = run_imp(&["audit"], &empty.path);
    assert_snapshot(
        "audit-sbom",
        &format!(
            "{}\n--- sbom.cdx.json ---\n{}\n{}",
            transcript(
                "imp audit --sbom  (cwd: <tmp>)",
                &result.replace(&name, "<app>")
            ),
            normalize(&bom),
            transcript("imp audit  (cwd: <tmp with no dependencies>)", &nothing)
        ),
    );
}

#[test]
fn audit_fails_when_a_dependency_has_no_manifest() {
    let dir = TempDir::new();
    write(
        &dir.join("imp.json"),
        "{ \"dependencies\": { \"forge\": \"npm:node-forge@0.7.0\", \"ng\": \"npm:@angular/core@17.0.0\" } }\n",
    );
    write(
        &dir.join("dependencies/forge/manifest.json"),
        &audit_manifests()[0].to_string(),
    );
    let audited = run_imp(&["audit"], &dir.path);
    let sbom = run_imp(&["audit", "--sbom"], &dir.path);
    let wrote = if dir.join("sbom.cdx.json").exists() {
        "yes"
    } else {
        "no"
    };
    assert_snapshot(
        "audit-missing-manifest",
        &format!(
            "{}\n{}\n--- wrote sbom.cdx.json ---\n{wrote}\n",
            transcript("imp audit  (cwd: <tmp>, ng has no manifest)", &audited),
            transcript("imp audit --sbom  (cwd: <tmp>, ng has no manifest)", &sbom)
        ),
    );
}

fn gzip_tar(files: &[(&str, &str)]) -> Vec<u8> {
    let mut builder = tar::Builder::new(Vec::new());
    for (name, text) in files {
        let mut header = tar::Header::new_ustar();
        header.set_path(name).unwrap();
        header.set_size(text.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        builder.append(&header, text.as_bytes()).unwrap();
    }
    let tar = builder.into_inner().unwrap();
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    std::io::Write::write_all(&mut encoder, &tar).unwrap();
    encoder.finish().unwrap()
}

fn null_or(value: Option<String>) -> String {
    value.unwrap_or_else(|| "null".into())
}

#[test]
fn install_checks_a_package_against_its_published_integrity() {
    let tarball = gzip_tar(&[
        ("package/package.json", "{\"name\":\"demo\"}"),
        ("package/lib/index.js", "export const answer = 42\n"),
    ]);
    let published = sri_digest("sha512", &tarball);
    let mut tampered = tarball.clone();
    let last = tampered.len() - 1;
    tampered[last] ^= 1;
    let files = tarball_files(&tarball).unwrap();
    let names: Vec<&str> = files.iter().map(|(name, _)| name.as_str()).collect();
    let bundled = |path: &str, text: &str| vec![(path.to_string(), text.as_bytes().to_vec())];
    let results = [
        format!(
            "strongest of sha1 and sha512: {}",
            strongest_sri(&format!("sha1-AAAA {published}"))
                .map(|(algorithm, _)| algorithm)
                .unwrap_or("null")
        ),
        format!(
            "no known algorithm: {}",
            null_or(strongest_sri("md5-AAAA").map(|(algorithm, _)| algorithm.to_string()))
        ),
        format!(
            "published tarball matches: {}",
            matches_integrity(&published, &tarball)
        ),
        format!(
            "changed tarball matches: {}",
            matches_integrity(&published, &tampered)
        ),
        format!("files in the tarball: {}", names.join(", ")),
        format!(
            "bundled copy is the published one: {}",
            null_or(bundled_file_problem(
                "demo@1.0.0",
                &files,
                &bundled("lib/index.js", "export const answer = 42\n")
            ))
        ),
        format!(
            "bundled copy was edited: {}",
            null_or(bundled_file_problem(
                "demo@1.0.0",
                &files,
                &bundled("lib/index.js", "export const answer = 43\n")
            ))
        ),
        format!(
            "bundled file is not in the package: {}",
            null_or(bundled_file_problem(
                "demo@1.0.0",
                &files,
                &bundled("lib/extra.js", "")
            ))
        ),
    ];
    assert_snapshot(
        "install-integrity-check",
        &format!("{}\n", results.join("\n")),
    );
}

struct Signer {
    key: String,
    pair: ring::signature::EcdsaKeyPair,
}

const P256_SPKI_PREFIX: [u8; 26] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];

fn signer() -> Signer {
    use base64::Engine;
    use ring::signature::{ECDSA_P256_SHA256_ASN1_SIGNING, EcdsaKeyPair, KeyPair};
    let random = ring::rand::SystemRandom::new();
    let pkcs8 = EcdsaKeyPair::generate_pkcs8(&ECDSA_P256_SHA256_ASN1_SIGNING, &random).unwrap();
    let pair =
        EcdsaKeyPair::from_pkcs8(&ECDSA_P256_SHA256_ASN1_SIGNING, pkcs8.as_ref(), &random).unwrap();
    let mut spki = P256_SPKI_PREFIX.to_vec();
    spki.extend_from_slice(pair.public_key().as_ref());
    Signer {
        key: base64::engine::general_purpose::STANDARD.encode(spki),
        pair,
    }
}

impl Signer {
    fn sign(&self, message: &str) -> String {
        use base64::Engine;
        let signature = self
            .pair
            .sign(&ring::rand::SystemRandom::new(), message.as_bytes())
            .unwrap();
        base64::engine::general_purpose::STANDARD.encode(signature.as_ref())
    }
}

#[test]
fn install_checks_the_npm_registry_signature_of_a_package() {
    let registry = signer();
    let impostor = signer();
    let integrity =
        "sha512-nrGmJHbnyl7LfZyHbcgNyi0yHawEXOAnWYnw/3MJKJ7vyS2NcTqs5+sI4xcaivd6kjoUwnkD5";
    let message = format!("@demo/pkg@1.0.0:{integrity}");
    let current = json!([{ "keyid": "SHA256:current", "sig": registry.sign(&message) }]);
    let keys = vec![
        json!({ "keyid": "SHA256:current", "key": registry.key, "expires": null }),
        json!({ "keyid": "SHA256:retired", "key": registry.key, "expires": "2025-01-29T00:00:00.000Z" }),
    ];
    let lookups = RefCell::new(0);
    let problem = |version: &str, integrity: &str, signatures: &Value, published: Option<&str>| {
        let mut publish_time = || {
            *lookups.borrow_mut() += 1;
            published.map(str::to_string)
        };
        null_or(registry_signature_problem(
            "@demo/pkg",
            version,
            integrity,
            Some(signatures),
            &keys,
            &mut publish_time,
        ))
    };
    let first = problem("1.0.0", integrity, &current, None);
    let looked_up = *lookups.borrow() > 0;
    let retired = json!([{ "keyid": "SHA256:retired", "sig": registry.sign(&message) }]);
    let results = [
        format!("signed by a current key: {first}"),
        format!("publish time looked up for a key with no expiry: {looked_up}"),
        format!(
            "another hash: {}",
            problem(
                "1.0.0",
                &format!("{}6", &integrity[..integrity.len() - 1]),
                &current,
                None
            )
        ),
        format!(
            "another version: {}",
            problem("1.0.1", integrity, &current, None)
        ),
        format!(
            "signed by another key: {}",
            problem(
                "1.0.0",
                integrity,
                &json!([{ "keyid": "SHA256:current", "sig": impostor.sign(&message) }]),
                None
            )
        ),
        format!(
            "no signature: {}",
            problem("1.0.0", integrity, &json!([]), None)
        ),
        format!(
            "unknown key: {}",
            problem(
                "1.0.0",
                integrity,
                &json!([{ "keyid": "SHA256:other", "sig": registry.sign(&message) }]),
                None
            )
        ),
        format!(
            "a second signature that fails: {}",
            problem(
                "1.0.0",
                integrity,
                &json!([current[0].clone(), { "keyid": "SHA256:current", "sig": "AAAA" }]),
                None
            )
        ),
        format!(
            "retired key, published before it expired: {}",
            problem(
                "1.0.0",
                integrity,
                &retired,
                Some("2023-07-04T17:31:47.638Z")
            )
        ),
        format!(
            "retired key, published after it expired: {}",
            problem(
                "1.0.0",
                integrity,
                &retired,
                Some("2025-03-01T00:00:00.000Z")
            )
        ),
        format!(
            "retired key, no publish time: {}",
            problem("1.0.0", integrity, &retired, None)
        ),
    ];
    assert_snapshot(
        "install-signature-check",
        &format!("{}\n", results.join("\n")),
    );
}

fn release(alias: &str, text: &str) -> Prepared {
    Prepared::new(
        alias,
        &format!("npm:{alias}@2.0.0"),
        vec![(format!("{alias}.js"), text.as_bytes().to_vec())],
        json!({ "alias": alias, "specifier": format!("npm:{alias}@2.0.0"), "packages": [] }),
    )
}

fn changes_of(aliases: &[&str]) -> Vec<ConfigChange> {
    aliases
        .iter()
        .map(|alias| ConfigChange {
            path: vec!["dependencies".into(), alias.to_string()],
            value: Some(Value::from(format!("npm:{alias}@2.0.0"))),
            insertion: Insertion::End,
        })
        .collect()
}

const ORIGINAL_CONFIG: &str = "{\n  \"dependencies\": { \"events\": \"npm:events@1.0.0\" }\n}\n";

fn commit_project() -> TempDir {
    let root = TempDir::new();
    write(&root.join("imp.json"), ORIGINAL_CONFIG);
    write(
        &root.join("dependencies/events/events.js"),
        "export const version = 1\n",
    );
    write(&root.join("dependencies/events/manifest.json"), "{}\n");
    root
}

fn state(root: &Path) -> String {
    list_files(root)
        .iter()
        .map(|path| format!("{path}: {}", Value::from(read(&root.join(path)))))
        .collect::<Vec<_>>()
        .join("\n")
}

struct Failing {
    write_fails_for: Option<&'static str>,
    rename_fails_for: Option<&'static str>,
    config_fails: bool,
}

impl ProjectFileSystem for Failing {
    fn write_file(&self, path: &Path, bytes: &[u8]) -> std::io::Result<()> {
        if self
            .write_fails_for
            .is_some_and(|name| path.file_name().is_some_and(|file| file == name))
        {
            return Err(std::io::Error::other("No space left on device"));
        }
        std::fs::write(path, bytes)
    }

    fn rename(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        if self
            .rename_fails_for
            .is_some_and(|name| to.file_name().is_some_and(|file| file == name))
        {
            return Err(std::io::Error::other("Access is denied"));
        }
        std::fs::rename(from, to)
    }

    fn update_config(&self, path: &Path, changes: &[ConfigChange]) -> anyhow::Result<()> {
        if self.config_fails {
            std::fs::write(path, "{ \"dependencies\": {")?;
            anyhow::bail!("No space left on device");
        }
        imp::config::update_config_file(path, changes)
    }
}

#[test]
fn install_puts_every_package_in_place_or_none() {
    let dependencies = [
        release("events", "export const version = 2\n"),
        release("fresh", "new\n"),
    ];
    let changes = changes_of(&["events", "fresh"]);
    let failures = [
        (
            "a write of the second package fails",
            Failing {
                write_fails_for: Some("fresh.js"),
                rename_fails_for: None,
                config_fails: false,
            },
        ),
        (
            "the second package cannot move into place",
            Failing {
                write_fails_for: None,
                rename_fails_for: Some("fresh"),
                config_fails: false,
            },
        ),
        (
            "imp.json cannot be written",
            Failing {
                write_fails_for: None,
                rename_fails_for: None,
                config_fails: true,
            },
        ),
    ];
    for (failure, fs) in &failures {
        let root = commit_project();
        let before = state(&root.path);
        let error = commit_dependencies(&root.path, &dependencies, &changes, fs)
            .err()
            .map(|error| error.to_string());
        let after = state(&root.path);
        check(
            error
                .as_deref()
                .is_some_and(|error| error.ends_with(" - nothing was installed")),
            format!("{failure}: unexpected error: {error:?}"),
        );
        check(
            after == before,
            format!(
                "{failure}: the project changed:\n--- before ---\n{before}\n--- after ---\n{after}"
            ),
        );
    }
    let root = commit_project();
    commit_dependencies(&root.path, &dependencies, &changes, &DiskFileSystem).unwrap();
    assert_snapshot("install-commit-state", &format!("{}\n", state(&root.path)));

    let fresh = TempDir::new();
    let _ = commit_dependencies(&fresh.path, &dependencies, &changes, &failures[2].1);
    let left = list_files(&fresh.path);
    check(
        left.is_empty(),
        format!("files were left behind: {}", left.join(", ")),
    );
}

const BAD_ALIASES: [&str; 8] = [
    "../escape",
    "..",
    ".hidden",
    "a/b",
    "a\\b",
    "/abs",
    "x..y",
    "@scope/name",
];

#[test]
fn a_dependency_alias_cannot_reach_outside_dependencies() {
    let dir = TempDir::new();
    write(&dir.join("index.html"), "<!doctype html>\n");
    for alias in BAD_ALIASES {
        write(
            &dir.join("imp.json"),
            &json!({ "dependencies": { alias: "npm:mitt@3.0.1" } }).to_string(),
        );
        for command in ["install", "build"] {
            let result = run_imp(&[command], &dir.path);
            check(
                result.code == 1,
                format!("imp {command} accepted the alias '{alias}'"),
            );
            check(
                result.stderr.contains(&format!(
                    "dependency alias '{alias}' must be a package name"
                )),
                format!("unexpected error for '{alias}': {}", result.stderr),
            );
        }
    }
    let parent = TempDir::new();
    let root = parent.join("project");
    std::fs::create_dir_all(&root).unwrap();
    for alias in BAD_ALIASES {
        let dependency = Prepared::new(
            alias,
            "npm:mitt@3.0.1",
            vec![("escape.js".into(), b"owned\n".to_vec())],
            json!({ "alias": alias, "specifier": "npm:mitt@3.0.1", "packages": [] }),
        );
        let changes = vec![ConfigChange {
            path: vec!["dependencies".into(), alias.into()],
            value: Some(Value::from("npm:mitt@3.0.1")),
            insertion: Insertion::End,
        }];
        let error = commit_dependencies(&root, &[dependency], &changes, &DiskFileSystem)
            .err()
            .map(|error| error.to_string());
        check(
            error.as_deref().is_some_and(|error| {
                error.starts_with(&format!("invalid dependency alias: '{alias}'"))
            }),
            format!("unexpected: {error:?}"),
        );
    }
    let left = list_files(&parent.path);
    check(
        left.is_empty(),
        format!("files were written: {}", left.join(", ")),
    );
}

#[test]
fn install_takes_the_skill_of_an_imp_component_from_beside_its_entry_module() {
    let folder = TempDir::new();
    let entry = folder.join("dist/widget.js");
    write(&entry, "export const widget = 1\n");
    write(&folder.join("dist/imp-skill.md"), "# widget - a panel\n");
    let (name, contents) = component_skill("npm:widget@1.0.0", Some(&entry)).unwrap();
    check(name == "imp-skill.md", format!("unexpected file: {name}"));
    check(
        contents == b"# widget - a panel\n",
        "the skill was not copied verbatim",
    );
    std::fs::remove_file(folder.join("dist/imp-skill.md")).unwrap();
    let problem = component_skill("npm:widget@1.0.0", Some(&entry))
        .err()
        .map(|error| error.to_string());
    check(
        problem.as_deref().is_some_and(|problem| problem.starts_with(
            "npm:widget@1.0.0 imports imp, so it is an imp component, and it has no imp-skill.md next to its entry module",
        )),
        format!("unexpected problem: {problem:?}"),
    );
}

#[test]
#[cfg(unix)]
fn install_sh_downloads_the_binary_and_its_checksum_from_one_resolved_release_tag() {
    let dir = TempDir::new();
    let bin = dir.join("bin");
    let target = dir.join("target");
    std::fs::create_dir_all(&target).unwrap();
    let requests = dir.join("requests.log");
    let fake_curl = [
        "#!/bin/bash".to_string(),
        "output=\"\"".into(),
        "head=0".into(),
        "url=\"\"".into(),
        "while [ $# -gt 0 ]; do".into(),
        "  case \"$1\" in".into(),
        "    -o) output=\"$2\"; shift 2 ;;".into(),
        "    -w) shift 2 ;;".into(),
        "    -*I*) head=1; shift ;;".into(),
        "    -*) shift ;;".into(),
        "    *) url=\"$1\"; shift ;;".into(),
        "  esac".into(),
        "done".into(),
        format!("echo \"$url\" >> '{}'", requests.display()),
        "if [ \"$head\" = 1 ]; then".into(),
        "  printf \"https://github.com/sobanieca/imp-ui/releases/tag/v9.8.7\"".into(),
        "  exit 0".into(),
        "fi".into(),
        "case \"$url\" in".into(),
        "  *.sha256) printf '17a815baf7efd5341b39e803d557cea4b127e125af8a5f92f0edd6322a0c38e5  imp\\n' > \"$output\" ;;".into(),
        "  *) printf 'fake binary' > \"$output\" ;;".into(),
        "esac".into(),
    ]
    .join("\n");
    write(&bin.join("curl"), &format!("{fake_curl}\n"));
    std::process::Command::new("chmod")
        .args(["+x", &bin.join("curl").to_string_lossy()])
        .status()
        .unwrap();
    let output = std::process::Command::new("bash")
        .arg(cli_dir().parent().unwrap().join("install.sh"))
        .env(
            "PATH",
            format!(
                "{}:{}",
                bin.display(),
                std::env::var("PATH").unwrap_or_default()
            ),
        )
        .env("INSTALL_DIR", &target)
        .output()
        .unwrap();
    check(
        output.status.success(),
        format!(
            "install.sh failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ),
    );
    let asked = read(&requests);
    let downloads: Vec<&str> = asked
        .lines()
        .filter(|url| url.contains("/releases/download/"))
        .collect();
    check(
        downloads.len() == 2,
        format!("expected two downloads, got {asked}"),
    );
    check(
        downloads
            .iter()
            .all(|url| url.contains("/releases/download/v9.8.7/")),
        format!("the binary and the checksum must come from one tag, got {downloads:?}"),
    );
    check(
        read(&target.join("imp")) == "fake binary",
        "the binary is installed",
    );
}
