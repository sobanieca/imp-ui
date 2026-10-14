use crate::specifiers::{EXACT_VERSION, is_valid_alias};
use anyhow::{Result, bail};
use serde_json::{Map, Value};
use std::path::{Path, PathBuf};

pub type Config = Map<String, Value>;

const CONFIG_FILENAMES: [&str; 2] = ["imp.json", "imp.jsonc"];

pub const LICENSE_POLICY_NAMES: [&str; 3] = ["permissive", "weak-copyleft", "any"];

pub const DEFAULT_LICENSE_POLICY: &str = "permissive";

pub struct ConfigFile {
    pub dir: PathBuf,
    pub path: PathBuf,
    pub name: &'static str,
}

pub fn find_config_file(start: &Path) -> Option<ConfigFile> {
    let mut dir = start.to_path_buf();
    loop {
        for name in CONFIG_FILENAMES {
            let path = dir.join(name);
            if path.exists() {
                return Some(ConfigFile { dir, path, name });
            }
        }
        if dir.join(".git").exists() {
            return None;
        }
        if !dir.pop() {
            return None;
        }
    }
}

pub fn project_root(start: &Path) -> PathBuf {
    find_config_file(start)
        .map(|found| found.dir)
        .unwrap_or_else(|| start.to_path_buf())
}

pub fn config_target_path(start: &Path) -> PathBuf {
    find_config_file(start)
        .map(|found| found.path)
        .unwrap_or_else(|| start.join("imp.json"))
}

fn jsonc_options() -> jsonc_parser::ParseOptions {
    jsonc_parser::ParseOptions {
        allow_comments: true,
        allow_loose_object_property_names: false,
        allow_trailing_commas: true,
        allow_missing_commas: false,
        allow_single_quoted_strings: false,
        allow_hexadecimal_numbers: false,
        allow_unary_plus_numbers: false,
        allow_bare_decimal_point_numbers: false,
        allow_non_finite_numbers: false,
        allow_extended_string_escapes: false,
    }
}

pub fn parse_config_text(text: &str, name: &str) -> Result<Value> {
    match jsonc_parser::parse_to_serde_value::<Value>(text, &jsonc_options()) {
        Ok(value) => Ok(value),
        Err(error) => {
            bail!(
                "invalid {name} - {} at position {}",
                error.kind(),
                error.range().start
            )
        }
    }
}

pub fn try_parse_config(text: &str) -> Option<Value> {
    jsonc_parser::parse_to_serde_value::<Value>(text, &jsonc_options()).ok()
}

pub enum Insertion {
    End,
    First,
    Alphabetical,
}

pub struct ConfigChange {
    pub path: Vec<String>,
    pub value: Option<Value>,
    pub insertion: Insertion,
}

pub fn update_config_file(path: &Path, changes: &[ConfigChange]) -> Result<()> {
    use jsonc_parser::cst::{CstInputValue, CstRootNode};
    let text = std::fs::read_to_string(path).unwrap_or_else(|_| "{}\n".to_string());
    let root = CstRootNode::parse(&text, &jsonc_options()).map_err(|error| {
        anyhow::anyhow!("invalid {} - {}", crate::paths::file_name(path), error)
    })?;
    fn input(value: &Value) -> CstInputValue {
        match value {
            Value::Null => CstInputValue::Null,
            Value::Bool(flag) => CstInputValue::Bool(*flag),
            Value::Number(number) => CstInputValue::Number(number.to_string()),
            Value::String(text) => CstInputValue::String(text.clone()),
            Value::Array(items) => CstInputValue::Array(items.iter().map(input).collect()),
            Value::Object(map) => CstInputValue::Object(
                map.iter()
                    .map(|(key, value)| (key.clone(), input(value)))
                    .collect(),
            ),
        }
    }
    for change in changes {
        let mut object = root.object_value_or_set();
        let (last, parents) = change.path.split_last().expect("a config path");
        let mut missing_parent = false;
        for key in parents {
            if change.value.is_none() {
                match object.object_value(key) {
                    Some(next) => object = next,
                    None => {
                        missing_parent = true;
                        break;
                    }
                }
            } else {
                object = object.object_value_or_set(key);
            }
        }
        if missing_parent {
            continue;
        }
        match &change.value {
            None => {
                if let Some(property) = object.get(last) {
                    property.remove();
                }
            }
            Some(value) => {
                if let Some(property) = object.get(last) {
                    property.set_value(input(value));
                    continue;
                }
                let names: Vec<String> = object
                    .properties()
                    .iter()
                    .filter_map(|property| {
                        property.name().and_then(|name| name.decoded_value().ok())
                    })
                    .collect();
                let index = match change.insertion {
                    Insertion::End => names.len(),
                    Insertion::First => 0,
                    Insertion::Alphabetical => names
                        .iter()
                        .position(|name| name.as_str() > last.as_str())
                        .unwrap_or(names.len()),
                };
                object.insert(index, last, input(value));
            }
        }
    }
    let mut output = root.to_string();
    if !output.ends_with('\n') {
        output.push('\n');
    }
    std::fs::write(path, output)?;
    Ok(())
}

