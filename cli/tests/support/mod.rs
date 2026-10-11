#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::process::{Command, Output};

pub fn tests_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests")
}

pub fn fixture(name: &str) -> PathBuf {
    tests_dir().join("fixtures").join(name)
}

fn diff_lines(expected: &str, actual: &str) -> String {
    let expected: Vec<&str> = expected.split('\n').collect();
    let actual: Vec<&str> = actual.split('\n').collect();
    let mut lines = Vec::new();
    for index in 0..expected.len().max(actual.len()) {
        if expected.get(index) == actual.get(index) {
            continue;
        }
        if let Some(line) = expected.get(index) {
            lines.push(format!("- {line}"));
        }
        if let Some(line) = actual.get(index) {
            lines.push(format!("+ {line}"));
        }
    }
    lines.join("\n")
}

pub fn assert_snapshot(name: &str, actual: &str) {
    let path = tests_dir().join("snapshots").join(format!("{name}.txt"));
    if std::env::var_os("UPDATE_SNAPSHOTS").is_some() {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, actual).unwrap();
        return;
    }
    let Ok(expected) = std::fs::read_to_string(&path) else {
        panic!(
            "missing snapshot cli/tests/snapshots/{name}.txt - run `cargo update-snapshots` to create it\n\n{actual}"
        );
    };
    if expected != actual {
        panic!(
            "snapshot mismatch in cli/tests/snapshots/{name}.txt (- expected, + actual):\n{}\n\nrun `cargo update-snapshots` if the new output is correct",
            diff_lines(&expected, actual)
        );
    }
}

pub fn imp_command(cwd: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_imp"));
    command
        .current_dir(cwd)
        .env("NO_COLOR", "1")
        .env("IMP_NO_UPDATE_CHECK", "1");
    command
}

pub fn run_imp(cwd: &Path, args: &[&str]) -> Output {
    imp_command(cwd).args(args).output().expect("imp runs")
}

pub fn check(condition: bool, message: impl AsRef<str>) {
    assert!(condition, "{}", message.as_ref());
}
