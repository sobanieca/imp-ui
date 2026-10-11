use crate::colors::strip_ansi;
use crate::config::{Config, find_config_file, get_path, get_strings, load_imp_config};
use crate::file_size::{MAX_FILE_SIZE_HINT, format_size, is_file_size_ignored, max_file_bytes};
use crate::html_document::{is_javascript_type, read_html};
use crate::lint_recommended::RECOMMENDED_RULES;
use crate::lint_rules::{IMP_RULES, dependency_pin_problem};
use crate::lint_support::{Ctx, Raw, line_column, parse};
use crate::paths::relative_posix;
use crate::walk::{Collect, collect_files};
use anyhow::{Result, bail};
use oxc::allocator::Allocator;
use serde_json::Value;
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::Path;

pub const MAX_FILE_SIZE_RULE: &str = "imp/max-file-size";

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Off,
    Warn,
    Error,
}

pub struct Settings {
    pub severities: HashMap<String, Severity>,
    pub dependency_aliases: Vec<String>,
}

fn parse_severity(value: &Value) -> Option<Severity> {
    match value {
        Value::String(text) => match text.as_str() {
            "off" => Some(Severity::Off),
            "warn" => Some(Severity::Warn),
            "error" => Some(Severity::Error),
            _ => None,
        },
        Value::Number(number) => match number.as_u64() {
            Some(0) => Some(Severity::Off),
            Some(1) => Some(Severity::Warn),
            Some(2) => Some(Severity::Error),
            _ => None,
        },
        Value::Array(items) => items.first().and_then(parse_severity),
        _ => None,
    }
}

pub fn settings(config: &Config) -> Result<Settings> {
    let mut severities: HashMap<String, Severity> = RECOMMENDED_RULES
        .iter()
        .map(|rule| (rule.to_string(), Severity::Error))
        .collect();
    if let Some(rules) = get_path(config, &["lint", "rules"]).and_then(Value::as_object) {
        for (name, value) in rules {
            let known = RECOMMENDED_RULES.contains(&name.as_str())
                || name
                    .strip_prefix("imp/")
                    .is_some_and(|rule| IMP_RULES.contains(&rule))
                || IMP_RULES.contains(&name.as_str());
            if !known {
                bail!("invalid lint configuration in imp.json - unknown rule '{name}'");
            }
            let Some(severity) = parse_severity(value) else {
                bail!(
                    "invalid lint configuration in imp.json - rule '{name}' must be \"off\", \"warn\" or \"error\""
                );
            };
            if !name.starts_with("imp/") && !IMP_RULES.contains(&name.as_str()) {
                severities.insert(name.clone(), severity);
            }
        }
    }
    for rule in IMP_RULES {
        severities.insert(format!("imp/{rule}"), Severity::Error);
    }
    let dependency_aliases = crate::config::dependencies(config)
        .into_iter()
        .map(|(alias, _)| alias)
        .collect();
    Ok(Settings {
        severities,
        dependency_aliases,
    })
}

pub struct Message {
    pub rule: String,
    pub message: String,
    pub line: usize,
    pub column: usize,
    pub severity: Severity,
}

struct Directive {
    line: usize,
    rules: Vec<String>,
    file: bool,
}

fn qualified(rule: &str) -> String {
    if IMP_RULES.contains(&rule) {
        format!("imp/{rule}")
    } else {
        rule.to_string()
    }
}

fn directives(source: &str) -> Vec<Directive> {
    let mut found = Vec::new();
    for (index, line) in source.lines().enumerate() {
        let Some(position) = line.find("//") else {
            continue;
        };
        let comment = line[position + 2..].trim_start();
        let (file, rest) = if let Some(rest) = comment.strip_prefix("imp-lint-ignore-file") {
            (true, rest)
        } else if let Some(rest) = comment.strip_prefix("imp-lint-ignore") {
            (false, rest)
        } else {
            continue;
        };
        if rest
            .chars()
            .next()
            .is_some_and(|char| char.is_alphanumeric() || char == '-')
        {
            continue;
        }
        let rest = rest.split("--").next().unwrap_or("");
        let rules = rest
            .split(',')
            .map(str::trim)
            .filter(|rule| !rule.is_empty())
            .map(qualified)
            .collect();
        found.push(Directive {
            line: index + 1,
            rules,
            file,
        });
    }
    found
}

