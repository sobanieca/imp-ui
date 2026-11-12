use crate::embedded;
use crate::flags::{Flags, fold_flag_calls};
use crate::npm::{self, Resolved};
use crate::paths::{normalize, relative_posix};
use crate::specifiers::{
    imp_module, imp_subpath_problem, imp_tooling_module, imp_tooling_only_problem, parse_specifier,
};
use anyhow::{Result, anyhow};
use arcstr::ArcStr;
use rolldown::{BundlerOptions, InputItem, OutputFormat, Platform};
use rolldown_common::side_effects::HookSideEffects;
use rolldown_common::{EmittedAsset, ImportKind, ModuleType, Output, StrOrBytes};
use rolldown_plugin::{
    HookLoadArgs, HookLoadOutput, HookLoadReturn, HookRenderChunkArgs, HookRenderChunkOutput,
    HookRenderChunkReturn, HookResolveIdArgs, HookResolveIdOutput, HookResolveIdReturn,
    HookTransformArgs, HookTransformReturn, HookUsage, Plugin, PluginContext, PluginHookMeta,
    PluginOrder, SharedLoadPluginContext, SharedTransformPluginContext,
};
use std::borrow::Cow;
use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

pub const EMBEDDED_PREFIX: &str = "\0imp-embedded:";
pub const VIRTUAL_PREFIX: &str = "\0imp-virtual:";
const EMPTY_MODULE: &str = "\0imp-empty";
const ASSET_PREFIX: &str = "__IMP_ASSET__#";

pub const BINARY_ASSET_EXTENSIONS: [&str; 10] = [
    "wasm", "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "woff", "woff2",
];
const TEXT_ASSET_EXTENSIONS: [&str; 2] = ["css", "txt"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImpLibrary {
    Bundled,
    Tooling,
    External,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Assets {
    Files,
    DataUrl,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Esm,
    Iife,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LegalComments {
    None,
    Inline,
    External,
}

#[derive(Clone)]
pub struct VirtualModule {
    pub code: String,
    pub resolve_dir: PathBuf,
}

pub struct Mock {
    pub real_file: PathBuf,
    pub code: String,
}

pub struct Options {
    pub root: PathBuf,
    pub entries: Vec<(Option<String>, String)>,
    pub virtual_modules: HashMap<String, VirtualModule>,
    pub dependencies: Vec<String>,
    pub imp: ImpLibrary,
    pub mocks: HashMap<String, Mock>,
    pub appended: HashMap<PathBuf, String>,
    pub embedded_aliases: HashMap<String, String>,
    pub flags: Option<Flags>,
    pub reject_css: bool,
    pub format: Format,
    pub minify: bool,
    pub assets: Assets,
    pub legal_comments: LegalComments,
    pub define: Vec<(String, String)>,
    pub entry_names: String,
    pub chunk_names: String,
    pub asset_names: String,
    pub public_path: Option<String>,
    pub external_imp: bool,
    pub externals: Vec<String>,
    pub split: bool,
    /// Replaces the developer messages of the imp library (`impLogger.warn` and `impLogger.debug`)
    /// with `void 0`, for a production bundle.
    pub strip_dev_logs: bool,
}

impl Options {
    pub fn new(root: &Path) -> Options {
        Options {
            root: root.to_path_buf(),
            entries: Vec::new(),
            virtual_modules: HashMap::new(),
            dependencies: Vec::new(),
            imp: ImpLibrary::Tooling,
            mocks: HashMap::new(),
            appended: HashMap::new(),
            embedded_aliases: HashMap::new(),
            flags: None,
            reject_css: false,
            format: Format::Esm,
            minify: false,
            assets: Assets::DataUrl,
            legal_comments: LegalComments::None,
            define: Vec::new(),
            entry_names: "[name].js".into(),
            chunk_names: "[name]-[hash].js".into(),
            asset_names: "[name]-[hash][extname]".into(),
            public_path: None,
            external_imp: false,
            externals: Vec::new(),
            split: false,
            strip_dev_logs: false,
        }
    }

    pub fn entry(mut self, id: impl Into<String>) -> Options {
        self.entries.push((None, id.into()));
        self
    }
}

#[derive(Debug, Clone)]
pub struct Chunk {
    pub file_name: String,
    pub code: String,
    pub is_entry: bool,
    pub facade_module_id: Option<String>,
    pub imports: Vec<String>,
    pub dynamic_imports: Vec<String>,
    pub exports: Vec<String>,
    pub module_ids: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Asset {
    pub file_name: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Default)]
pub struct Bundle {
    pub chunks: Vec<Chunk>,
    pub assets: Vec<Asset>,
    pub inputs: Vec<String>,
    pub legal: Vec<String>,
    pub external_imports: Vec<String>,
}

impl Bundle {
    pub fn entry_code(&self) -> &str {
        self.chunks
            .iter()
            .find(|chunk| chunk.is_entry)
            .map(|chunk| chunk.code.as_str())
            .unwrap_or("")
    }

    pub fn file_inputs(&self) -> Vec<PathBuf> {
        self.inputs
            .iter()
            .filter(|input| Path::new(input).is_absolute())
            .map(PathBuf::from)
            .collect()
    }

    pub fn bundles_imp_library(&self) -> bool {
        self.inputs
            .iter()
            .any(|input| input.starts_with(&format!("{EMBEDDED_PREFIX}lib/src/")))
    }
}

#[derive(Debug)]
pub struct BundleError {
    pub problems: Vec<Problem>,
}

#[derive(Debug, Clone)]
pub struct Problem {
    pub file: Option<String>,
    pub text: String,
}

impl std::fmt::Display for BundleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let count = self.problems.len();
        writeln!(
            f,
            "Build failed with {count} error{}:",
            if count == 1 { "" } else { "s" }
        )?;
        let lines: Vec<String> = self
            .problems
            .iter()
            .map(|problem| match &problem.file {
                Some(file) => format!("{file}: ERROR: {}", problem.text),
                None => format!("error: {}", problem.text),
            })
            .collect();
        write!(f, "{}", lines.join("\n"))
    }
}

impl std::error::Error for BundleError {}

impl BundleError {
    pub fn describe(&self) -> String {
        self.problems
            .iter()
            .map(|problem| match &problem.file {
                Some(file) => format!("{file} - {}", problem.text),
                None => problem.text.clone(),
            })
            .collect::<Vec<_>>()
            .join("; ")
    }
}

#[derive(Default)]
struct State {
    inputs: BTreeSet<String>,
    legal: HashMap<String, Vec<String>>,
    errors: Vec<Problem>,
}

#[derive(Debug)]
struct ImpPlugin {
    config: Arc<PluginConfig>,
    state: Arc<Mutex<StateHolder>>,
}

#[derive(Default)]
struct StateHolder(State);

impl std::fmt::Debug for StateHolder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("State")
    }
}

