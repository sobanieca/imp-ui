use crate::environments::{Env, script_safe_json};
use crate::js_scan::{extract_calls, parse_string_literal, split_first_argument};
use anyhow::{Result, bail};
use regex::Regex;
use serde_json::{Map, Value};
use std::sync::LazyLock;

const FLAG_EXPORT: &str = "flag";

pub type Flags = Map<String, Value>;

fn flag_value(name: &str, value: Option<&Value>) -> Result<bool> {
    match value {
        None => Ok(false),
        Some(Value::Bool(flag)) => Ok(*flag),
        Some(Value::String(text)) if text == "true" => Ok(true),
        Some(Value::String(text)) if text == "false" => Ok(false),
        Some(other) => bail!(
            "flag '{name}' must be true or false in the selected environment, not {}",
            serde_json::to_string(other).unwrap()
        ),
    }
}

pub fn split_env_and_flags(config: &crate::config::Config, env: &Env) -> Result<(Env, Flags)> {
    let declared = crate::config::get_strings(config, &["flags"]);
    let mut values = env.clone();
    let mut flags = Map::new();
    for name in declared {
        flags.insert(name.clone(), Value::Bool(flag_value(&name, env.get(&name))?));
        values.remove(&name);
    }
    Ok((values, flags))
}

pub fn flags_injection_script(flags: &Flags) -> String {
    if flags.is_empty() {
        return String::new();
    }
    format!("<script>globalThis.__IMP_FLAGS__ = {}</script>", script_safe_json(&Value::Object(flags.clone())))
}

static IMP_NAMED_IMPORT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?m)^[ \t]*import\s*\{([^}]*)\}\s*from\s*(?:'imp'|"imp")"#).unwrap()
});

fn local_flag_name(source: &str) -> Option<String> {
    for caps in IMP_NAMED_IMPORT.captures_iter(source) {
        for specifier in caps[1].split(',') {
            let parts: Vec<&str> = specifier.trim().splitn(2, " as ").map(str::trim).collect();
            if parts[0] == FLAG_EXPORT {
                return Some(parts.get(1).unwrap_or(&parts[0]).to_string());
            }
        }
    }
    None
}

fn unknown_flag_problem(name: &str, flags: &Flags) -> String {
    let declared: Vec<&str> = flags.keys().map(String::as_str).collect();
    if declared.is_empty() {
        format!("unknown flag '{name}' - imp.json declares no 'flags'")
    } else {
        format!(
            "unknown flag '{name}' - declare it in imp.json's 'flags'; declared flags: {}",
            declared.join(", ")
        )
    }
}

pub fn fold_flag_calls(source: &str, flags: &Flags, file: &str) -> Result<String> {
    let Some(local) = local_flag_name(source) else { return Ok(source.to_string()) };
    let calls = extract_calls(source, &local);
    if calls.is_empty() {
        return Ok(source.to_string());
    }
    let mut folded = String::new();
    let mut last = 0;
    for call in calls {
        let (first, rest) = split_first_argument(&call.argument_source);
        let name = parse_string_literal(&first);
        let Some(name) = name.filter(|_| rest.is_empty()) else {
            bail!(
                "{file} - {local}() takes one string literal flag name, so the build can fold it away: {local}('CHECKOUT_V2')"
            );
        };
        let Some(value) = flags.get(&name) else { bail!("{file} - {}", unknown_flag_problem(&name, flags)) };
        folded.push_str(&source[last..call.start]);
        folded.push_str(&value.to_string());
        last = call.end;
    }
    folded.push_str(&source[last..]);
    Ok(folded)
}
