use anyhow::{Result, anyhow, bail};
use serde_json::{Map, Value};
use std::path::Path;

pub type Env = Map<String, Value>;

const DEFAULT_ALIAS: &str = "default";

fn is_dotenv_file(path: &str) -> bool {
    let base = path.rsplit(['/', '\\']).next().unwrap_or(path);
    base.ends_with(".env") || base.starts_with(".env.")
}

fn strip_unquoted_comment(value: &str) -> &str {
    match value.find(" #") {
        Some(index) => value[..index].trim_end(),
        None => value,
    }
}

fn unquote_dotenv_value(value: &str) -> String {
    let first = value.chars().next();
    if let Some(quote @ ('"' | '\'')) = first
        && value.len() >= 2
        && value.ends_with(quote)
    {
        let inner = &value[1..value.len() - 1];
        return if quote == '"' {
            inner.replace("\\n", "\n").replace("\\\"", "\"")
        } else {
            inner.to_string()
        };
    }
    strip_unquoted_comment(value).to_string()
}

fn parse_dotenv(text: &str) -> Map<String, Value> {
    let mut values = Map::new();
    for raw in text.split('\n') {
        let line = raw.trim_end_matches('\r').trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let assignment = line
            .strip_prefix("export ")
            .map(str::trim_start)
            .unwrap_or(line);
        let Some(separator) = assignment.find('=') else {
            continue;
        };
        let key = assignment[..separator].trim();
        if key.is_empty() {
            continue;
        }
        values.insert(
            key.to_string(),
            Value::String(unquote_dotenv_value(assignment[separator + 1..].trim())),
        );
    }
    values
}

fn resolve_values(alias: &str, file: &str, raw: Value, shell: ShellEnv) -> Result<Env> {
    let Value::Object(raw) = raw else {
        bail!("environment '{alias}' - {file} must be a flat JSON object of values");
    };
    let mut resolved = Map::new();
    for (key, value) in raw {
        match &value {
            Value::String(text) => {
                if let Some(variable) = text.strip_prefix("$env.").filter(|rest| !rest.is_empty()) {
                    let Some(from_shell) = shell(variable) else {
                        bail!(
                            "environment '{alias}' - key '{key}' references shell variable '{variable}', which is not set"
                        );
                    };
                    resolved.insert(key, Value::String(from_shell));
                } else {
                    resolved.insert(key, value);
                }
            }
            Value::Number(_) | Value::Bool(_) => {
                resolved.insert(key, value);
            }
            _ => bail!("environment '{alias}' - key '{key}' must be a string, number, or boolean"),
        }
    }
    Ok(resolved)
}

fn select_alias(
    requested: Option<&str>,
    environments: &Map<String, Value>,
    shell: ShellEnv,
) -> Option<String> {
    if let Some(requested) = requested {
        return Some(requested.to_string());
    }
    if let Some(from_shell) = shell("IMP_ENV")
        && !from_shell.is_empty()
    {
        return Some(from_shell);
    }
    environments
        .contains_key(DEFAULT_ALIAS)
        .then(|| DEFAULT_ALIAS.to_string())
}

pub type ShellEnv<'a> = &'a dyn Fn(&str) -> Option<String>;

pub fn resolve_environment(
    root: &Path,
    config: &crate::config::Config,
    requested: Option<&str>,
) -> Result<Env> {
    resolve_environment_in(root, config, requested, &|name| std::env::var(name).ok())
}

pub fn resolve_environment_in(
    root: &Path,
    config: &crate::config::Config,
    requested: Option<&str>,
    shell: ShellEnv,
) -> Result<Env> {
    let empty = Map::new();
    let environments = config
        .get("environments")
        .and_then(Value::as_object)
        .unwrap_or(&empty);
    let Some(alias) = select_alias(requested, environments, shell) else {
        return Ok(Map::new());
    };
    let Some(file) = environments.get(&alias).and_then(Value::as_str) else {
        let defined: Vec<&str> = environments.keys().map(String::as_str).collect();
        let list = if defined.is_empty() {
            "(none defined in imp.json)".to_string()
        } else {
            defined.join(", ")
        };
        bail!("unknown environment '{alias}' - defined environments: {list}");
    };
    let text = std::fs::read_to_string(root.join(file))
        .map_err(|_| anyhow!("environment '{alias}' - file not found: {file}"))?;
    let raw = if is_dotenv_file(file) {
        Value::Object(parse_dotenv(&text))
    } else {
        serde_json::from_str(&text).map_err(|error| {
            anyhow!(
                "environment '{alias}' - invalid JSON in {file}: {}",
                crate::json::describe_error(&error)
            )
        })?
    };
    resolve_values(&alias, file, raw, shell)
}

pub fn script_safe_json(value: &Value) -> String {
    serde_json::to_string(value)
        .unwrap()
        .replace('<', "\\u003c")
}

pub fn env_values_script(env: &Env) -> String {
    format!(
        "globalThis.__IMP_ENV__ = {}\n",
        script_safe_json(&Value::Object(env.clone()))
    )
}

pub fn env_injection_script(env: &Env) -> String {
    if env.is_empty() {
        return String::new();
    }
    format!(
        "<script>globalThis.__IMP_ENV__ = {}</script>",
        script_safe_json(&Value::Object(env.clone()))
    )
}