fn suppressed(directives: &[Directive], rule: &str, line: usize) -> bool {
    directives.iter().any(|directive| {
        let applies = if directive.file {
            line >= directive.line
        } else {
            line == directive.line + 1
        };
        applies && (directive.rules.is_empty() || directive.rules.iter().any(|name| name == rule))
    })
}

pub fn lint_source(source: &str, settings: &Settings) -> (Vec<Message>, Vec<(u32, u32, String)>) {
    let allocator = Allocator::default();
    let parsed = parse(&allocator, source);
    if let Some((message, offset)) = parsed.errors.first() {
        let (line, column) = line_column(source, *offset);
        return (
            vec![Message {
                rule: "parse".into(),
                message: format!("Parsing error: {message}"),
                line,
                column,
                severity: Severity::Error,
            }],
            Vec::new(),
        );
    }
    let ctx = Ctx {
        source,
        semantic: &parsed.semantic,
        dependency_aliases: &settings.dependency_aliases,
        findings: RefCell::new(Vec::new()),
    };
    crate::lint_rules::run(&ctx);
    let imp_count = ctx.findings.borrow().len();
    crate::lint_recommended::run(&ctx);
    let found: Vec<Raw> = ctx.findings.into_inner();
    let marks = directives(source);
    let mut messages = Vec::new();
    let mut fixes = Vec::new();
    for (index, raw) in found.into_iter().enumerate() {
        let rule = if index < imp_count {
            format!("imp/{}", raw.rule)
        } else {
            raw.rule.to_string()
        };
        let severity = settings
            .severities
            .get(&rule)
            .copied()
            .unwrap_or(Severity::Error);
        if severity == Severity::Off {
            continue;
        }
        let (line, column) = line_column(source, raw.span.start);
        if suppressed(&marks, &rule, line) {
            continue;
        }
        if let Some(fix) = raw.fix {
            fixes.extend(fix);
        }
        messages.push(Message {
            rule,
            message: raw.message,
            line,
            column,
            severity,
        });
    }
    messages.sort_by(|a, b| a.line.cmp(&b.line).then(a.column.cmp(&b.column)));
    (messages, fixes)
}

fn apply_fixes(source: &str, mut fixes: Vec<(u32, u32, String)>) -> String {
    fixes.sort_by(|a, b| a.0.cmp(&b.0));
    let mut accepted: Vec<(u32, u32, String)> = Vec::new();
    for fix in fixes {
        if accepted.last().is_some_and(|last| fix.0 < last.1) {
            continue;
        }
        accepted.push(fix);
    }
    let mut output = source.to_string();
    for (start, end, text) in accepted.into_iter().rev() {
        output.replace_range(start as usize..end as usize, &text);
    }
    output
}

pub fn lint_with_fixes(source: &str, settings: &Settings, fix: bool) -> (Vec<Message>, String) {
    let mut current = source.to_string();
    for _ in 0..10 {
        let (messages, fixes) = lint_source(&current, settings);
        if !fix || fixes.is_empty() {
            return (messages, current);
        }
        current = apply_fixes(&current, fixes);
    }
    let (messages, _) = lint_source(&current, settings);
    (messages, current)
}

