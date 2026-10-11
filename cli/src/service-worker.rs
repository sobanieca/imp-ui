use crate::bundler::{Assets, Format, ImpLibrary, Options, VirtualModule, bundle};
use crate::environments::Env;
use crate::flags::Flags;
use anyhow::{Result, bail};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const SERVICE_WORKER_PATH: &str = "/sw.js";
pub const WORKER_ENTRY: &str = "imp-worker-entry";
const DEV_ENTRY_SOURCE: &str =
    "import { startDevMode } from 'imp/service-worker'\nstartDevMode()\n";
pub const OFFLINE_WORKER_SOURCE: &str =
    "import { precacheBuild } from 'imp/service-worker'\nprecacheBuild()\n";

pub fn runtime_values(env: &Env, flags: &Flags) -> String {
    let mut lines = String::new();
    if !env.is_empty() {
        lines.push_str(&format!(
            "globalThis.__IMP_ENV__ = {};\n",
            serde_json::to_string(&Value::Object(env.clone())).unwrap()
        ));
    }
    if !flags.is_empty() {
        lines.push_str(&format!(
            "globalThis.__IMP_FLAGS__ = {};\n",
            serde_json::to_string(&Value::Object(flags.clone())).unwrap()
        ));
    }
    lines
}

pub fn assert_service_worker_source(path: &Path, declared: &str) -> Result<()> {
    match std::fs::metadata(path) {
        Err(_) => bail!("serviceWorker - {declared} does not exist"),
        Ok(meta) if !meta.is_file() => bail!("serviceWorker - {declared} is not a file"),
        Ok(_) => Ok(()),
    }
}

pub fn assemble_service_worker(
    worker: &str,
    mock_endpoint: Option<&str>,
    env: &Env,
    flags: &Flags,
) -> String {
    let mock = mock_endpoint
        .map(|endpoint| {
            format!(
                "globalThis.__IMP_MOCK_ENDPOINT__ = {};\n",
                serde_json::to_string(endpoint).unwrap()
            )
        })
        .unwrap_or_default();
    format!("{}{mock}{worker}", runtime_values(env, flags))
}

pub fn precache_values(precache: &Value) -> String {
    format!(
        "globalThis.__IMP_PRECACHE__ = {};\n",
        serde_json::to_string(precache).unwrap()
    )
}

const HOST_FILES: [&str; 8] = [
    "404.html",
    "CNAME",
    "_headers",
    "_redirects",
    "_routes.json",
    "netlify.toml",
    "staticwebapp.config.json",
    "vercel.json",
];

pub fn precached_public_file(name: &str) -> bool {
    !HOST_FILES.contains(&name) && !name.split('/').any(|part| part.starts_with('.'))
}

pub fn precache_url(base: &str, name: &str) -> String {
    let encoded: Vec<String> = name.split('/').map(encode_uri_component).collect();
    format!("{base}/{}", encoded.join("/"))
}

pub fn encode_uri_component(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

pub fn worker_entry(options: &mut Options, root: &Path, source: &str) {
    options.virtual_modules.insert(
        WORKER_ENTRY.into(),
        VirtualModule {
            code: source.to_string(),
            resolve_dir: root.to_path_buf(),
        },
    );
}

fn bundle_dev_worker(
    root: &Path,
    entry: Option<&Path>,
    dependencies: &[String],
) -> Result<(String, Vec<PathBuf>), String> {
    let mut options = Options::new(root);
    worker_entry(&mut options, root, DEV_ENTRY_SOURCE);
    options.entries.push((
        None,
        entry
            .map(|entry| entry.to_string_lossy().into_owned())
            .unwrap_or_else(|| WORKER_ENTRY.into()),
    ));
    options.dependencies = dependencies.to_vec();
    options.imp = ImpLibrary::Tooling;
    options.format = Format::Iife;
    options.assets = Assets::DataUrl;
    let bundled = bundle(options).map_err(|error| error.describe())?;
    Ok((bundled.entry_code().to_string(), bundled.file_inputs()))
}

pub fn stamp_of(files: &[PathBuf]) -> String {
    files
        .iter()
        .map(|file| match std::fs::metadata(file) {
            Ok(meta) => {
                let modified = meta
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|elapsed| elapsed.as_millis())
                    .unwrap_or(0);
                format!("{}:{modified}:{}", file.display(), meta.len())
            }
            Err(_) => format!("{}:missing", file.display()),
        })
        .collect::<Vec<_>>()
        .join("|")
}

#[derive(Clone)]
pub struct WorkerState {
    pub key: String,
    pub inputs: Vec<PathBuf>,
    pub source: String,
    pub problem: Option<String>,
    pub changed: bool,
}

pub struct WorkerBundler {
    root: PathBuf,
    entry: Option<PathBuf>,
    dependencies: Vec<String>,
    cache: Mutex<Option<WorkerState>>,
}

impl WorkerBundler {
    pub fn new(root: &Path, entry: Option<PathBuf>, dependencies: Vec<String>) -> WorkerBundler {
        WorkerBundler {
            root: root.to_path_buf(),
            entry,
            dependencies,
            cache: Mutex::new(None),
        }
    }

    fn current(&self, cached: Option<&WorkerState>) -> WorkerState {
        if let Some(cache) = cached {
            if self.entry.is_none() || cache.key == stamp_of(&cache.inputs) {
                return cache.clone();
            }
        }
        match bundle_dev_worker(&self.root, self.entry.as_deref(), &self.dependencies) {
            Ok((source, inputs)) => {
                let files: Vec<PathBuf> = match &self.entry {
                    Some(entry) => std::iter::once(entry.clone())
                        .chain(inputs.into_iter().filter(|input| input != entry))
                        .collect(),
                    None => Vec::new(),
                };
                WorkerState {
                    key: stamp_of(&files),
                    inputs: files,
                    source,
                    problem: None,
                    changed: false,
                }
            }
            Err(problem) => {
                let inputs: Vec<PathBuf> = self.entry.iter().cloned().collect();
                WorkerState {
                    key: if self.entry.is_some() {
                        format!("{}!", stamp_of(&inputs))
                    } else {
                        String::new()
                    },
                    inputs,
                    source: String::new(),
                    problem: Some(problem),
                    changed: false,
                }
            }
        }
    }

    pub fn build(&self) -> WorkerState {
        let mut cache = self.cache.lock().unwrap();
        let mut state = self.current(cache.as_ref());
        state.changed =
            cache.as_ref().map(|cached| cached.key.as_str()) != Some(state.key.as_str());
        *cache = Some(state.clone());
        state
    }
}
