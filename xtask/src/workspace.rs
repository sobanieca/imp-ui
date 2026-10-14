use anyhow::{Context, Result, bail};
use std::path::{Path, PathBuf};
use std::process::Command;

pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf()
}

fn cargo_command() -> Command {
    let mut command = Command::new(std::env::var("CARGO").unwrap_or_else(|_| "cargo".into()));
    command.current_dir(repo_root());
    command
}

pub fn cargo(args: &[&str]) -> Result<()> {
    cargo_with(args, &[])
}

pub fn cargo_with(args: &[&str], environment: &[(&str, &str)]) -> Result<()> {
    let mut command = cargo_command();
    command.args(args);
    for (name, value) in environment {
        command.env(name, value);
    }
    let status = command
        .status()
        .with_context(|| format!("cannot run cargo {}", args.join(" ")))?;
    if !status.success() {
        bail!("cargo {} failed", args.join(" "));
    }
    Ok(())
}

fn binary_name() -> &'static str {
    if cfg!(windows) { "imp.exe" } else { "imp" }
}

pub fn build_imp(profile: &str) -> Result<PathBuf> {
    cargo(&["build", "--quiet", "--profile", profile, "--package", "imp"])?;
    let folder = if profile == "dev" { "debug" } else { profile };
    Ok(repo_root().join("target").join(folder).join(binary_name()))
}

pub fn run_imp(binary: &Path, args: &[&str], dir: &Path) -> Result<()> {
    run_imp_with(binary, args, dir, &[])
}

pub fn run_imp_with(
    binary: &Path,
    args: &[&str],
    dir: &Path,
    environment: &[(&str, &str)],
) -> Result<()> {
    let status = Command::new(binary)
        .args(args)
        .current_dir(dir)
        .envs(environment.iter().copied())
        .status()
        .with_context(|| format!("cannot run imp {}", args.join(" ")))?;
    if !status.success() {
        bail!(
            "imp {} failed in {}",
            args.join(" "),
            imp::paths::relative_posix(&repo_root(), dir)
        );
    }
    Ok(())
}

pub fn tracked_files() -> Result<Vec<String>> {
    let output = Command::new("git")
        .args(["ls-files", "--cached", "--others", "--exclude-standard"])
        .current_dir(repo_root())
        .output()
        .context("cannot run git ls-files")?;
    if !output.status.success() {
        bail!("git ls-files failed");
    }
    let root = repo_root();
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|path| root.join(path).is_file())
        .map(str::to_string)
        .collect())
}