#[derive(Debug)]
struct PluginConfig {
    root: PathBuf,
    dependencies: Vec<String>,
    imp: ImpLibrary,
    virtual_modules: HashMap<String, (String, PathBuf)>,
    mocks: HashMap<String, (PathBuf, String)>,
    appended: HashMap<PathBuf, String>,
    embedded_aliases: HashMap<String, String>,
    flags: Option<Flags>,
    reject_css: bool,
    assets: Assets,
    legal_external: bool,
    public_path: Option<String>,
    externals: Vec<String>,
    strip_dev_logs: bool,
}

fn runtime() -> &'static tokio::runtime::Runtime {
    static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("an async runtime for the bundler")
    })
}

fn join_embedded(importer: &str, specifier: &str) -> String {
    let mut parts: Vec<&str> = importer.split('/').collect();
    parts.pop();
    for segment in specifier.split('/') {
        match segment {
            "." | "" => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }
    parts.join("/")
}

pub fn embedded_id(path: &str) -> String {
    format!("{EMBEDDED_PREFIX}{path}")
}

pub fn imp_library_id(specifier: &str) -> Option<String> {
    imp_module(specifier).map(|file| embedded_id(&format!("lib/src/{file}")))
}

pub fn resolve_module_file(candidate: &Path) -> Option<PathBuf> {
    let mut attempts = vec![candidate.to_path_buf()];
    if candidate.extension().is_none() {
        for extension in ["js", "mjs"] {
            attempts.push(PathBuf::from(format!(
                "{}.{extension}",
                candidate.display()
            )));
        }
        for extension in ["js", "mjs"] {
            attempts.push(candidate.join(format!("index.{extension}")));
        }
    }
    attempts
        .into_iter()
        .find(|attempt| attempt.is_file())
        .map(|found| crate::paths::canonical(&found).unwrap_or(found))
}

fn is_relative(specifier: &str) -> bool {
    specifier.starts_with("./")
        || specifier.starts_with("../")
        || specifier == "."
        || specifier == ".."
}

fn extension_of(id: &str) -> String {
    let clean = id.split(['?', '#']).next().unwrap_or(id);
    Path::new(clean)
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn mime_of(extension: &str) -> &'static str {
    match extension {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        "css" => "text/css",
        "txt" => "text/plain",
        _ => "application/octet-stream",
    }
}

fn data_url(extension: &str, bytes: &[u8]) -> String {
    use base64::Engine;
    let mime = mime_of(extension);
    if let Ok(text) = std::str::from_utf8(bytes)
        && matches!(extension, "svg" | "css" | "txt")
    {
        return format!("data:{mime};charset=utf-8,{}", percent_encode(text));
    }
    format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )
}