pub fn public_directory(root: &Path) -> PathBuf {
    root.join("public")
}

pub struct MocksSetting {
    pub folder: String,
    pub enabled: bool,
}

pub fn mocks_setting(config: &Config) -> Option<MocksSetting> {
    let declared = config.get("mocks")?;
    Some(MocksSetting {
        folder: declared
            .get("folder")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        enabled: declared
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

pub fn dependencies(config: &Config) -> Vec<(String, String)> {
    config
        .get("dependencies")
        .and_then(Value::as_object)
        .map(|map| {
            map.iter()
                .map(|(alias, spec)| (alias.clone(), spec.as_str().unwrap_or_default().to_string()))
                .collect()
        })
        .unwrap_or_default()
}

pub fn get_path<'a>(config: &'a Config, path: &[&str]) -> Option<&'a Value> {
    let (first, rest) = path.split_first()?;
    let mut value = config.get(*first)?;
    for key in rest {
        value = value.get(*key)?;
    }
    Some(value)
}

pub fn get_str<'a>(config: &'a Config, path: &[&str]) -> Option<&'a str> {
    get_path(config, path).and_then(Value::as_str)
}

pub fn get_strings(config: &Config, path: &[&str]) -> Vec<String> {
    get_path(config, path)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

const RESERVED_FLAG_PREFIX: &str = "IMP_";

fn is_positive_number(value: &Value) -> bool {
    value
        .as_f64()
        .is_some_and(|number| number.is_finite() && number > 0.0)
}

fn is_integer(value: &Value) -> bool {
    value.is_i64() || value.is_u64() || value.as_f64().is_some_and(|number| number.fract() == 0.0)
}

fn is_string_array(value: &Value) -> bool {
    value
        .as_array()
        .is_some_and(|items| items.iter().all(Value::is_string))
}

pub fn load_imp_config(start: &Path) -> Result<Config> {
    let Some(found) = find_config_file(start) else {
        return Ok(Map::new());
    };
    let Ok(text) = std::fs::read_to_string(&found.path) else {
        return Ok(Map::new());
    };
    let name = found.name;
    let Value::Object(config) = parse_config_text(&text, name)? else {
        bail!("invalid {name} - expected a JSON object at the top level");
    };
    validate(&config, name)?;
    Ok(config)
}

fn validate(config: &Config, name: &str) -> Result<()> {
    for key in [
        "dependencies",
        "fmt",
        "lint",
        "test",
        "preview",
        "pwa",
        "environments",
        "build",
    ] {
        if let Some(value) = config.get(key)
            && !value.is_object()
        {
            bail!("invalid {name} - '{key}' must be an object");
        }
    }
    if let Some(map) = config.get("map")
        && map.as_str().is_none_or(str::is_empty)
    {
        bail!(
            "invalid {name} - 'map' must be the path of the file that exports the application map, like \"src/app-map.js\""
        );
    }
    if let Some(licenses) = config.get("licenses") {
        if let Some(list) = licenses.as_array() {
            if list.is_empty() || list.iter().any(|id| !id.is_string()) {
                bail!(
                    "invalid {name} - 'licenses' as a list must hold one or more SPDX identifier strings"
                );
            }
        } else if !licenses
            .as_str()
            .is_some_and(|policy| LICENSE_POLICY_NAMES.contains(&policy))
        {
            let names = LICENSE_POLICY_NAMES
                .map(|policy| format!("'{policy}'"))
                .join(", ");
            bail!("invalid {name} - 'licenses' must be {names}, or a list of SPDX identifiers");
        }
    }
    if let Some(max_size) = get_path(config, &["build", "maxSize"])
        && !(is_integer(max_size) && max_size.as_f64().unwrap_or(0.0) > 0.0)
    {
        bail!(
            "invalid {name} - 'build.maxSize' must be a positive whole number of bytes, like 512000"
        );
    }
    if let Some(environments) = config.get("environments").and_then(Value::as_object) {
        for (alias, path) in environments {
            if !path.is_string() {
                bail!("invalid {name} - environment '{alias}' must be a string path");
            }
        }
    }
    if let Some(flags) = config.get("flags") {
        let valid = flags.as_array().is_some_and(|items| {
            items
                .iter()
                .all(|flag| flag.as_str().is_some_and(|flag| !flag.is_empty()))
        });
        if !valid {
            bail!(
                "invalid {name} - 'flags' must be an array of flag names, like [\"CHECKOUT_V2\"]"
            );
        }
        if let Some(reserved) = flags
            .as_array()
            .unwrap()
            .iter()
            .filter_map(Value::as_str)
            .find(|flag| flag.starts_with(RESERVED_FLAG_PREFIX))
        {
            bail!(
                "invalid {name} - flag '{reserved}' must not start with {RESERVED_FLAG_PREFIX}, which is reserved for imp's own environment values"
            );
        }
    }
    if let Some(pwa) = config.get("pwa") {
        for key in [
            "name",
            "shortName",
            "themeColor",
            "backgroundColor",
            "icon",
            "startUrl",
            "scope",
        ] {
            if pwa.get(key).is_some_and(|value| !value.is_string()) {
                bail!("invalid {name} - 'pwa.{key}' must be a string");
            }
        }
        let displays = ["standalone", "fullscreen", "minimal-ui", "browser"];
        if let Some(display) = pwa.get("display")
            && !display
                .as_str()
                .is_some_and(|display| displays.contains(&display))
        {
            bail!(
                "invalid {name} - 'pwa.display' must be one of {}",
                displays.join(", ")
            );
        }
    }
    for key in ["entry", "browser"] {
        if get_path(config, &["test", key]).is_some_and(|value| !value.is_string()) {
            bail!("invalid {name} - 'test.{key}' must be a string");
        }
    }
    if get_path(config, &["test", "exclude"]).is_some_and(|value| !is_string_array(value)) {
        bail!("invalid {name} - 'test.exclude' must be an array of strings");
    }
    if let Some(exports) = get_path(config, &["lint", "publicExports"]) {
        let valid = exports.as_array().is_some_and(|items| {
            items
                .iter()
                .all(|item| item.as_str().is_some_and(|item| !item.is_empty()))
        });
        if !valid {
            bail!(
                "invalid {name} - 'lint.publicExports' must be an array of paths, each optionally naming one export like 'src/sdk.js#register'"
            );
        }
    }
    if get_path(config, &["preview", "exclude"]).is_some_and(|value| !is_string_array(value)) {
        bail!("invalid {name} - 'preview.exclude' must be an array of strings");
    }
    if get_path(config, &["preview", "themes"]).is_some_and(|value| !is_string_array(value)) {
        bail!("invalid {name} - 'preview.themes' must be an array of paths to theme modules");
    }
    if get_path(config, &["preview", "entry"]).is_some_and(|value| !value.is_string()) {
        bail!(
            "invalid {name} - 'preview.entry' must be a path to the HTML file that frames every preview page"
        );
    }
    if get_path(config, &["preview", "groups"]).is_some_and(|value| !value.is_string()) {
        bail!(
            "invalid {name} - 'preview.groups' must be a path to a module exporting the component groups"
        );
    }
    if let Some(video) = get_path(config, &["test", "video"]) {
        if !video.is_object() {
            bail!("invalid {name} - 'test.video' must be an object");
        }
        if video.get("enable").is_some_and(|value| !value.is_boolean()) {
            bail!("invalid {name} - 'test.video.enable' must be true or false");
        }
        for key in ["fps", "maxDuration", "width", "quality"] {
            if video
                .get(key)
                .is_some_and(|value| !is_positive_number(value))
            {
                bail!("invalid {name} - 'test.video.{key}' must be a positive number");
            }
        }
    }
    if let Some(dependencies) = config.get("dependencies").and_then(Value::as_object) {
        for (alias, specifier) in dependencies {
            if alias == "imp" {
                bail!(
                    "invalid {name} - 'imp' is reserved for the imp library and cannot be a dependency alias"
                );
            }
            if !is_valid_alias(alias) {
                bail!(
                    "invalid {name} - dependency alias '{alias}' must be a package name of letters, digits, '.', '_' and '-', with no '/', '\\' or '..', and it must not start with '.'"
                );
            }
            if !specifier.is_string() {
                bail!("invalid {name} - dependency '{alias}' must be a string specifier");
            }
        }
    }
    if let Some(mocks) = config.get("mocks") {
        if !mocks.is_object() {
            bail!(
                "invalid {name} - 'mocks' must be an object naming the folder and whether it serves, like {{ \"folder\": \"mocks\", \"enabled\": true }}"
            );
        }
        if !mocks.get("folder").is_some_and(Value::is_string) {
            bail!(
                "invalid {name} - 'mocks.folder' must be a string path to the folder holding your *.mock.js files"
            );
        }
        if !mocks.get("enabled").is_some_and(Value::is_boolean) {
            bail!(
                "invalid {name} - 'mocks.enabled' must be true or false, so every project says outright whether it develops against mocks (--mock and --no-mock override it per run)"
            );
        }
    }
    if let Some(worker) = config.get("serviceWorker")
        && worker.as_str().is_none_or(str::is_empty)
    {
        bail!(
            "invalid {name} - 'serviceWorker' must be the path of your service worker source, like \"src/sw.js\""
        );
    }
    if let Some(version) = config.get("version")
        && !version
            .as_str()
            .is_some_and(|version| EXACT_VERSION.is_match(version))
    {
        bail!("invalid {name} - 'version' must be an exact imp version string, like '1.2.3'");
    }
    if config
        .get("targetImpHost")
        .is_some_and(|value| !value.is_boolean())
    {
        bail!("invalid {name} - 'targetImpHost' must be true or false");
    }
    if config
        .get("maxFileSize")
        .is_some_and(|value| !is_positive_number(value))
    {
        bail!("invalid {name} - 'maxFileSize' must be a positive number");
    }
    if config
        .get("maxFileSizeIgnore")
        .is_some_and(|value| !is_string_array(value))
    {
        bail!("invalid {name} - 'maxFileSizeIgnore' must be an array of strings");
    }
    if let Some(entries) = config.get("maxLogEntries")
        && !(is_integer(entries) && entries.as_f64().unwrap_or(0.0) > 0.0)
    {
        bail!("invalid {name} - 'maxLogEntries' must be a positive integer");
    }
    if let Some(port) = config.get("devServerPort") {
        let number = port.as_f64().unwrap_or(0.0);
        if !(is_integer(port) && (1.0..=65535.0).contains(&number)) {
            bail!("invalid {name} - 'devServerPort' must be an integer between 1 and 65535");
        }
    }
    Ok(())
}
