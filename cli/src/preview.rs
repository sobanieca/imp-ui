use crate::bundler::{
    Assets, Format, ImpLibrary, LegalComments, Mock, Options, VirtualModule, bundle,
    resolve_module_file,
};
use crate::colors::dim;
use crate::config::{Config, get_path, get_strings, load_imp_config};
use crate::dev_log::{DEFAULT_MAX_LOG_ENTRIES, DevLog};
use crate::environments::{Env, env_injection_script, resolve_environment};
use crate::html_document::{Edit, apply_edits, head_edit, read_html};
use crate::http_server::{Request, Response};
use crate::license_notices::{
    LICENSE_NOTICES_FILE, collect_license_notices, license_notices_reference,
    unrecorded_licenses_warning,
};
use crate::logger;
use crate::paths::{absolute, cwd, posix, relative_posix};
use crate::preview_source::{
    GroupReference, PREVIEW_SKILL_EXPORT, scan_groups_module, scan_preview_source,
};
use crate::start::{
    AppOptions, Clients, Handler, has_hidden_segment, inject_imp, is_served_host, load_app,
    print_server_urls, reload_banner_line, served_hostnames, unknown_host_response,
    warn_about_exposed_host, warn_missing_dependencies, watch_for_changes,
};
use anyhow::{Result, anyhow, bail};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};

const DEFAULT_PREVIEW_PORT: u16 = 4401;
const PREVIEW_EXTENSIONS: [&str; 2] = ["js", "mjs"];
const ENTRY_ID: &str = "imp-preview-entry";
const RUNTIME_SPECIFIER: &str = "imp-preview-runtime";
const RUNTIME_MODULE: &str = "cli/js/preview-runtime.js";
const GROUP_SCHEME: &str = "imp-preview-group:";
const GROUPS_FOLDER: &str = "groups";
const BUNDLE_PREFIX: &str = "/@imp/preview/";
const APP_BUNDLE_NAME: &str = "app";
const GROUPS_BINDING: &str = "previewGroups";
const BUILD_ROUNDS_LIMIT: usize = 20;
const PAGE_TITLE: &str = "imp preview";
pub const PREVIEW_ELEMENT: &str = "imp-preview";
pub const PREVIEW_ELEMENT_FILE: &str = "imp-preview.js";
const PREVIEW_APP_MARK: &str = "imp-preview:app";
const PREVIEW_ROUTE_EVENT: &str = "imp-preview-route";
const PREVIEW_THEME_EVENT: &str = "imp-preview-theme";
const PREVIEW_THEME_ATTRIBUTE: &str = "theme";
pub const PREVIEW_FRAME_NAME_PREFIX: &str = "imp-preview-frame:";
const GROUP_SHAPE: &str =
    "import { groups } from './preview-groups.js' and export const group = groups.widgets";
const RESERVED_KEYS: [&str; 9] = [
    "path",
    "label",
    "description",
    "access",
    "nav",
    "group",
    "href",
    "spec",
    "toString",
];

pub struct PreviewOptions {
    pub root: PathBuf,
    pub paths: Vec<String>,
    pub port: Option<u16>,
    pub host: Option<String>,
    pub env: Option<String>,
    pub list: bool,
    pub json: bool,
    pub mocks: Option<bool>,
    pub reload: bool,
    pub output: Option<String>,
}

#[derive(Clone)]
struct Source {
    source: String,
    file: PathBuf,
}

#[derive(Clone)]
struct Translation {
    code: String,
    file: PathBuf,
}

#[derive(Clone)]
struct Settings {
    themes: Vec<Source>,
    translations: Vec<Translation>,
    groups: Option<Source>,
    entry: Option<Source>,
}

#[derive(Clone, Debug)]
pub struct CatalogEntry {
    pub file: String,
    pub path: String,
    pub name: String,
    pub group: String,
    pub description: Option<String>,
    pub order: Vec<String>,
    pub code: BTreeMap<String, String>,
    pub skill: Option<String>,
}

impl CatalogEntry {
    fn to_json(&self, error: Option<&str>) -> Value {
        let mut value = json!({
            "file": self.file,
            "path": self.path,
            "name": self.name,
            "group": self.group,
            "description": self.description,
            "order": self.order,
            "code": self.code,
            "skill": self.skill,
        });
        if let Some(error) = error {
            value["error"] = Value::from(error);
        }
        value
    }
}

fn is_preview_file(path: &str) -> bool {
    crate::project_files::is_preview_file(path)
}

fn sibling_preview_of(path: &str) -> String {
    for extension in PREVIEW_EXTENSIONS {
        if let Some(stem) = path.strip_suffix(&format!(".{extension}")) {
            return format!("{stem}.preview.{extension}");
        }
    }
    path.to_string()
}

fn resolve_targets(root: &Path, paths: &[String]) -> Result<Vec<String>> {
    let mut targets = Vec::new();
    for target in paths {
        let path = absolute(root.join(target));
        let Ok(meta) = std::fs::metadata(&path) else {
            bail!("path not found: {target}");
        };
        let text = path.to_string_lossy().into_owned();
        if meta.is_dir() || is_preview_file(&text) {
            targets.push(text);
            continue;
        }
        let sibling = sibling_preview_of(&text);
        if sibling == text || !Path::new(&sibling).is_file() {
            bail!(
                "not a preview file: {target} - previews end with .preview.js, and there is no {} next to it",
                relative_posix(root, Path::new(&sibling))
            );
        }
        targets.push(sibling);
    }
    Ok(targets)
}