fn percent_encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b' '
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')'
            | b'/'
            | b':'
            | b'='
            | b','
            | b';'
            | b'@'
            | b'+'
            | b'$'
            | b'&'
            | b'?' => out.push(byte as char),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn legal_comments_in(source: &str) -> Vec<String> {
    let allocator = oxc::allocator::Allocator::default();
    let parsed = oxc::parser::Parser::new(&allocator, source, oxc::span::SourceType::mjs()).parse();
    parsed
        .program
        .comments
        .iter()
        .filter_map(|comment| {
            let text = &source[comment.span.start as usize..comment.span.end as usize];
            let body = &text[2..];
            let legal =
                body.starts_with('!') || text.contains("@license") || text.contains("@preserve");
            legal.then(|| text.trim().to_string())
        })
        .collect()
}

impl ImpPlugin {
    fn record_error(&self, importer: Option<&str>, text: String) -> anyhow::Error {
        let file = importer.map(|importer| self.display_id(importer));
        self.state.lock().unwrap().0.errors.push(Problem {
            file: file.clone(),
            text: text.clone(),
        });
        anyhow!(text)
    }

    fn record_import_error(
        &self,
        importer: Option<&str>,
        specifier: &str,
        text: String,
    ) -> anyhow::Error {
        let location = importer.and_then(|importer| self.import_location(importer, specifier));
        let file = importer.map(|importer| match location {
            Some((line, column)) => format!("{}:{line}:{column}", self.display_id(importer)),
            None => self.display_id(importer),
        });
        self.state.lock().unwrap().0.errors.push(Problem {
            file,
            text: text.clone(),
        });
        anyhow!(text)
    }

    fn import_location(&self, importer: &str, specifier: &str) -> Option<(usize, usize)> {
        let source = match importer.strip_prefix(VIRTUAL_PREFIX) {
            Some(key) => self.config.virtual_modules.get(key)?.0.clone(),
            None if Path::new(importer).is_absolute() => std::fs::read_to_string(importer).ok()?,
            None => return None,
        };
        let offset = ['\'', '"', '`']
            .iter()
            .filter_map(|quote| source.find(&format!("{quote}{specifier}{quote}")))
            .min()?;
        let before = &source[..offset];
        let line = before.matches('\n').count() + 1;
        let column = before.len() - before.rfind('\n').map_or(0, |index| index + 1);
        Some((line, column))
    }

    fn display_id(&self, id: &str) -> String {
        if let Some(path) = id.strip_prefix(EMBEDDED_PREFIX) {
            return format!("imp:{path}");
        }
        if let Some(key) = id.strip_prefix(VIRTUAL_PREFIX) {
            return key.to_string();
        }
        let path = Path::new(id);
        if path.is_absolute() {
            let relative = relative_posix(&self.config.root, path);
            if !relative.starts_with("..") {
                return relative;
            }
            return crate::paths::posix(path);
        }
        id.to_string()
    }

    fn is_external(&self, specifier: &str) -> bool {
        self.config.externals.iter().any(|external| {
            if external == "node:*" {
                return npm::is_node_builtin(specifier);
            }
            specifier == external || specifier.starts_with(&format!("{external}/"))
        })
    }

