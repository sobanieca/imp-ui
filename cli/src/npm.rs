use crate::cache_dir::imp_cache_directory;
use crate::http_client::get;
use anyhow::{Context, Result, anyhow, bail};
use base64::Engine;
use serde_json::Value;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub const NPM_REGISTRY: &str = "https://registry.npmjs.org";
const NPM_REGISTRY_HOST: &str = "registry.npmjs.org";

pub const NODE_BUILTINS: &[&str] = &[
    "assert",
    "async_hooks",
    "buffer",
    "child_process",
    "cluster",
    "console",
    "constants",
    "crypto",
    "dgram",
    "diagnostics_channel",
    "dns",
    "domain",
    "events",
    "fs",
    "fs/promises",
    "http",
    "http2",
    "https",
    "inspector",
    "module",
    "net",
    "os",
    "path",
    "path/posix",
    "path/win32",
    "perf_hooks",
    "process",
    "punycode",
    "querystring",
    "readline",
    "repl",
    "stream",
    "stream/promises",
    "stream/web",
    "string_decoder",
    "sys",
    "timers",
    "tls",
    "trace_events",
    "tty",
    "url",
    "util",
    "util/types",
    "v8",
    "vm",
    "wasi",
    "worker_threads",
    "zlib",
];

pub fn is_node_builtin(specifier: &str) -> bool {
    specifier.starts_with("node:") || NODE_BUILTINS.contains(&specifier)
}

pub fn package_url(name: &str) -> String {
    format!("{NPM_REGISTRY}/{}", name.replacen('/', "%2F", 1))
}

#[derive(Debug, Clone)]
pub struct CachedPackage {
    pub name: String,
    pub version: String,
    pub directory: PathBuf,
}

pub struct Npm {
    cache: PathBuf,
    packuments: Mutex<HashMap<String, Arc<Value>>>,
    downloads: Mutex<()>,
}

pub fn shared() -> Result<Arc<Npm>> {
    static SHARED: Mutex<Option<Arc<Npm>>> = Mutex::new(None);
    let mut shared = SHARED.lock().unwrap();
    if let Some(npm) = shared.as_ref() {
        return Ok(npm.clone());
    }
    let npm = Arc::new(Npm {
        cache: imp_cache_directory()?.join("npm"),
        packuments: Mutex::new(HashMap::new()),
        downloads: Mutex::new(()),
    });
    *shared = Some(npm.clone());
    Ok(npm)
}

pub enum PackageError {
    NotFound,
    Status(u16),
}

impl Npm {
    pub fn packument(&self, name: &str) -> Result<Arc<Value>, (PackageError, String)> {
        if let Some(found) = self.packuments.lock().unwrap().get(name) {
            return Ok(found.clone());
        }
        let url = package_url(name);
        let response = get(
            &url,
            &[(
                "accept",
                "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8",
            )],
            None,
        )
        .map_err(|error| (PackageError::Status(0), error.to_string()))?;
        if response.status == 404 {
            return Err((PackageError::NotFound, url));
        }
        if !response.ok() {
            return Err((PackageError::Status(response.status), url));
        }
        let value: Value = response
            .json()
            .map_err(|error| (PackageError::Status(0), error.to_string()))?;
        let value = Arc::new(value);
        self.packuments
            .lock()
            .unwrap()
            .insert(name.to_string(), value.clone());
        Ok(value)
    }

    fn packument_or_error(&self, name: &str) -> Result<Arc<Value>> {
        self.packument(name).map_err(|(kind, detail)| match kind {
            PackageError::NotFound => anyhow!("package not found: npm:{name}"),
            PackageError::Status(0) => {
                anyhow!("failed to resolve npm:{name} - {detail}")
            }
            PackageError::Status(status) => {
                anyhow!("failed to resolve npm:{name} - registry responded {status}")
            }
        })
    }

    pub fn latest_version(&self, name: &str) -> Result<String> {
        let packument = self.packument_or_error(name)?;
        packument
            .pointer("/dist-tags/latest")
            .and_then(Value::as_str)
            .map(String::from)
            .ok_or_else(|| anyhow!("failed to resolve npm:{name} - no latest version published"))
    }