pub fn select_preview_files(
    root: &Path,
    paths: &[String],
    exclude: &[String],
) -> Result<Vec<PathBuf>> {
    let targets = resolve_targets(root, paths)?;
    let files = crate::walk::collect_files(crate::walk::Collect {
        root,
        paths: &targets,
        extensions: &PREVIEW_EXTENSIONS,
        exclude,
    })?;
    Ok(files
        .into_iter()
        .filter(|file| is_preview_file(&file.to_string_lossy()))
        .collect())
}

fn resolve_module(root: &Path, entry: &str) -> Option<PathBuf> {
    resolve_module_file(&absolute(root.join(entry)))
}

fn resolve_settings(root: &Path, config: &Config) -> Result<Settings> {
    let mut themes = Vec::new();
    for entry in get_strings(config, &["preview", "themes"]) {
        let file = resolve_module(root, &entry)
            .ok_or_else(|| anyhow!("theme not found: {entry} - listed in 'preview.themes'"))?;
        themes.push(Source {
            source: entry,
            file,
        });
    }
    let mut translations = Vec::new();
    match get_path(config, &["preview", "translations"]) {
        None => {}
        Some(Value::Object(map)) => {
            for (code, entry) in map {
                let entry = entry.as_str().unwrap_or_default();
                let file = resolve_module(root, entry).ok_or_else(|| {
                    anyhow!(
                        "translations not found: {entry} - listed in 'preview.translations.{code}'"
                    )
                })?;
                translations.push(Translation {
                    code: code.clone(),
                    file,
                });
            }
        }
        Some(_) => bail!(
            "'preview.translations' must map a language code to a translations file, like {{ \"pl\": \"./locales/pl.js\" }}"
        ),
    }
    let groups = match crate::config::get_str(config, &["preview", "groups"]) {
        None => None,
        Some(entry) => Some(Source {
            source: entry.to_string(),
            file: resolve_module(root, entry).ok_or_else(|| {
                anyhow!("groups module not found: {entry} - listed in 'preview.groups'")
            })?,
        }),
    };
    let entry = match crate::config::get_str(config, &["preview", "entry"]) {
        None => None,
        Some(entry) => {
            let file = absolute(root.join(entry));
            if !file.is_file() {
                bail!("preview entry not found: {entry} - listed in 'preview.entry'");
            }
            Some(Source {
                source: entry.to_string(),
                file,
            })
        }
    };
    Ok(Settings {
        themes,
        translations,
        groups,
        entry,
    })
}

fn markdown_html(text: &str) -> String {
    use pulldown_cmark::{Options as Markdown, Parser, html};
    let mut options = Markdown::empty();
    options.insert(Markdown::ENABLE_TABLES);
    options.insert(Markdown::ENABLE_STRIKETHROUGH);
    let mut out = String::new();
    html::push_html(&mut out, Parser::new_ext(text, options));
    out
}

pub fn render_skill(text: &str) -> String {
    markdown_html(&crate::skill::retarget_links(text.trim_end()).0)
}

pub fn render_description(text: &str) -> String {
    markdown_html(text.trim_end())
}

fn preview_stem(name: &str) -> &str {
    for extension in PREVIEW_EXTENSIONS {
        if let Some(stem) = name.strip_suffix(&format!(".preview.{extension}")) {
            return stem;
        }
    }
    name
}

pub fn preview_identity(
    file: &str,
    name: Option<String>,
    group: Option<String>,
    description: Option<&str>,
) -> CatalogEntry {
    let mut segments: Vec<&str> = file.split('/').collect();
    let component = preview_stem(segments.pop().unwrap_or_default()).to_string();
    let folder = segments.last().copied().unwrap_or("previews").to_string();
    CatalogEntry {
        file: file.to_string(),
        path: format!("{folder}/{component}"),
        name: name.unwrap_or_else(|| component.clone()),
        group: group.unwrap_or(folder),
        description: description.map(render_description),
        order: Vec::new(),
        code: BTreeMap::new(),
        skill: None,
    }
}

fn component_module_of(preview_file: &str) -> String {
    for extension in PREVIEW_EXTENSIONS {
        if let Some(stem) = preview_file.strip_suffix(&format!(".preview.{extension}")) {
            return format!("{stem}.{extension}");
        }
    }
    preview_file.to_string()
}

fn sidecar_of(preview_file: &str) -> String {
    posix(crate::skill::skill_file_for(Path::new(
        &component_module_of(preview_file),
    )))
}