    fn resolve_imp(
        &self,
        specifier: &str,
        importer: Option<&str>,
    ) -> Result<Option<HookResolveIdOutput>> {
        if !(specifier == "imp" || specifier.starts_with("imp/")) {
            return Ok(None);
        }
        if self.config.imp == ImpLibrary::External {
            return Ok(Some(HookResolveIdOutput {
                id: specifier.into(),
                external: Some(rolldown_common::ResolvedExternal::Bool(true)),
                ..Default::default()
            }));
        }
        if let Some(id) = imp_library_id(specifier) {
            return Ok(Some(HookResolveIdOutput::from_id(id)));
        }
        if let Some((file, _)) = imp_tooling_module(specifier) {
            if self.config.imp == ImpLibrary::Tooling {
                return Ok(Some(HookResolveIdOutput::from_id(embedded_id(file))));
            }
            return Err(self.record_import_error(
                importer,
                specifier,
                imp_tooling_only_problem(specifier),
            ));
        }
        Err(self.record_import_error(importer, specifier, imp_subpath_problem(specifier)))
    }

    fn resolve_file(&self, path: &Path) -> Option<String> {
        resolve_module_file(path).map(|found| found.to_string_lossy().into_owned())
    }

    async fn resolve(
        &self,
        ctx: &PluginContext,
        args: &HookResolveIdArgs<'_>,
    ) -> HookResolveIdReturn {
        let specifier = args.specifier;
        let importer = args.importer;
        let require = matches!(args.kind, ImportKind::Require);
        if self.is_external(specifier) {
            return Ok(Some(HookResolveIdOutput {
                id: specifier.into(),
                external: Some(rolldown_common::ResolvedExternal::Bool(true)),
                ..Default::default()
            }));
        }
        if self.config.virtual_modules.contains_key(specifier) {
            return Ok(Some(HookResolveIdOutput::from_id(format!(
                "{VIRTUAL_PREFIX}{specifier}"
            ))));
        }
        if let Some(path) = self.config.embedded_aliases.get(specifier) {
            return Ok(Some(HookResolveIdOutput::from_id(embedded_id(path))));
        }
        if let Some(found) = self.resolve_imp(specifier, importer)? {
            return Ok(Some(found));
        }
        let mocked_by_itself = |key: &str| importer == Some(format!("\0imp-mock:{key}").as_str());
        if self.config.mocks.contains_key(specifier) && !mocked_by_itself(specifier) {
            return Ok(Some(HookResolveIdOutput::from_id(format!(
                "\0imp-mock:{specifier}"
            ))));
        }
        if let Some(importer_path) =
            importer.and_then(|importer| importer.strip_prefix(EMBEDDED_PREFIX))
            && is_relative(specifier)
        {
            return Ok(Some(HookResolveIdOutput::from_id(embedded_id(
                &join_embedded(importer_path, specifier),
            ))));
        }
        let resolve_dir = match importer {
            Some(importer) if importer.starts_with(VIRTUAL_PREFIX) => {
                let key = &importer[VIRTUAL_PREFIX.len()..];
                self.config
                    .virtual_modules
                    .get(key)
                    .map(|(_, dir)| dir.clone())
            }
            Some(importer) if importer.starts_with("\0imp-mock:") => Some(self.config.root.clone()),
            Some(importer) if Path::new(importer).is_absolute() => {
                Path::new(importer).parent().map(Path::to_path_buf)
            }
            _ => Some(self.config.root.clone()),
        };
        if is_relative(specifier) || Path::new(specifier).is_absolute() {
            let Some(dir) = resolve_dir.clone() else {
                return Ok(None);
            };
            let candidate = normalize(&dir.join(specifier));
            if let Some(found) = self.resolve_file(&candidate) {
                if let Some(importer_path) =
                    importer.map(Path::new).filter(|path| path.is_absolute())
                {
                    let npm = npm::shared()?;
                    if npm.is_cached_path(importer_path)
                        && let Some(resolved) =
                            npm.browser_file_override(importer_path, Path::new(&found))
                    {
                        return Ok(Some(self.resolved_output(resolved)));
                    }
                }
                if self.config.mocks.contains_key(&found) && !mocked_by_itself(&found) {
                    return Ok(Some(HookResolveIdOutput::from_id(format!(
                        "\0imp-mock:{found}"
                    ))));
                }
                if self.config.reject_css && found.ends_with(".css") {
                    return Err(self.record_import_error(
                        importer,
                        specifier,
                        css_import_message(
                            &importer
                                .map(|importer| self.display_id(importer))
                                .unwrap_or_else(|| "a script".into()),
                            specifier,
                        ),
                    ));
                }
                return Ok(Some(HookResolveIdOutput::from_id(found)));
            }
            if self.config.reject_css && specifier.ends_with(".css") {
                return Err(self.record_import_error(
                    importer,
                    specifier,
                    css_import_message(
                        &importer
                            .map(|importer| self.display_id(importer))
                            .unwrap_or_else(|| "a script".into()),
                        specifier,
                    ),
                ));
            }
            if importer.is_some_and(|importer| {
                importer.starts_with(VIRTUAL_PREFIX) || importer.starts_with("\0imp-mock:")
            }) {
                return Err(self.record_import_error(
                    importer,
                    specifier,
                    format!("Could not resolve \"{specifier}\""),
                ));
            }
            return Ok(None);
        }
        if self.config.reject_css && specifier.ends_with(".css") {
            return Err(self.record_import_error(
                importer,
                specifier,
                css_import_message(
                    &importer
                        .map(|importer| self.display_id(importer))
                        .unwrap_or_else(|| "a script".into()),
                    specifier,
                ),
            ));
        }
        if self
            .config
            .dependencies
            .iter()
            .any(|alias| alias == specifier)
        {
            let path = self
                .config
                .root
                .join("dependencies")
                .join(specifier)
                .join(format!("{specifier}.js"));
            if !path.is_file() {
                return Err(self.record_import_error(
                    importer,
                    specifier,
                    format!(
                        "dependency '{specifier}' is declared but not vendored - run 'imp install'"
                    ),
                ));
            }
            return Ok(Some(HookResolveIdOutput::from_id(
                path.to_string_lossy().into_owned(),
            )));
        }
        if let Some(parsed) = parse_specifier(specifier).filter(|parsed| parsed.npm_prefix) {
            let npm = npm::shared()?;
            let resolved = tokio::task::block_in_place(|| {
                npm.resolve_npm_specifier(
                    &parsed.name,
                    parsed.version.as_deref(),
                    &parsed.subpath,
                    require,
                )
            })
            .map_err(|error| self.record_import_error(importer, specifier, format!("{error:#}")))?;
            return Ok(Some(self.resolved_output(resolved)));
        }
        if let Some(importer_path) = importer.map(Path::new).filter(|path| path.is_absolute()) {
            let npm = npm::shared()?;
            if npm.is_cached_path(importer_path) {
                if let Some(overridden) = tokio::task::block_in_place(|| {
                    npm.browser_override(importer_path, specifier, require)
                }) {
                    let resolved = overridden.map_err(|error| {
                        self.record_import_error(importer, specifier, format!("{error:#}"))
                    })?;
                    return Ok(Some(self.resolved_output(resolved)));
                }
                if npm::is_node_builtin(specifier) {
                    return Err(self.record_error(
                        importer,
                        format!(
                            "\"{specifier}\" is built into Node.js, and imp bundles for the browser"
                        ),
                    ));
                }
                if specifier.starts_with('#')
                    && let Some(package) = npm.package_of_path(importer_path)
                    && let Some(resolved) =
                        npm::package_imports(&package.directory, specifier, require)
                {
                    return Ok(Some(self.resolved_output(resolved)));
                }
                let resolved = tokio::task::block_in_place(|| {
                    npm.resolve_bare_from(importer_path, specifier, require)
                })
                .map_err(|error| {
                    self.record_import_error(importer, specifier, format!("{error:#}"))
                })?;
                return Ok(Some(self.resolved_output(resolved)));
            }
        }
        let _ = ctx;
        Ok(None)
    }