    pub fn resolve_version(&self, name: &str, range: &str) -> Result<String> {
        let packument = self.packument_or_error(name)?;
        let range = range.trim();
        if let Some(tagged) = packument
            .get("dist-tags")
            .and_then(|tags| tags.get(range))
            .and_then(Value::as_str)
        {
            return Ok(tagged.to_string());
        }
        let parsed = nodejs_semver::Range::parse(if range.is_empty() { "*" } else { range })
            .map_err(|_| anyhow!("invalid version range '{range}' for npm:{name}"))?;
        let versions: Vec<nodejs_semver::Version> = packument
            .get("versions")
            .and_then(Value::as_object)
            .map(|versions| {
                versions
                    .keys()
                    .filter_map(|key| nodejs_semver::Version::parse(key).ok())
                    .collect()
            })
            .unwrap_or_default();
        if let Some(latest) = packument
            .pointer("/dist-tags/latest")
            .and_then(Value::as_str)
            && let Ok(latest) = nodejs_semver::Version::parse(latest)
            && latest.satisfies(&parsed)
        {
            return Ok(latest.to_string());
        }
        parsed
            .max_satisfying(&versions)
            .map(|version| version.to_string())
            .ok_or_else(|| anyhow!("no version of npm:{name} matches '{range}'"))
    }

    pub fn version_metadata(&self, name: &str, version: &str) -> Result<Value> {
        let packument = self.packument_or_error(name)?;
        packument
            .get("versions")
            .and_then(|versions| versions.get(version))
            .cloned()
            .ok_or_else(|| anyhow!("npm:{name}@{version} is not published"))
    }

    fn package_directory(&self, name: &str, version: &str) -> PathBuf {
        let mut directory = self.cache.join(NPM_REGISTRY_HOST);
        for part in name.split('/') {
            directory.push(part);
        }
        directory.join(version)
    }

