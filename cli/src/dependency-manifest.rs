use crate::http_client::get;
use crate::license_policy::package_id;
use crate::npm::read_package_json;
use anyhow::{Result, bail};
use serde_json::{Map, Value, json};
use std::path::{Path, PathBuf};

pub const DEPENDENCY_MANIFEST_FILE: &str = "manifest.json";
const JSR_REGISTRY: &str = "https://jsr.io";

#[derive(Debug, Clone)]
pub struct PackageRecord {
    pub registry: &'static str,
    pub name: String,
    pub version: String,
    pub directory: PathBuf,
    pub files: Vec<String>,
    pub integrity: Option<String>,
    pub attestation_listed: bool,
}

impl PackageRecord {
    pub fn id(&self) -> String {
        format!("{}@{}", self.name, self.version)
    }
}

fn is_license_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    let base = lower.split(['.', '-']).next().unwrap_or("");
    (base == "license" || base == "licence" || base == "copying")
        && lower[base.len()..].split(['.', '-']).all(|part| part.chars().all(|char| char.is_ascii_alphanumeric()))
}

fn spdx_from(manifest: &Value) -> Option<String> {
    if let Some(license) = manifest.get("license") {
        if let Some(text) = license.as_str() {
            return Some(text.to_string());
        }
        if let Some(text) = license.get("type").and_then(Value::as_str) {
            return Some(text.to_string());
        }
    }
    manifest.pointer("/licenses/0/type").and_then(Value::as_str).map(String::from)
}

fn npm_license(directory: &Path) -> (Option<String>, Option<String>) {
    let manifest = read_package_json(directory);
    let mut entries: Vec<_> = std::fs::read_dir(directory).into_iter().flatten().flatten().collect();
    entries.sort_by_key(|entry| entry.file_name());
    let text = entries
        .iter()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .find(|entry| is_license_file(&entry.file_name().to_string_lossy()))
        .and_then(|entry| std::fs::read_to_string(entry.path()).ok())
        .map(|text| text.trim_end().to_string());
    (spdx_from(&manifest), text)
}

fn jsr_license(name: &str, version: &str) -> (Option<String>, Option<String>) {
    let Ok(meta) = get(&format!("{JSR_REGISTRY}/{name}/{version}_meta.json"), &[], None) else { return (None, None) };
    if !meta.ok() {
        return (None, None);
    }
    let Ok(meta) = meta.json() else { return (None, None) };
    let file = meta
        .get("manifest")
        .and_then(Value::as_object)
        .and_then(|manifest| manifest.keys().find(|path| is_license_file(path.trim_start_matches('/'))).cloned());
    let Some(file) = file else { return (None, None) };
    match get(&format!("{JSR_REGISTRY}/{name}/{version}{file}"), &[], None) {
        Ok(response) if response.ok() => (None, Some(response.text().trim_end().to_string())),
        _ => (None, None),
    }
}

pub fn record_package_licenses(packages: &[PackageRecord]) -> Vec<Value> {
    packages
        .iter()
        .map(|record| {
            let (license, license_text) = if record.registry == "npm" {
                npm_license(&record.directory)
            } else {
                jsr_license(&record.name, &record.version)
            };
            json!({
                "registry": record.registry,
                "name": record.name,
                "version": record.version,
                "integrity": record.integrity,
                "attestationListed": record.attestation_listed,
                "license": license,
                "licenseText": license_text,
            })
        })
        .collect()
}

pub fn unlicensed_packages(manifest: &Value) -> Vec<String> {
    manifest
        .get("packages")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|entry| entry.get("license").is_none_or(Value::is_null) && entry.get("licenseText").is_none_or(Value::is_null))
        .map(package_id)
        .collect()
}

pub fn dependency_manifest(alias: &str, specifier: &str, packages: Vec<Value>, imp_imports: &[String]) -> Value {
    let now = crate::time::iso_string(crate::time::now_millis());
    let installed_at = format!("{}Z", &now[..19]);
    let mut manifest = Map::new();
    manifest.insert("alias".into(), alias.into());
    manifest.insert("specifier".into(), specifier.into());
    manifest.insert("installedAt".into(), installed_at.into());
    manifest.insert("impImports".into(), json!(imp_imports));
    manifest.insert("packages".into(), Value::Array(packages));
    Value::Object(manifest)
}

pub fn manifest_file_contents(manifest: &Value) -> String {
    format!("{}\n", crate::json::pretty(manifest))
}

pub fn read_dependency_manifest(root: &Path, alias: &str) -> Result<Option<Value>> {
    let path = root.join("dependencies").join(alias).join(DEPENDENCY_MANIFEST_FILE);
    let Ok(text) = std::fs::read_to_string(path) else { return Ok(None) };
    match serde_json::from_str(&text) {
        Ok(value) => Ok(Some(value)),
        Err(_) => bail!("invalid dependencies/{alias}/{DEPENDENCY_MANIFEST_FILE} - not valid JSON"),
    }
}

pub fn recorded_notices(manifests: &[Value]) -> Vec<String> {
    let mut notices: std::collections::BTreeMap<String, String> = Default::default();
    for manifest in manifests {
        for entry in manifest.get("packages").and_then(Value::as_array).into_iter().flatten() {
            let id = package_id(entry);
            let Some(text) = entry.get("licenseText").and_then(Value::as_str).filter(|text| !text.is_empty()) else { continue };
            if notices.contains_key(&id) {
                continue;
            }
            let heading = match entry.get("license").and_then(Value::as_str) {
                Some(license) => format!("{id} - {license}"),
                None => format!("{id} - license not declared"),
            };
            notices.insert(id, format!("{heading}\n\n{text}"));
        }
    }
    notices.into_values().collect()
}