    fn resolved_output(&self, resolved: Resolved) -> HookResolveIdOutput {
        match resolved {
            Resolved::File(path) => {
                HookResolveIdOutput::from_id(path.to_string_lossy().into_owned())
            }
            Resolved::Empty => HookResolveIdOutput::from_id(EMPTY_MODULE),
        }
    }

    fn load_code(&self, ctx: &SharedLoadPluginContext, id: &str) -> Result<Option<HookLoadOutput>> {
        if id == EMPTY_MODULE {
            return Ok(Some(HookLoadOutput {
                code: "export default {}".into(),
                ..Default::default()
            }));
        }
        if let Some(path) = id.strip_prefix(EMBEDDED_PREFIX) {
            let code = embedded::text(path)
                .ok_or_else(|| anyhow!("{path} is not embedded in this imp build"))?;
            self.state.lock().unwrap().0.inputs.insert(id.to_string());
            let library = path.starts_with("lib/src/");
            let code = if self.config.strip_dev_logs && library {
                crate::dev_logs::strip(code)
            } else {
                code.to_string()
            };
            return Ok(Some(HookLoadOutput {
                code: code.into(),
                module_type: Some(ModuleType::Js),
                // A module of the library runs no code on import. So a module that a barrel
                // re-exports, and that the app never names, stays out of the bundle.
                side_effects: library.then_some(HookSideEffects::False),
                ..Default::default()
            }));
        }
        if let Some(key) = id.strip_prefix(VIRTUAL_PREFIX) {
            self.state.lock().unwrap().0.inputs.insert(id.to_string());
            let (code, _) = &self.config.virtual_modules[key];
            let code = match &self.config.flags {
                Some(flags) => fold_flag_calls(code, flags, key)
                    .map_err(|error| self.record_error(None, error.to_string()))?,
                None => code.clone(),
            };
            return Ok(Some(HookLoadOutput {
                code: code.into(),
                module_type: Some(ModuleType::Js),
                ..Default::default()
            }));
        }
        if let Some(key) = id.strip_prefix("\0imp-mock:") {
            let (_, code) = &self.config.mocks[key];
            return Ok(Some(HookLoadOutput {
                code: code.clone().into(),
                module_type: Some(ModuleType::Js),
                ..Default::default()
            }));
        }
        let path = Path::new(id.split(['?', '#']).next().unwrap_or(id));
        if !path.is_absolute() {
            return Ok(None);
        }
        self.state.lock().unwrap().0.inputs.insert(id.to_string());
        let extension = extension_of(id);
        let binary = BINARY_ASSET_EXTENSIONS.contains(&extension.as_str());
        let text_asset = TEXT_ASSET_EXTENSIONS.contains(&extension.as_str());
        if binary
            || (self.config.assets == Assets::DataUrl && text_asset && !self.config.reject_css)
        {
            let bytes = std::fs::read(path)?;
            let code = match self.config.assets {
                Assets::DataUrl => format!(
                    "export default {}",
                    serde_json::to_string(&data_url(&extension, &bytes))?
                ),
                Assets::Files => {
                    let name = path
                        .file_name()
                        .map(|name| name.to_string_lossy().into_owned());
                    let reference = ctx.emit_file(
                        EmittedAsset {
                            name: name.clone(),
                            original_file_name: Some(id.to_string()),
                            file_name: None,
                            source: StrOrBytes::Bytes(bytes),
                        },
                        None,
                        None,
                    )?;
                    format!("export default \"{ASSET_PREFIX}{reference}\"")
                }
            };
            return Ok(Some(HookLoadOutput {
                code: code.into(),
                module_type: Some(ModuleType::Js),
                ..Default::default()
            }));
        }
        if let Some(extra) = self.config.appended.get(path) {
            let source = std::fs::read_to_string(path)?;
            return Ok(Some(HookLoadOutput {
                code: format!("{source}{extra}").into(),
                module_type: Some(ModuleType::Js),
                ..Default::default()
            }));
        }
        if matches!(extension.as_str(), "js" | "mjs" | "cjs")
            && let Some(flags) = &self.config.flags
        {
            let source = std::fs::read_to_string(path)?;
            let file = self.display_id(id);
            let folded = fold_flag_calls(&source, flags, &file)
                .map_err(|error| self.record_error(None, error.to_string()))?;
            if folded != source {
                return Ok(Some(HookLoadOutput {
                    code: folded.into(),
                    module_type: Some(ModuleType::Js),
                    ..Default::default()
                }));
            }
        }
        Ok(None)
    }
}