fn skill_command_of(root: &Path, file: &str) -> Option<String> {
    let sidecar_name = sidecar_of(file);
    let own = std::fs::read_to_string(root.join(&sidecar_name)).ok()?;
    let standard = crate::skill::standard_component_skills()
        .into_iter()
        .find(|(_, path)| path.strip_prefix("lib/src/") == Some(sidecar_name.as_str()));
    let is_standard = standard
        .as_ref()
        .and_then(|(_, path)| crate::embedded::text(path))
        .is_some_and(|embedded| embedded == own);
    Some(match (is_standard, standard) {
        (true, Some((name, _))) => format!("imp skill {name}"),
        _ => format!("imp skill ./{}", component_module_of(file)),
    })
}

fn read_group_names(groups: Option<&Source>) -> Option<HashMap<String, Option<String>>> {
    let groups = groups?;
    let source = std::fs::read_to_string(&groups.file).unwrap_or_default();
    let Some(names) = scan_groups_module(&source) else {
        logger::warn(&format!(
            "{} (preview.groups) must export an object named groups, like export const groups = {{ widgets: {{ name: 'Widgets', icon: luBox }} }}",
            groups.source
        ));
        return Some(HashMap::new());
    };
    for (key, name) in &names {
        if name.is_none() {
            logger::warn(&format!(
                "{} (preview.groups): group '{key}' has no name",
                groups.source
            ));
        }
    }
    Some(names.into_iter().collect())
}

fn resolve_group_name(
    root: &Path,
    file: &str,
    reference: Option<&GroupReference>,
    groups: Option<&Source>,
    names: Option<&HashMap<String, Option<String>>>,
) -> Option<String> {
    let reference = reference?;
    let GroupReference::Key { key, specifier } = reference else {
        logger::warn(&format!(
            "{file}: 'group' must be a key of the groups module, like {GROUP_SHAPE}"
        ));
        return None;
    };
    let (Some(groups), Some(names)) = (groups, names) else {
        logger::warn(&format!(
            "{file}: 'group' needs 'preview.groups' in imp.json to name the groups module"
        ));
        return None;
    };
    let imported = specifier.as_ref().and_then(|specifier| {
        let dir = root.join(file);
        resolve_module_file(&absolute(dir.parent().unwrap_or(root).join(specifier)))
    });
    if imported.as_deref() != Some(groups.file.as_path()) {
        logger::warn(&format!(
            "{file}: 'group' must import groups from {}, like {GROUP_SHAPE}",
            groups.source
        ));
        return None;
    }
    match names.get(key) {
        Some(Some(name)) => Some(name.clone()),
        _ => {
            logger::warn(&format!(
                "{file}: 'group' is groups.{key}, which {} does not name",
                groups.source
            ));
            None
        }
    }
}

fn build_catalog(root: &Path, files: &[String], groups: Option<&Source>) -> Vec<CatalogEntry> {
    let names = read_group_names(groups);
    let mut entries: Vec<CatalogEntry> = files
        .iter()
        .map(|file| {
            let source = std::fs::read_to_string(root.join(file)).unwrap_or_default();
            let scanned = scan_preview_source(&source);
            let group = resolve_group_name(
                root,
                file,
                scanned.declared.group.as_ref(),
                groups,
                names.as_ref(),
            );
            let mut entry = preview_identity(
                file,
                scanned.declared.name.clone(),
                group,
                scanned.declared.description.as_deref(),
            );
            entry.order = scanned.scenarios;
            entry.code = scanned.code;
            entry.skill = skill_command_of(root, file);
            entry
        })
        .collect();
    entries.sort_by(|left, right| {
        left.group
            .cmp(&right.group)
            .then_with(|| left.name.cmp(&right.name))
    });
    entries
}

fn words_of(name: &str) -> Vec<String> {
    let mut spaced = String::new();
    let chars: Vec<char> = name.chars().collect();
    for (index, char) in chars.iter().enumerate() {
        if index > 0
            && char.is_ascii_uppercase()
            && (chars[index - 1].is_ascii_lowercase() || chars[index - 1].is_ascii_digit())
        {
            spaced.push(' ');
        }
        spaced.push(*char);
    }
    spaced
        .split(|char: char| !char.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_ascii_lowercase)
        .collect()
}

fn identifier_of(words: &[String]) -> String {
    words
        .iter()
        .enumerate()
        .map(|(index, word)| {
            if index == 0 {
                word.clone()
            } else {
                let mut chars = word.chars();
                chars
                    .next()
                    .map(|first| first.to_ascii_uppercase().to_string() + chars.as_str())
                    .unwrap_or_default()
            }
        })
        .collect()
}

fn slug_of(name: &str, taken: &mut HashSet<String>, fallback: &str) -> (String, String) {
    let mut words = words_of(name);
    if words.is_empty() {
        words = vec![fallback.to_string()];
    }
    if words[0].starts_with(|char: char| char.is_ascii_digit()) {
        words.insert(0, "n".into());
    }
    let mut key = identifier_of(&words);
    if RESERVED_KEYS.contains(&key.as_str()) {
        words.push("item".into());
        key = identifier_of(&words);
    }
    let mut suffix = 1;
    let mut candidate = key.clone();
    while taken.contains(&candidate) {
        suffix += 1;
        candidate = format!("{key}{suffix}");
    }
    taken.insert(candidate.clone());
    let segment = if candidate == key {
        words.join("-")
    } else {
        format!("{}-{suffix}", words.join("-"))
    };
    (candidate, segment)
}