fn tracked_files(root: &Path) -> Option<Vec<String>> {
    let output = std::process::Command::new("git")
        .args(["ls-files", "-z"])
        .current_dir(root)
        .stderr(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(
        String::from_utf8_lossy(&output.stdout)
            .split('\0')
            .filter(|name| !name.is_empty())
            .map(String::from)
            .collect(),
    )
}

fn report_oversized_files(root: &Path, config: &Config) -> usize {
    let Some(files) = tracked_files(root) else {
        return 0;
    };
    let limit = max_file_bytes(config);
    let ignore = get_strings(config, &["maxFileSizeIgnore"]);
    let mut errors = 0;
    for relative in files {
        if is_file_size_ignored(&relative, &ignore) {
            continue;
        }
        let Ok(meta) = std::fs::metadata(root.join(&relative)) else {
            continue;
        };
        if !meta.is_file() || meta.len() <= limit {
            continue;
        }
        errors += 1;
        eprintln!(
            "error[{MAX_FILE_SIZE_RULE}]: {relative} is {}, over the {} limit - {MAX_FILE_SIZE_HINT}",
            format_size(meta.len()),
            format_size(limit)
        );
        eprintln!(" --> {relative}:1:1\n");
    }
    errors
}

pub fn lint(root: &Path, paths: &[String], fix: bool) -> Result<i32> {
    let config = load_imp_config(root)?;
    let config_name = find_config_file(root)
        .map(|found| found.name)
        .unwrap_or("imp.json");
    let settings = match settings(&config) {
        Ok(settings) => settings,
        Err(error) => {
            eprintln!("error: {error}");
            return Ok(1);
        }
    };
    let exclude = get_strings(&config, &["lint", "exclude"]);
    let files = collect_files(Collect {
        root,
        paths,
        extensions: &["js", "mjs", "cjs", "html"],
        exclude: &exclude,
    })?;
    let mut errors = 0;
    let mut warnings = 0;
    let mut fixed_files = 0;
    for (alias, specifier) in crate::config::dependencies(&config) {
        let Some(problem) = dependency_pin_problem(&specifier) else {
            continue;
        };
        errors += 1;
        eprintln!("error[imp/exact-dependency-versions]: dependency '{alias}': {problem}");
        eprintln!(" --> {config_name}:1:1\n");
    }
    errors += report_oversized_files(root, &config);
    errors += crate::dead_code::report_dead_code(root, &config, config_name)?;
    errors += crate::analytics_names::report_duplicate_analytics_names(root, &config)?;
    let mut report = |file: &Path, messages: &[Message], line_offset: usize| {
        for message in messages {
            let is_error = message.severity == Severity::Error;
            if is_error {
                errors += 1;
            } else {
                warnings += 1;
            }
            eprintln!(
                "{}[{}]: {}",
                if is_error { "error" } else { "warning" },
                message.rule,
                message.message
            );
            eprintln!(
                " --> {}:{}:{}\n",
                relative_posix(root, file),
                message.line + line_offset,
                message.column
            );
        }
    };
    for file in &files {
        let source = std::fs::read_to_string(file)?;
        let output =
            if crate::paths::extension(file) == "html" {
                let document = read_html(&source);
                let mut output = String::new();
                let mut cursor = 0;
                for block in document.scripts.iter().filter(|script| {
                    script.src.is_none() && is_javascript_type(script.kind.as_deref())
                }) {
                    let (messages, fixed) = lint_with_fixes(&block.text, &settings, fix);
                    report(file, &messages, block.line_offset);
                    output.push_str(&source[cursor..block.start]);
                    output.push_str(&fixed);
                    cursor = block.end;
                }
                output.push_str(&source[cursor..]);
                output
            } else {
                let (messages, fixed) = lint_with_fixes(&source, &settings, fix);
                report(file, &messages, 0);
                fixed
            };
        if fix && output != source {
            std::fs::write(file, &output)?;
            fixed_files += 1;
        }
    }
    let problems = errors + warnings;
    if fixed_files > 0 {
        eprintln!(
            "Fixed {fixed_files} {}",
            if fixed_files == 1 { "file" } else { "files" }
        );
    }
    if problems > 0 {
        eprintln!(
            "Found {problems} problem{}",
            if problems == 1 { "" } else { "s" }
        );
    }
    eprintln!(
        "Checked {} {}",
        files.len(),
        if files.len() == 1 { "file" } else { "files" }
    );
    let _ = strip_ansi;
    Ok(if errors > 0 { 1 } else { 0 })
}