fn css_import_message(importer: &str, specifier: &str) -> String {
    format!(
        "{importer} imports '{specifier}' - a script cannot import CSS. A component carries its styles in its 'styles', and a page links a stylesheet from public/ with <link rel=\"stylesheet\">"
    )
}

impl Plugin for ImpPlugin {
    fn name(&self) -> Cow<'static, str> {
        Cow::Borrowed("imp")
    }

    fn register_hook_usage(&self) -> HookUsage {
        HookUsage::ResolveId | HookUsage::Load | HookUsage::Transform | HookUsage::RenderChunk
    }

    fn resolve_id_meta(&self) -> Option<PluginHookMeta> {
        Some(PluginHookMeta {
            order: Some(PluginOrder::Pre),
        })
    }

    fn load_meta(&self) -> Option<PluginHookMeta> {
        Some(PluginHookMeta {
            order: Some(PluginOrder::Pre),
        })
    }

    async fn resolve_id(
        &self,
        ctx: &PluginContext,
        args: &HookResolveIdArgs<'_>,
    ) -> HookResolveIdReturn {
        self.resolve(ctx, args).await
    }

    async fn load(&self, ctx: SharedLoadPluginContext, args: &HookLoadArgs<'_>) -> HookLoadReturn {
        self.load_code(&ctx, args.id)
    }

    async fn transform(
        &self,
        _ctx: SharedTransformPluginContext,
        args: &HookTransformArgs<'_>,
    ) -> HookTransformReturn {
        if self.config.legal_external
            && matches!(
                args.module_type,
                ModuleType::Js | ModuleType::Jsx | ModuleType::Ts | ModuleType::Tsx
            )
        {
            let comments = legal_comments_in(args.code);
            if !comments.is_empty() {
                self.state
                    .lock()
                    .unwrap()
                    .0
                    .legal
                    .insert(args.id.to_string(), comments);
            }
        }
        Ok(None)
    }

    async fn render_chunk(
        &self,
        ctx: &PluginContext,
        args: &HookRenderChunkArgs<'_>,
    ) -> HookRenderChunkReturn {
        if !args.code.contains(ASSET_PREFIX) {
            return Ok(None);
        }
        let mut code = String::with_capacity(args.code.len());
        let mut rest = args.code.as_str();
        while let Some(index) = rest.find(ASSET_PREFIX) {
            code.push_str(&rest[..index]);
            let after = &rest[index + ASSET_PREFIX.len()..];
            let end = after.find(['"', '\'']).unwrap_or(after.len());
            let reference = &after[..end];
            let file_name = ctx.get_file_name(reference)?;
            match &self.config.public_path {
                Some(public) => code.push_str(&format!("{public}{file_name}")),
                None => code.push_str(&format!(
                    "./{}",
                    relative_from_chunk(&args.chunk.filename, &file_name)
                )),
            }
            rest = &after[end..];
        }
        code.push_str(rest);
        Ok(Some(HookRenderChunkOutput {
            code,
            map: Default::default(),
        }))
    }
}