struct Slug {
    group_segment: String,
    segment: String,
}

fn preview_slugs(catalog: &[CatalogEntry]) -> HashMap<String, Slug> {
    let mut group_keys = HashSet::new();
    let mut groups: HashMap<String, (String, HashSet<String>)> = HashMap::new();
    let mut slugs = HashMap::new();
    for entry in catalog {
        if !groups.contains_key(&entry.group) {
            let (_, segment) = slug_of(&entry.group, &mut group_keys, "group");
            groups.insert(entry.group.clone(), (segment, HashSet::new()));
        }
        let (group_segment, taken) = groups.get_mut(&entry.group).unwrap();
        let (_, segment) = slug_of(&entry.name, taken, "preview");
        slugs.insert(
            entry.file.clone(),
            Slug {
                group_segment: group_segment.clone(),
                segment,
            },
        );
    }
    slugs
}

fn preview_href(slug: &Slug) -> String {
    format!("/{}/{}", slug.group_segment, slug.segment)
}

fn imp_mark() -> Value {
    let uri = |scheme: &str| {
        crate::image::data_uri(
            "image/svg+xml",
            crate::review::imp_mark_svg(scheme).as_bytes(),
        )
    };
    json!({ "light": uri("light"), "dark": uri("dark") })
}

fn imp_favicon() -> String {
    crate::image::data_uri(
        "image/x-icon",
        crate::embedded::file("cli/templates/favicon.ico").unwrap_or_default(),
    )
}

fn js(value: impl Into<Value>) -> String {
    value.into().to_string()
}

struct Built {
    files: BTreeMap<String, String>,
    failed: Vec<(String, String)>,
    inputs: Vec<String>,
    bundles_library: bool,
    legal: Vec<String>,
    error: Option<String>,
}

struct AppBuild<'a> {
    root: &'a Path,
    dependencies: &'a [String],
    catalog: &'a [CatalogEntry],
    settings: &'a Settings,
    embedded: bool,
}

fn collect_app_mocks(build: &AppBuild) -> (HashMap<String, Mock>, Vec<(String, String)>) {
    let mut mocks: HashMap<String, Mock> = HashMap::new();
    let mut owners: HashMap<String, String> = HashMap::new();
    let mut failed = Vec::new();
    for entry in build.catalog {
        let collected = crate::test::collect_mocks(&build.root.join(&entry.file), build.root, build.dependencies)
            .and_then(|own| {
                for (id, mock) in &own {
                    if let (Some(owner), Some(known)) = (owners.get(id), mocks.get(id))
                        && known.code != mock.code {
                            bail!(
                                "mockModule('{id}') - {owner} already mocks this module with a different factory; the preview app is one module graph, so a module is mocked once, the same way, for every preview"
                            );
                        }
                }
                Ok(own)
            });
        match collected {
            Ok(own) => {
                for (id, mock) in own {
                    owners.insert(id.clone(), entry.file.clone());
                    mocks.insert(id, mock);
                }
            }
            Err(error) => failed.push((entry.file.clone(), format!("{error:#}"))),
        }
    }
    (mocks, failed)
}

fn entry_source(
    build: &AppBuild,
    entries: &[&CatalogEntry],
    failed: &[(String, String)],
) -> (String, BTreeMap<String, String>) {
    let slugs = preview_slugs(build.catalog);
    let mut groups: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut loaders = Vec::new();
    for entry in entries {
        let segment = slugs[&entry.file].group_segment.clone();
        let exports = groups.entry(segment.clone()).or_default();
        let binding = format!("preview{}", exports.len());
        exports.push(format!(
            "export * as {binding} from {}",
            js(absolute(build.root.join(&entry.file))
                .to_string_lossy()
                .into_owned())
        ));
        loaders.push(format!(
            "  {}: () => import({}).then((group) => group.{binding}),",
            js(entry.file.as_str()),
            js(format!("{GROUP_SCHEME}{segment}"))
        ));
    }
    let settings = build.settings;
    let catalog: Vec<Value> = build
        .catalog
        .iter()
        .map(|entry| {
            let error = failed
                .iter()
                .find(|(file, _)| file == &entry.file)
                .map(|(_, error)| error.as_str());
            entry.to_json(error)
        })
        .collect();
    let mut lines: Vec<String> = Vec::new();
    for (index, theme) in settings.themes.iter().enumerate() {
        lines.push(format!(
            "import * as customTheme{index} from {}",
            js(theme.file.to_string_lossy().into_owned())
        ));
    }
    for (index, entry) in settings.translations.iter().enumerate() {
        lines.push(format!(
            "import * as previewTranslations{index} from {}",
            js(entry.file.to_string_lossy().into_owned())
        ));
    }
    if let Some(groups) = &settings.groups {
        lines.push(format!(
            "import * as {GROUPS_BINDING} from {}",
            js(groups.file.to_string_lossy().into_owned())
        ));
    }
    lines.push(format!(
        "import {{ startPreview }} from '{RUNTIME_SPECIFIER}'"
    ));
    if build.embedded {
        lines.push("import { useRoute } from 'imp/router'".into());
    }
    lines.push("const started = startPreview({".into());
    lines.push(format!("  embedded: {},", build.embedded));
    lines.push(format!("  mark: {},", imp_mark()));
    lines.push(format!("  favicon: {},", js(imp_favicon())));
    lines.push(format!("  catalog: {},", Value::Array(catalog)));
    lines.push("  load: {".into());
    lines.extend(loaders);
    lines.push("  },".into());
    let themes: Vec<String> = settings
        .themes
        .iter()
        .enumerate()
        .map(|(index, theme)| {
            format!(
                "{{ source: {}, module: customTheme{index} }}",
                js(theme.source.as_str())
            )
        })
        .collect();
    lines.push(format!("  themes: [{}],", themes.join(", ")));
    let translations: Vec<String> = settings
        .translations
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            format!(
                "{{ code: {}, module: previewTranslations{index} }}",
                js(entry.code.as_str())
            )
        })
        .collect();
    lines.push(format!("  translations: [{}],", translations.join(", ")));
    lines.push(format!(
        "  groups: {},",
        match &settings.groups {
            None => "null".to_string(),
            Some(groups) => format!(
                "{{ source: {}, module: {GROUPS_BINDING} }}",
                js(groups.source.as_str())
            ),
        }
    ));
    lines.push("})".into());
    if build.embedded {
        lines.push("started.then(() => {".into());
        lines.push("  useRoute().watch((route) => {".into());
        lines.push("    globalThis.frameElement?.dispatchEvent(".into());
        lines.push(format!(
            "      new CustomEvent({}, {{ detail: route }}),",
            js(PREVIEW_ROUTE_EVENT)
        ));
        lines.push("    )".into());
        lines.push("  })".into());
        lines.push("})".into());
    }
    let modules = groups
        .into_iter()
        .map(|(segment, exports)| (segment, format!("{}\n", exports.join("\n"))))
        .collect();
    (format!("{}\n", lines.join("\n")), modules)
}

