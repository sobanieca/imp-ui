use crate::workspace::{
    build_imp, cargo, cargo_with, repo_root, run_imp, run_imp_with, tracked_files,
};
use anyhow::{Result, bail};
use imp::fmt::{FMT_EXTENSIONS, Formatter};
use imp::lint::{Settings, Severity, lint_source};
use imp::lint_recommended::RECOMMENDED_RULES;
use imp::lint_rules::IMP_RULES;
use std::collections::HashMap;

const GENERATED: &[&str] = &[
    "lib/src/icons/lucide-icons.js",
    "lib/src/std/data/map-world-110m.js",
    "lib/src/std/data/map-world-50m.js",
    "lib/src/std/data/map-roads-10m.js",
];

const NOT_LINTED: &[&str] = &["cli/tests/fixtures/", "cli/vendor/"];

const NOT_FORMATTED: &[&str] = &[
    "cli/tests/fixtures/",
    "cli/tests/snapshots/",
    "cli/templates/",
    "cli/vendor/",
    "examples/",
];

const IMP_LINTED: &[&str] = &["lib/src", "cli/js"];

const LIBRARY_TEST_TIME_ZONE: &str = "Europe/Warsaw";

fn extension_of(path: &str) -> &str {
    path.rsplit_once('.')
        .map(|(_, extension)| extension)
        .unwrap_or("")
}

fn skipped(path: &str, prefixes: &[&str]) -> bool {
    GENERATED.contains(&path) || prefixes.iter().any(|prefix| path.starts_with(prefix))
}

fn format_repo(write: bool) -> Result<usize> {
    let root = repo_root();
    let formatter = Formatter::new(&imp::config::Config::new());
    let mut unformatted = 0;
    for path in tracked_files()? {
        if skipped(&path, NOT_FORMATTED) || !FMT_EXTENSIONS.contains(&extension_of(&path)) {
            continue;
        }
        let original = std::fs::read_to_string(root.join(&path))?;
        let formatted = formatter.format(&root.join(&path), &original)?;
        if formatted == original {
            continue;
        }
        unformatted += 1;
        if write {
            std::fs::write(root.join(&path), formatted)?;
            println!("formatted {path}");
        } else {
            eprintln!("not formatted: {path}");
        }
    }
    Ok(unformatted)
}

fn repo_lint_settings() -> Settings {
    let mut severities: HashMap<String, Severity> = RECOMMENDED_RULES
        .iter()
        .map(|rule| (rule.to_string(), Severity::Error))
        .collect();
    for rule in IMP_RULES {
        severities.insert(format!("imp/{rule}"), Severity::Off);
    }
    Settings {
        severities,
        dependency_aliases: Vec::new(),
    }
}

fn lint_repo() -> Result<usize> {
    let root = repo_root();
    let settings = repo_lint_settings();
    let mut problems = 0;
    for path in tracked_files()? {
        if skipped(&path, NOT_LINTED) || extension_of(&path) != "js" {
            continue;
        }
        let source = std::fs::read_to_string(root.join(&path))?;
        for message in lint_source(&source, &settings).0 {
            problems += 1;
            eprintln!(
                "error[{}]: {}\n --> {path}:{}:{}\n",
                message.rule, message.message, message.line, message.column
            );
        }
    }
    Ok(problems)
}

pub fn check(write: bool) -> Result<()> {
    if write {
        cargo(&["fmt", "--all"])?;
    } else {
        cargo(&["fmt", "--all", "--check"])?;
    }
    cargo(&[
        "clippy",
        "--quiet",
        "--workspace",
        "--all-targets",
        "--profile",
        "local",
        "--",
        "-D",
        "warnings",
    ])?;
    let unformatted = format_repo(write)?;
    if !write && unformatted > 0 {
        bail!("{unformatted} files are not formatted - run cargo xtask check");
    }
    let problems = lint_repo()?;
    if problems > 0 {
        bail!("{problems} lint problems in the repository");
    }
    let binary = build_imp("local")?;
    for folder in IMP_LINTED {
        run_imp(&binary, &["lint"], &repo_root().join(folder))?;
    }
    println!("check: clean");
    Ok(())
}

pub fn test(filter: &[String]) -> Result<()> {
    let binary = build_imp("local")?;
    let library_tests = repo_root().join("lib").join("test");
    run_imp_with(
        &binary,
        &["test", "--unit"],
        &library_tests,
        &[("TZ", LIBRARY_TEST_TIME_ZONE)],
    )?;
    run_imp(&binary, &["test", "--e2e"], &library_tests)?;
    let mut args = vec!["test", "--profile", "local", "--workspace"];
    if !filter.is_empty() {
        args.push("--");
        args.extend(filter.iter().map(String::as_str));
    }
    cargo(&args)
}

pub fn update_snapshots() -> Result<()> {
    cargo_with(
        &["test", "--profile", "local", "--package", "imp"],
        &[("UPDATE_SNAPSHOTS", "1")],
    )
}

pub fn binary_size() -> Result<()> {
    let binary = build_imp("release")?;
    let limit: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(
        repo_root().join("binary-size-limit.json"),
    )?)?;
    let max_bytes = limit["maxBytes"].as_u64().unwrap_or(0);
    let target = limit["target"].as_str().unwrap_or("");
    let here = format!("{}-{}", std::env::consts::ARCH, std::env::consts::OS);
    if target != here {
        println!("note: the limit was recorded for {target}, measured on {here}");
    }
    let size = std::fs::metadata(&binary)?.len();
    let describe = |bytes: u64| format!("{} ({bytes} bytes)", imp::file_size::format_size(bytes));
    println!("imp binary: {}", describe(size));
    println!("size limit: {}", describe(max_bytes));
    if size > max_bytes {
        bail!(
            "the imp binary is {} over the size limit - shrink the binary or raise \"maxBytes\" in binary-size-limit.json",
            describe(size - max_bytes)
        );
    }
    println!(
        "within the limit - {:.1}% headroom",
        (1.0 - size as f64 / max_bytes as f64) * 100.0
    );
    Ok(())
}