fn relative_from_chunk(chunk: &str, asset: &str) -> String {
    let chunk_dir: Vec<&str> = chunk.split('/').collect();
    let chunk_dir = &chunk_dir[..chunk_dir.len() - 1];
    let asset_parts: Vec<&str> = asset.split('/').collect();
    let common = chunk_dir
        .iter()
        .zip(&asset_parts)
        .take_while(|(a, b)| a == b)
        .count();
    let mut parts: Vec<&str> = vec![".."; chunk_dir.len() - common];
    parts.extend(&asset_parts[common..]);
    parts.join("/")
}

pub fn bundle(options: Options) -> Result<Bundle, BundleError> {
    let state = Arc::new(Mutex::new(StateHolder::default()));
    let plugin = ImpPlugin {
        config: Arc::new(PluginConfig {
            root: options.root.clone(),
            dependencies: options.dependencies.clone(),
            imp: if options.external_imp {
                ImpLibrary::External
            } else {
                options.imp
            },
            virtual_modules: options
                .virtual_modules
                .iter()
                .map(|(key, module)| {
                    (
                        key.clone(),
                        (module.code.clone(), module.resolve_dir.clone()),
                    )
                })
                .collect(),
            mocks: options
                .mocks
                .iter()
                .map(|(key, mock)| (key.clone(), (mock.real_file.clone(), mock.code.clone())))
                .collect(),
            appended: options.appended.clone(),
            embedded_aliases: options.embedded_aliases.clone(),
            flags: options.flags.clone(),
            reject_css: options.reject_css,
            assets: options.assets,
            legal_external: options.legal_comments == LegalComments::External,
            public_path: options.public_path.clone(),
            externals: options.externals.clone(),
            strip_dev_logs: options.strip_dev_logs,
        }),
        state: state.clone(),
    };
    let bundler_options = BundlerOptions {
        input: Some(
            options
                .entries
                .iter()
                .map(|(name, import)| InputItem {
                    name: name.clone(),
                    import: import.clone(),
                })
                .collect(),
        ),
        cwd: Some(options.root.clone()),
        hash_characters: Some(rolldown_common::HashCharacters::Hex),
        platform: Some(Platform::Browser),
        format: Some(match options.format {
            Format::Esm => OutputFormat::Esm,
            Format::Iife => OutputFormat::Iife,
        }),
        minify: Some(rolldown_common::RawMinifyOptions::Bool(options.minify)),
        define: if options.define.is_empty() {
            None
        } else {
            Some(options.define.iter().cloned().collect())
        },
        legal_comments: Some(match options.legal_comments {
            LegalComments::Inline => rolldown_common::LegalComments::Inline,
            _ => rolldown_common::LegalComments::None,
        }),
        entry_filenames: Some(options.entry_names.clone().into()),
        chunk_filenames: Some(options.chunk_names.clone().into()),
        asset_filenames: Some(options.asset_names.clone().into()),
        code_splitting: if options.split {
            None
        } else {
            Some(rolldown_common::CodeSplittingMode::Bool(false))
        },
        ..Default::default()
    };
    let result = runtime().block_on(async move {
        let mut bundler = rolldown::Bundler::with_plugins(
            bundler_options,
            vec![rolldown_plugin::__inner::Pluginable::new_shared(plugin)],
        )?;
        let output = bundler.generate().await;
        let _ = bundler.close().await;
        output
    });
    let mut state = std::mem::take(&mut state.lock().unwrap().0);
    let output = match result {
        Ok(output) => output,
        Err(errors) => {
            let mut problems = std::mem::take(&mut state.errors);
            for diagnostic in errors.into_vec() {
                let text = diagnostic.to_string();
                let relayed = !problems.is_empty() && text.contains("plugin `imp` threw");
                if relayed || problems.iter().any(|problem| text.contains(&problem.text)) {
                    continue;
                }
                let location = diagnostic
                    .to_diagnostic()
                    .get_primary_location()
                    .map(|(_, line, column, _)| format!(":{line}:{column}"))
                    .unwrap_or_default();
                problems.push(Problem {
                    file: diagnostic
                        .id()
                        .map(|id| format!("{}{location}", display_path(&options.root, &id))),
                    text: clean_message(&text),
                });
            }
            return Err(BundleError { problems });
        }
    };
    let mut bundle = Bundle::default();
    let mut legal: Vec<String> = Vec::new();
    for item in output.assets {
        match item {
            Output::Chunk(chunk) => {
                let module_ids: Vec<String> =
                    chunk.module_ids.iter().map(|id| id.to_string()).collect();
                for id in &module_ids {
                    if let Some(comments) = state.legal.get(id) {
                        for comment in comments {
                            if !legal.contains(comment) {
                                legal.push(comment.clone());
                            }
                        }
                    }
                }
                bundle.chunks.push(Chunk {
                    file_name: chunk.filename.to_string(),
                    code: chunk.code.clone(),
                    is_entry: chunk.is_entry,
                    facade_module_id: chunk.facade_module_id.as_ref().map(|id| id.to_string()),
                    imports: chunk.imports.iter().map(ArcStr::to_string).collect(),
                    dynamic_imports: chunk
                        .dynamic_imports
                        .iter()
                        .map(ArcStr::to_string)
                        .collect(),
                    exports: chunk.exports.iter().map(|name| name.to_string()).collect(),
                    module_ids,
                });
            }
            Output::Asset(asset) => bundle.assets.push(Asset {
                file_name: asset.filename.to_string(),
                bytes: match &asset.source {
                    StrOrBytes::Str(text) => text.as_bytes().to_vec(),
                    StrOrBytes::Bytes(bytes) => bytes.clone(),
                },
            }),
        }
    }
    let chunk_files: BTreeSet<String> = bundle
        .chunks
        .iter()
        .map(|chunk| chunk.file_name.clone())
        .collect();
    let mut externals = BTreeSet::new();
    for chunk in &bundle.chunks {
        for import in &chunk.imports {
            if !chunk_files.contains(import) {
                externals.insert(import.clone());
            }
        }
    }
    bundle.external_imports = externals.into_iter().collect();
    bundle.inputs = state.inputs.into_iter().collect();
    bundle.legal = legal;
    Ok(bundle)
}

fn display_path(root: &Path, id: &str) -> String {
    if let Some(path) = id.strip_prefix(EMBEDDED_PREFIX) {
        return format!("imp:{path}");
    }
    if let Some(key) = id.strip_prefix(VIRTUAL_PREFIX) {
        return key.to_string();
    }
    let path = Path::new(id);
    if path.is_absolute() {
        let relative = relative_posix(root, path);
        if !relative.starts_with("..") {
            return relative;
        }
    }
    id.to_string()
}

fn clean_message(text: &str) -> String {
    crate::colors::strip_ansi(text).trim().to_string()
}