    pub fn ensure(&self, name: &str, version: &str) -> Result<CachedPackage> {
        let directory = self.package_directory(name, version);
        let cached = CachedPackage {
            name: name.to_string(),
            version: version.to_string(),
            directory: directory.clone(),
        };
        if directory.join(".imp-complete").exists() {
            return Ok(cached);
        }
        let _guard = self.downloads.lock().unwrap();
        if directory.join(".imp-complete").exists() {
            return Ok(cached);
        }
        let metadata = self.version_metadata(name, version)?;
        let tarball_url = metadata
            .pointer("/dist/tarball")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("npm:{name}@{version} has no tarball in the registry"))?;
        eprintln!("Download {tarball_url}");
        let response = get(tarball_url, &[], None)?;
        if !response.ok() {
            bail!(
                "could not download {name}@{version} - {tarball_url} responded {}",
                response.status
            );
        }
        if let Some(integrity) = metadata.pointer("/dist/integrity").and_then(Value::as_str)
            && !matches_integrity(integrity, &response.body)
        {
            bail!(
                "integrity check failed for {name}@{version} - the download does not match the hash of the registry"
            );
        }
        let files = tarball_files(&response.body)?;
        let staging = directory.with_extension(format!("tmp-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&staging);
        for (path, bytes) in &files {
            let target = crate::paths::normalize(&staging.join(path));
            if !target.starts_with(&staging) {
                continue;
            }
            std::fs::create_dir_all(target.parent().unwrap())?;
            std::fs::write(&target, bytes)?;
        }
        std::fs::create_dir_all(&staging)?;
        std::fs::write(staging.join(".imp-complete"), "")?;
        let _ = std::fs::remove_dir_all(&directory);
        std::fs::create_dir_all(directory.parent().unwrap())?;
        std::fs::rename(&staging, &directory)
            .with_context(|| format!("could not place {name}@{version} in the package cache"))?;
        Ok(cached)
    }

    pub fn package_of_path(&self, path: &Path) -> Option<CachedPackage> {
        let relative = path.strip_prefix(self.cache.join(NPM_REGISTRY_HOST)).ok()?;
        let parts: Vec<String> = relative
            .components()
            .map(|part| part.as_os_str().to_string_lossy().into_owned())
            .collect();
        let name_parts = if parts.first()?.starts_with('@') {
            2
        } else {
            1
        };
        let name = parts.get(..name_parts)?.join("/");
        let version = parts.get(name_parts)?.clone();
        let directory = self.package_directory(&name, &version);
        Some(CachedPackage {
            name,
            version,
            directory,
        })
    }

    pub fn is_cached_path(&self, path: &Path) -> bool {
        path.starts_with(&self.cache)
    }

    pub fn resolve_npm_specifier(
        &self,
        name: &str,
        range: Option<&str>,
        subpath: &str,
        require: bool,
    ) -> Result<Resolved> {
        let version = self.resolve_version(name, range.unwrap_or("*"))?;
        let package = self.ensure(name, &version)?;
        resolve_in_package(&package.directory, subpath, require)
            .with_context(|| format!("could not resolve npm:{name}@{version}{subpath}"))
    }

    pub fn browser_override(
        &self,
        importer: &Path,
        specifier: &str,
        require: bool,
    ) -> Option<Result<Resolved>> {
        let package = self.package_of_path(importer)?;
        let manifest = read_package_json(&package.directory);
        let target = manifest.get("browser")?.as_object()?.get(specifier)?;
        Some(match target {
            Value::Bool(false) => Ok(Resolved::Empty),
            Value::String(target) if target.starts_with('.') => {
                probe(&package.directory.join(target))
                    .map(Resolved::File)
                    .ok_or_else(|| {
                        anyhow!(
                            "the browser field of {} maps '{specifier}' to a missing {target}",
                            package.name
                        )
                    })
            }
            Value::String(target) => self.resolve_bare_from(importer, target, require),
            _ => return None,
        })
    }

    pub fn browser_file_override(&self, importer: &Path, file: &Path) -> Option<Resolved> {
        let package = self.package_of_path(importer)?;
        let manifest = read_package_json(&package.directory);
        browser_mapping(&manifest, &package.directory, file)
    }

    pub fn resolve_bare_from(
        &self,
        importer: &Path,
        specifier: &str,
        require: bool,
    ) -> Result<Resolved> {
        let package = self
            .package_of_path(importer)
            .ok_or_else(|| anyhow!("'{specifier}' is imported from outside the package cache"))?;
        let (name, subpath) = split_package_specifier(specifier);
        if name == package.name {
            return resolve_in_package(&package.directory, &subpath, require);
        }
        let manifest = read_package_json(&package.directory);
        let range = ["dependencies", "peerDependencies", "optionalDependencies"]
            .iter()
            .find_map(|field| {
                manifest
                    .get(*field)
                    .and_then(|deps| deps.get(&name))
                    .and_then(Value::as_str)
            })
            .unwrap_or("*")
            .to_string();
        let (target_name, range) = match range.strip_prefix("npm:") {
            Some(aliased) => {
                let (alias_name, alias_range) = match aliased.rfind('@') {
                    Some(index) if index > 0 => (
                        aliased[..index].to_string(),
                        aliased[index + 1..].to_string(),
                    ),
                    _ => (aliased.to_string(), "*".to_string()),
                };
                (alias_name, alias_range)
            }
            None => (name.clone(), range),
        };
        let version = self.resolve_version(&target_name, &range)?;
        let dependency = self.ensure(&target_name, &version)?;
        resolve_in_package(&dependency.directory, &subpath, require).with_context(|| {
            format!(
                "could not resolve '{specifier}' from {}@{}",
                package.name, package.version
            )
        })
    }
}

pub fn split_package_specifier(specifier: &str) -> (String, String) {
    let mut parts = specifier.splitn(if specifier.starts_with('@') { 3 } else { 2 }, '/');
    let name = if specifier.starts_with('@') {
        format!(
            "{}/{}",
            parts.next().unwrap_or(""),
            parts.next().unwrap_or("")
        )
    } else {
        parts.next().unwrap_or("").to_string()
    };
    let rest = parts
        .next()
        .map(|rest| format!("/{rest}"))
        .unwrap_or_default();
    (name, rest)
}

pub enum Resolved {
    File(PathBuf),
    Empty,
}

pub fn read_package_json(directory: &Path) -> Value {
    std::fs::read_to_string(directory.join("package.json"))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null)
}

