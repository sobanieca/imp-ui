use crate::config::{Config, get_strings};
use crate::html_document::{is_javascript_type, read_html};
use crate::lint_rules::{analytics_uses, unreadable_analytics_name_problem};
use crate::lint_support::{Ctx, line_column, parse};
use crate::names::{analytics_name_problem_of, analytics_subject};
use crate::paths::relative_posix;
use crate::project_files::{is_mock_file, is_preview_file, is_test_file};
use crate::walk::{Collect, collect_files};
use anyhow::{Result, bail};
use oxc::allocator::Allocator;
use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use std::path::Path;

pub const UNIQUE_ANALYTICS_NAME_RULE: &str = "imp/unique-analytics-name";

pub struct NameUse {
    pub helper: String,
    pub name: Option<String>,
    pub literal: bool,
    pub line: usize,
    pub column: usize,
}

pub fn names_in(source: &str) -> Vec<NameUse> {
    let allocator = Allocator::default();
    let parsed = parse(&allocator, source);
    if !parsed.errors.is_empty() {
        return Vec::new();
    }
    let ctx = Ctx {
        source,
        semantic: &parsed.semantic,
        dependency_aliases: &[],
        findings: RefCell::new(Vec::new()),
    };
    analytics_uses(&ctx)
        .into_iter()
        .map(|usage| {
            let (line, column) = line_column(source, usage.span.start);
            NameUse {
                helper: usage.helper,
                name: usage.name,
                literal: usage.literal,
                line,
                column,
            }
        })
        .collect()
}

fn is_development_file(path: &str) -> bool {
    is_test_file(path) || is_preview_file(path) || is_mock_file(path)
}

pub fn report_duplicate_analytics_names(root: &Path, config: &Config) -> Result<usize> {
    let project_root = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let exclude = get_strings(config, &["lint", "exclude"]);
    let files = collect_files(Collect {
        root: &project_root,
        paths: &[],
        extensions: &["js", "mjs", "cjs", "html"],
        exclude: &exclude,
    })?;
    let mut uses: Vec<(String, Vec<(String, String, usize, usize)>)> = Vec::new();
    let mut record = |key: String, entry: (String, String, usize, usize)| match uses
        .iter_mut()
        .find(|(existing, _)| *existing == key)
    {
        Some((_, list)) => list.push(entry),
        None => uses.push((key, vec![entry])),
    };
    for file in &files {
        if is_development_file(&file.to_string_lossy()) {
            continue;
        }
        let source = std::fs::read_to_string(file)?;
        let path = relative_posix(&project_root, file);
        let blocks: Vec<(String, usize)> = if crate::paths::extension(file) == "html" {
            read_html(&source)
                .scripts
                .into_iter()
                .filter(|script| script.src.is_none() && is_javascript_type(script.kind.as_deref()))
                .map(|script| (script.text, script.line_offset))
                .collect()
        } else {
            vec![(source.clone(), 0)]
        };
        for (text, offset) in blocks {
            for usage in names_in(&text) {
                let Some(name) = usage.name.filter(|_| usage.literal) else {
                    continue;
                };
                record(
                    format!("{}\n{name}", usage.helper),
                    (
                        usage.helper.clone(),
                        path.clone(),
                        usage.line + offset,
                        usage.column,
                    ),
                );
            }
        }
    }
    let mut findings: Vec<(String, usize, usize, String)> = Vec::new();
    for (key, list) in &uses {
        let name = key.split_once('\n').map(|(_, name)| name).unwrap_or("");
        let (_, first_path, first_line, first_column) = &list[0];
        for (helper, path, line, column) in &list[1..] {
            let subject = analytics_subject(helper)
                .map(|(subject, _)| subject)
                .unwrap_or("zone");
            findings.push((
                path.clone(),
                *line,
                *column,
                format!(
                    "{subject} name '{name}' is also used in {first_path}:{first_line}:{first_column} - give each {subject} its own name, so that the report can tell them apart"
                ),
            ));
        }
    }
    findings.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)).then(a.2.cmp(&b.2)));
    for (path, line, column, message) in &findings {
        eprintln!("error[{UNIQUE_ANALYTICS_NAME_RULE}]: {message}");
        eprintln!(" --> {path}:{line}:{column}\n");
    }
    Ok(findings.len())
}

pub fn collect_bundle_names(
    root: &Path,
    inputs: &[String],
    inline: &HashMap<String, String>,
) -> Result<(Vec<String>, Vec<String>)> {
    let dependencies = root.join("dependencies");
    let mut zones = BTreeSet::new();
    let mut outcomes = BTreeSet::new();
    let mut unreadable = Vec::new();
    for input in inputs {
        let virtual_key = input.strip_prefix(crate::bundler::VIRTUAL_PREFIX);
        let (source, path) = match virtual_key {
            Some(key) => match inline.get(key) {
                Some(source) => (source.clone(), key.to_string()),
                None => continue,
            },
            None => {
                let file = Path::new(input);
                if !file.is_absolute()
                    || file.starts_with(&dependencies)
                    || !matches!(crate::paths::extension(file).as_str(), "js" | "mjs" | "cjs")
                {
                    continue;
                }
                (std::fs::read_to_string(file)?, relative_posix(root, file))
            }
        };
        for usage in names_in(&source) {
            let at = format!("{path}:{}:{}", usage.line, usage.column);
            if !usage.literal {
                unreadable.push(format!(
                    "  {at} - {}",
                    unreadable_analytics_name_problem(&usage.helper)
                ));
                continue;
            }
            let Some(name) = usage.name else { continue };
            if analytics_name_problem_of(&usage.helper, &name).is_some() {
                continue;
            }
            if usage.helper == "zone" {
                zones.insert(name);
            } else {
                outcomes.insert(name);
            }
        }
    }
    if !unreadable.is_empty() {
        bail!(
            "imp build cannot read every analytics name:\n{}",
            unreadable.join("\n")
        );
    }
    Ok((zones.into_iter().collect(), outcomes.into_iter().collect()))
}