fn with_skill_exports(build: &AppBuild, entries: &[&CatalogEntry]) -> HashMap<PathBuf, String> {
    let mut appended = HashMap::new();
    for entry in entries {
        let sidecar = build.root.join(sidecar_of(&entry.file));
        if let Ok(text) = std::fs::read_to_string(&sidecar) {
            appended.insert(
                absolute(build.root.join(&entry.file)),
                format!(
                    "\nexport const {PREVIEW_SKILL_EXPORT} = {}\n",
                    js(render_skill(&text))
                ),
            );
        }
    }
    appended
}

fn bundle_preview_app(build: AppBuild) -> Result<Built> {
    let (mocks, mut failed) = collect_app_mocks(&build);
    let mut entries: Vec<&CatalogEntry> = build
        .catalog
        .iter()
        .filter(|entry| !failed.iter().any(|(file, _)| file == &entry.file))
        .collect();
    for _ in 0..BUILD_ROUNDS_LIMIT {
        let (entry_code, group_modules) = entry_source(&build, &entries, &failed);
        let mut options = Options::new(build.root);
        options.virtual_modules.insert(
            ENTRY_ID.into(),
            VirtualModule {
                code: entry_code,
                resolve_dir: build.root.to_path_buf(),
            },
        );
        options
            .entries
            .push((Some(APP_BUNDLE_NAME.into()), ENTRY_ID.into()));
        for (segment, code) in group_modules {
            let id = format!("{GROUP_SCHEME}{segment}");
            options.virtual_modules.insert(
                id.clone(),
                VirtualModule {
                    code,
                    resolve_dir: build.root.to_path_buf(),
                },
            );
            options
                .entries
                .push((Some(format!("{GROUPS_FOLDER}/{segment}")), id));
        }
        options
            .embedded_aliases
            .insert(RUNTIME_SPECIFIER.into(), RUNTIME_MODULE.into());
        options.dependencies = build.dependencies.to_vec();
        options.imp = ImpLibrary::Tooling;
        options.mocks = mocks
            .iter()
            .map(|(id, mock)| {
                (
                    id.clone(),
                    Mock {
                        real_file: mock.real_file.clone(),
                        code: mock.code.clone(),
                    },
                )
            })
            .collect();
        options.appended = with_skill_exports(&build, &entries);
        options.split = true;
        options.format = Format::Esm;
        options.assets = Assets::DataUrl;
        options.chunk_names = "chunks/[name]-[hash].js".into();
        options.minify = build.embedded;
        if build.embedded {
            options.define = crate::build::production_defines();
            options.legal_comments = LegalComments::External;
        }
        match bundle(options) {
            Ok(bundled) => {
                let files = bundled
                    .chunks
                    .iter()
                    .map(|chunk| {
                        (
                            format!("{BUNDLE_PREFIX}{}", chunk.file_name),
                            chunk.code.clone(),
                        )
                    })
                    .collect();
                return Ok(Built {
                    files,
                    failed,
                    bundles_library: bundled.bundles_imp_library(),
                    inputs: bundled.inputs,
                    legal: bundled.legal,
                    error: None,
                });
            }
            Err(error) => {
                let culprits: Vec<String> = entries
                    .iter()
                    .filter(|entry| {
                        error.problems.iter().any(|problem| {
                            problem.file.as_ref().is_some_and(|file| {
                                file.split(':')
                                    .next()
                                    .unwrap_or(file)
                                    .ends_with(&entry.file)
                            })
                        })
                    })
                    .map(|entry| entry.file.clone())
                    .collect();
                if culprits.is_empty() {
                    bail!("{}", error.describe());
                }
                for file in &culprits {
                    let own: Vec<String> = error
                        .problems
                        .iter()
                        .filter(|problem| {
                            problem
                                .file
                                .as_ref()
                                .is_some_and(|name| name.contains(file.as_str()))
                        })
                        .map(|problem| match &problem.file {
                            Some(name) => format!("{name}: {}", problem.text),
                            None => problem.text.clone(),
                        })
                        .collect();
                    failed.push((file.clone(), own.join("\n")));
                }
                entries.retain(|entry| !culprits.contains(&entry.file));
            }
        }
    }
    bail!("the preview app could not be built after excluding the files that fail")
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn generated_shell(title: &str, body: &str) -> String {
    format!(
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<link rel=\"icon\" href=\"{}\">\n<title>{}</title>\n</head>\n<body>\n{body}\n</body>\n</html>\n",
        imp_favicon(),
        escape_html(title)
    )
}

pub fn entry_shell(entry_html: &str, title: &str, body: &str) -> String {
    let document = read_html(entry_html);
    let title_tag = format!("<title>{}</title>", escape_html(title));
    let title_edit = match document.title {
        Some((start, end)) => Edit {
            start,
            end,
            text: title_tag,
        },
        None => head_edit(&document, &title_tag),
    };
    let body_edit = Edit {
        start: document.body_end,
        end: document.body_end,
        text: format!("\n{body}\n"),
    };
    apply_edits(entry_html, &mut [title_edit, body_edit])
}

fn app_page(entry_html: Option<&str>) -> String {
    let body =
        format!("<script type=\"module\" src=\"{BUNDLE_PREFIX}{APP_BUNDLE_NAME}.js\"></script>");
    match entry_html {
        None => generated_shell(PAGE_TITLE, &body),
        Some(html) => entry_shell(html, PAGE_TITLE, &body),
    }
}

fn failure_module(message: &str) -> String {
    format!(
        "\nconst failure = document.createElement('pre')\nfailure.textContent = {} + {}\nfailure.setAttribute(\n  'style',\n  'margin:24px;padding:16px;border-radius:8px;white-space:pre-wrap;' +\n    'background:#2a1618;border:1px solid #57282c;color:#ffb4b4;' +\n    'font:13px ui-monospace,SFMono-Regular,Menlo,monospace',\n)\ndocument.body.setAttribute('style', 'margin:0;background:#0f1115')\ndocument.body.append(failure)\n",
        js("imp preview: the preview app failed to build\n\n"),
        js(message)
    )
}

fn no_store(response: Response) -> Response {
    response.header("cache-control", "no-store")
}

fn is_page_request(request: &Request) -> bool {
    let name = request.path.rsplit('/').next().unwrap_or("");
    let hidden = crate::http_server::percent_decode_strict(&request.path)
        .is_none_or(|decoded| has_hidden_segment(&decoded));
    request.method == "GET" && !name.rfind('.').is_some_and(|index| index > 0) && !hidden
}

pub struct PreviewServer {
    app: Handler,
    root: PathBuf,
    dependencies: Vec<String>,
    settings: Settings,
    catalog: RwLock<Vec<CatalogEntry>>,
    build: Mutex<Option<Arc<Built>>>,
}

impl PreviewServer {
    fn read_entry(&self) -> Option<String> {
        let entry = self.settings.entry.as_ref()?;
        match std::fs::read_to_string(&entry.file) {
            Ok(text) => Some(text),
            Err(error) => {
                logger::error(&format!("{} could not be read - {error}", entry.source));
                None
            }
        }
    }

    fn load_build(&self) -> Arc<Built> {
        let mut cache = self.build.lock().unwrap();
        if let Some(built) = cache.as_ref() {
            return built.clone();
        }
        let catalog = self.catalog.read().unwrap().clone();
        let built = match bundle_preview_app(AppBuild {
            root: &self.root,
            dependencies: &self.dependencies,
            catalog: &catalog,
            settings: &self.settings,
            embedded: false,
        }) {
            Ok(built) => {
                for (file, error) in &built.failed {
                    logger::error(&format!("{file} failed to build - {error}"));
                }
                built
            }
            Err(error) => {
                logger::error(&format!("the preview app failed to build - {error:#}"));
                Built {
                    files: BTreeMap::new(),
                    failed: Vec::new(),
                    inputs: Vec::new(),
                    bundles_library: false,
                    legal: Vec::new(),
                    error: Some(format!("{error:#}")),
                }
            }
        };
        let built = Arc::new(built);
        *cache = Some(built.clone());
        built
    }

    fn page(&self) -> Response {
        let html = app_page(self.read_entry().as_deref());
        no_store(Response::new(
            200,
            "text/html; charset=utf-8",
            inject_imp(&html, &self.app.app.head_injection),
        ))
    }

    pub fn handle(&self, request: Request) -> Response {
        if !is_served_host(&request, &self.app.hostnames) {
            return unknown_host_response(&request);
        }
        if let Some(name) = request.path.strip_prefix(BUNDLE_PREFIX) {
            let built = self.load_build();
            let script =
                |code: String| no_store(Response::new(200, "text/javascript; charset=utf-8", code));
            if name == format!("{APP_BUNDLE_NAME}.js")
                && let Some(error) = &built.error
            {
                return script(failure_module(error));
            }
            return match built.files.get(&request.path) {
                Some(code) => script(code.clone()),
                None => Response::text(404, format!("not found: {name}")),
            };
        }
        if request.path == "/" {
            return self.page();
        }
        let page_request = is_page_request(&request);
        let response = self.app.handle(request);
        if response.status == 404 && page_request {
            return self.page();
        }
        response
    }
}

fn preview_count(count: usize) -> String {
    format!("{count} preview{}", if count == 1 { "" } else { "s" })
}

fn embedded_page(entry: Option<&Source>, env: &Env) -> Result<String> {
    let mut values = env.clone();
    values.insert("IMP_ROUTING".into(), Value::from("hash"));
    let body = format!(
        "{}\n<script type=\"module\" src=\"{PREVIEW_APP_MARK}\"></script>",
        env_injection_script(&values)
    );
    Ok(match entry {
        None => generated_shell(PAGE_TITLE, &body),
        Some(entry) => entry_shell(&std::fs::read_to_string(&entry.file)?, PAGE_TITLE, &body),
    })
}

fn preview_element_script(page: &str) -> String {
    crate::browser_script::browser_script(
        "preview-element.js",
        &json!({
            "page": page,
            "element": PREVIEW_ELEMENT,
            "appMark": PREVIEW_APP_MARK,
            "routeEvent": PREVIEW_ROUTE_EVENT,
            "themeEvent": PREVIEW_THEME_EVENT,
            "themeAttribute": PREVIEW_THEME_ATTRIBUTE,
        }),
    )
}

fn export_preview(
    root: &Path,
    config: &Config,
    previews: &[String],
    dependencies: &[String],
    output: &str,
    env: Option<&str>,
) -> Result<()> {
    let outdir = absolute(root.join(output));
    let sources: Vec<PathBuf> = previews.iter().map(|file| root.join(file)).collect();
    let source_refs: Vec<&Path> = sources.iter().map(PathBuf::as_path).collect();
    crate::output_folder::assert_output_folder(&outdir, output, root, &source_refs, true)?;
    let settings = resolve_settings(root, config)?;
    let resolved_env = resolve_environment(root, config, env)?;
    let catalog = build_catalog(root, previews, settings.groups.as_ref());
    let built = bundle_preview_app(AppBuild {
        root,
        dependencies,
        catalog: &catalog,
        settings: &settings,
        embedded: true,
    })?;
    if !built.failed.is_empty() {
        let lines: Vec<String> = built
            .failed
            .iter()
            .map(|(file, error)| format!("{file} failed to build - {error}"))
            .collect();
        bail!(
            "the export needs every preview file to build:\n{}",
            lines.join("\n")
        );
    }
    let page = embedded_page(settings.entry.as_ref(), &resolved_env)?;
    let (notices, _, unrecorded) = collect_license_notices(
        root,
        dependencies,
        &built.inputs,
        built.bundles_library,
        built.legal.clone(),
    )?;
    if !unrecorded.is_empty() {
        logger::warn(&unrecorded_licenses_warning(&unrecorded));
    }
    let notice_count = notices.count();
    crate::output_folder::replace_output_folder(&outdir)?;
    let mut written = Vec::new();
    let mut write = |name: &str, text: &str| -> Result<()> {
        let path = outdir.join(name);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let text = if notice_count > 0 && name.ends_with(".js") {
            let depth = name.split('/').count() - 1;
            format!(
                "{}{text}",
                license_notices_reference(&format!(
                    "{}{LICENSE_NOTICES_FILE}",
                    "../".repeat(depth)
                ))
            )
        } else {
            text.to_string()
        };
        std::fs::write(&path, text)?;
        written.push(name.to_string());
        Ok(())
    };
    write(PREVIEW_ELEMENT_FILE, &preview_element_script(&page))?;
    if notice_count > 0 {
        write(LICENSE_NOTICES_FILE, &notices.file())?;
    }
    for (path, code) in &built.files {
        write(&path[BUNDLE_PREFIX.len()..], code)?;
    }
    let shown = relative_posix(&cwd(), &outdir);
    let shown = if shown.is_empty() {
        ".".to_string()
    } else {
        shown
    };
    logger::info(&format!(
        "imp preview exported {} -> {shown}/",
        preview_count(previews.len())
    ));
    println!(
        "{}",
        dim(format!(
            "  <script type=\"module\" src=\"/{PREVIEW_ELEMENT_FILE}\"></script> loads it, <{PREVIEW_ELEMENT}></{PREVIEW_ELEMENT}> shows it"
        ))
    );
    println!(
        "{}",
        dim("  #/<group>/<name> in the address of the page opens a component")
    );
    if let Some(entry) = &settings.entry {
        println!("{}", dim(format!("  entry -> {}", entry.source)));
    }
    written.sort();
    for name in written {
        let size = std::fs::metadata(outdir.join(&name))
            .map(|meta| meta.len())
            .unwrap_or(0);
        println!("  {name} ({})", crate::file_size::format_size(size));
    }
    Ok(())
}

pub fn preview(options: PreviewOptions) -> Result<()> {
    let root = options.root.clone();
    let config = load_imp_config(&root)?;
    let dependencies: Vec<String> = crate::config::dependencies(&config)
        .into_iter()
        .map(|(alias, _)| alias)
        .collect();
    let exclude = get_strings(&config, &["preview", "exclude"]);
    let discover = {
        let root = root.clone();
        let paths = options.paths.clone();
        let exclude = exclude.clone();
        move || -> Result<Vec<String>> {
            Ok(select_preview_files(&root, &paths, &exclude)?
                .into_iter()
                .map(|file| relative_posix(&root, &file))
                .collect())
        }
    };
    let previews = discover()?;
    if options.list {
        if options.json {
            println!("{}", serde_json::to_string(&previews)?);
        } else {
            for file in &previews {
                println!("{file}");
            }
        }
        return Ok(());
    }
    if previews.is_empty() {
        logger::info(
            "no previews found - write a '*.preview.js' file next to a component and export one instance per scenario, like: export const empty = myComponent()",
        );
        return Ok(());
    }
    if let Some(output) = &options.output {
        return export_preview(
            &root,
            &config,
            &previews,
            &dependencies,
            output,
            options.env.as_deref(),
        );
    }
    let settings = resolve_settings(&root, &config)?;
    let app = Arc::new(load_app(
        &root.join("index.html"),
        AppOptions {
            env_alias: options.env.clone(),
            mocks: options.mocks,
            widget: crate::start::Widget::Review,
        },
    )?);
    let port = options.port.unwrap_or(DEFAULT_PREVIEW_PORT);
    let max_entries = config
        .get("maxLogEntries")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(DEFAULT_MAX_LOG_ENTRIES);
    let dev_log = DevLog::create(&root, max_entries)?;
    let sink_log = dev_log.clone();
    let _sink = logger::add_sink(move |line| sink_log.write(line));
    warn_missing_dependencies(&app);
    let catalog = build_catalog(&root, &previews, settings.groups.as_ref());
    let open_path = if options.paths.len() == 1 && previews.len() == 1 {
        preview_slugs(&catalog)
            .get(&previews[0])
            .map(preview_href)
            .unwrap_or_else(|| "/".into())
    } else {
        "/".into()
    };
    let clients = Clients::default();
    let mut handler = Handler::new(app.clone(), clients.clone());
    handler.history_fallback = false;
    handler.recent_log = Some(dev_log.clone());
    handler.hostnames = served_hostnames(options.host.as_deref());
    let server = Arc::new(PreviewServer {
        app: handler,
        root: root.clone(),
        dependencies,
        settings: settings.clone(),
        catalog: RwLock::new(catalog),
        build: Mutex::new(None),
    });
    let reload = options.reload;
    let watched = server.clone();
    let groups = settings.groups.clone();
    let watch_root = root.clone();
    let known = Mutex::new(previews.clone());
    let _watcher = watch_for_changes(&root, move || {
        *watched.build.lock().unwrap() = None;
        let mut previews = known.lock().unwrap();
        if let Ok(found) = discover() {
            *previews = found;
        }
        *watched.catalog.write().unwrap() = build_catalog(&watch_root, &previews, groups.as_ref());
        if reload {
            logger::debug("change detected -> reload");
            clients.broadcast("reload");
        } else {
            logger::debug("change detected -> no reload");
        }
    })?;
    let listener = crate::start::bind(options.host.as_deref(), port)?;
    let bound = listener.local_addr()?.port();
    logger::info(&format!(
        "imp preview serving {} from {}",
        preview_count(previews.len()),
        root.display()
    ));
    print_server_urls(options.host.as_deref(), bound, &open_path);
    warn_about_exposed_host(options.host.as_deref());
    println!("{}", dim("  logs -> imp logs (-f follows the session)"));
    if !settings.themes.is_empty() {
        let names: Vec<&str> = settings
            .themes
            .iter()
            .map(|theme| theme.source.as_str())
            .collect();
        println!(
            "{}",
            dim(format!("  themes -> {} + built-ins", names.join(", ")))
        );
    }
    if !settings.translations.is_empty() {
        let codes: Vec<&str> = settings
            .translations
            .iter()
            .map(|entry| entry.code.as_str())
            .collect();
        println!("{}", dim(format!("  languages -> {}", codes.join(", "))));
    }
    if let Some(groups) = &settings.groups {
        println!("{}", dim(format!("  groups -> {}", groups.source)));
    }
    if let Some(entry) = &settings.entry {
        println!("{}", dim(format!("  entry -> {}", entry.source)));
    }
    println!("{}", reload_banner_line(reload));
    crate::http_server::serve(listener, Arc::new(move |request| server.handle(request)));
    dev_log.close();
    Ok(())
}