fn conditions(require: bool) -> [&'static str; 4] {
    if require {
        ["browser", "require", "module", "default"]
    } else {
        ["browser", "import", "module", "default"]
    }
}

fn resolve_target(
    target: &Value,
    conditions: &[&str],
    star: Option<&str>,
) -> Option<Option<String>> {
    match target {
        Value::String(text) => Some(Some(match star {
            Some(star) => text.replace('*', star),
            None => text.clone(),
        })),
        Value::Null => Some(None),
        Value::Array(items) => items
            .iter()
            .find_map(|item| resolve_target(item, conditions, star)),
        Value::Object(map) => {
            for (key, value) in map {
                if conditions.contains(&key.as_str())
                    && let Some(found) = resolve_target(value, conditions, star)
                {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

fn match_exports_map(
    map: &serde_json::Map<String, Value>,
    key: &str,
    conditions: &[&str],
) -> Option<Option<String>> {
    if let Some(target) = map.get(key) {
        return resolve_target(target, conditions, None);
    }
    let mut best: Option<(&str, &Value, String)> = None;
    for (pattern, target) in map {
        let Some(star) = pattern.find('*') else {
            continue;
        };
        let (prefix, suffix) = (&pattern[..star], &pattern[star + 1..]);
        if key.starts_with(prefix)
            && key.ends_with(suffix)
            && key.len() >= prefix.len() + suffix.len()
        {
            let captured = key[prefix.len()..key.len() - suffix.len()].to_string();
            if best
                .as_ref()
                .is_none_or(|(current, _, _)| prefix.len() > current.find('*').unwrap_or(0))
            {
                best = Some((pattern, target, captured));
            }
        }
    }
    if let Some((_, target, captured)) = best {
        return resolve_target(target, conditions, Some(&captured));
    }
    for (pattern, target) in map {
        if pattern.ends_with('/')
            && key.starts_with(pattern.as_str())
            && let Some(Some(base)) = resolve_target(target, conditions, None)
        {
            return Some(Some(format!("{base}{}", &key[pattern.len()..])));
        }
    }
    None
}

fn exports_entry(exports: &Value, subpath: &str, conditions: &[&str]) -> Option<Option<String>> {
    let key = if subpath.is_empty() {
        ".".to_string()
    } else {
        format!(".{subpath}")
    };
    match exports {
        Value::Object(map) if map.keys().any(|key| key.starts_with('.')) => {
            match_exports_map(map, &key, conditions)
        }
        other if key == "." => resolve_target(other, conditions, None),
        _ => None,
    }
}

fn probe(path: &Path) -> Option<PathBuf> {
    if path.is_file() {
        return Some(path.to_path_buf());
    }
    for extension in ["js", "mjs", "cjs", "json"] {
        let candidate = PathBuf::from(format!("{}.{extension}", path.display()));
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    if path.is_dir() {
        let manifest = read_package_json(path);
        if let Some(main) = ["browser", "module", "main"]
            .iter()
            .find_map(|field| manifest.get(*field).and_then(Value::as_str))
            && let Some(found) = probe(&path.join(main))
        {
            return Some(found);
        }
        for index in ["index.js", "index.mjs", "index.cjs", "index.json"] {
            if path.join(index).is_file() {
                return Some(path.join(index));
            }
        }
    }
    None
}

fn browser_mapping(manifest: &Value, directory: &Path, file: &Path) -> Option<Resolved> {
    let map = manifest.get("browser")?.as_object()?;
    let relative = format!("./{}", crate::paths::relative_posix(directory, file));
    let without_extension = crate::paths::without_extension(&relative).to_string();
    for (key, value) in map {
        if key == &relative
            || key == &without_extension
            || format!("./{}", key.trim_start_matches("./")) == relative
        {
            return Some(match value {
                Value::Bool(false) => Resolved::Empty,
                Value::String(target) => Resolved::File(probe(&directory.join(target))?),
                _ => return None,
            });
        }
    }
    None
}

pub fn resolve_in_package(directory: &Path, subpath: &str, require: bool) -> Result<Resolved> {
    let manifest = read_package_json(directory);
    let conditions = conditions(require);
    let file = if let Some(exports) = manifest.get("exports").filter(|value| !value.is_null()) {
        match exports_entry(exports, subpath, &conditions) {
            Some(Some(target)) => directory.join(target.trim_start_matches("./")),
            Some(None) => return Ok(Resolved::Empty),
            None => bail!("'.{subpath}' is not exported by the package"),
        }
    } else if subpath.is_empty() {
        let main = manifest
            .get("browser")
            .and_then(Value::as_str)
            .or_else(|| manifest.get("module").and_then(Value::as_str))
            .or_else(|| manifest.get("main").and_then(Value::as_str))
            .unwrap_or("index.js");
        directory.join(main)
    } else {
        directory.join(subpath.trim_start_matches('/'))
    };
    let found = probe(&file).ok_or_else(|| {
        anyhow!(
            "{} does not exist in the package",
            crate::paths::relative_posix(directory, &file)
        )
    })?;
    if let Some(mapped) = browser_mapping(&manifest, directory, &found) {
        return Ok(mapped);
    }
    Ok(Resolved::File(found))
}

pub fn package_imports(directory: &Path, specifier: &str, require: bool) -> Option<Resolved> {
    let manifest = read_package_json(directory);
    let imports = manifest.get("imports")?.as_object()?;
    let target = match_exports_map(imports, specifier, &conditions(require))?;
    Some(match target {
        None => Resolved::Empty,
        Some(target) => Resolved::File(probe(&directory.join(target.trim_start_matches("./")))?),
    })
}

const SRI_STRENGTH: [&str; 4] = ["sha512", "sha384", "sha256", "sha1"];

pub fn strongest_sri(integrity: &str) -> Option<(&'static str, String)> {
    let entries: Vec<&str> = integrity
        .split_whitespace()
        .map(|entry| entry.split('?').next().unwrap_or(""))
        .filter(|entry| {
            entry.contains('-') && SRI_STRENGTH.contains(&entry.split('-').next().unwrap_or(""))
        })
        .collect();
    for algorithm in SRI_STRENGTH {
        if let Some(found) = entries
            .iter()
            .find(|entry| entry.starts_with(&format!("{algorithm}-")))
        {
            return Some((algorithm, found.to_string()));
        }
    }
    None
}

pub fn sri_digest(algorithm: &str, bytes: &[u8]) -> String {
    use sha2::Digest;
    let digest: Vec<u8> = match algorithm {
        "sha512" => sha2::Sha512::digest(bytes).to_vec(),
        "sha384" => sha2::Sha384::digest(bytes).to_vec(),
        "sha256" => sha2::Sha256::digest(bytes).to_vec(),
        _ => sha1::Sha1::digest(bytes).to_vec(),
    };
    format!(
        "{algorithm}-{}",
        base64::engine::general_purpose::STANDARD.encode(digest)
    )
}

pub fn matches_integrity(integrity: &str, bytes: &[u8]) -> bool {
    match strongest_sri(integrity) {
        Some((algorithm, expected)) => sri_digest(algorithm, bytes) == expected,
        None => false,
    }
}

pub fn tarball_files(tarball: &[u8]) -> Result<Vec<(String, Vec<u8>)>> {
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(tarball));
    let mut files = Vec::new();
    for entry in archive.entries()? {
        let mut entry = entry?;
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let path = entry.path()?.to_string_lossy().replace('\\', "/");
        let without_root = match path.find('/') {
            Some(index) => path[index + 1..].to_string(),
            None => path,
        };
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes)?;
        files.push((without_root, bytes));
    }
    Ok(files)
}
