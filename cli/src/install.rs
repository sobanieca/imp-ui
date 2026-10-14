use crate::config::{
    ConfigChange, Insertion, config_target_path, get_strings, load_imp_config, update_config_file,
};
use crate::dependency_manifest::{
    DEPENDENCY_MANIFEST_FILE, dependency_manifest, manifest_file_contents, record_package_licenses,
    unlicensed_packages,
};
use crate::deps::bundle_dependency;
use crate::file_size::{MAX_FILE_SIZE_HINT, format_size, is_file_size_ignored, max_file_bytes};
use crate::license_policy::{
    Policy, license_policy, license_violation_problem, package_id, review_licenses,
    unknown_license_warning,
};
use crate::logger;
use crate::skill::COMPONENT_SKILL_FILE;
use crate::specifiers::{EXACT_VERSION, default_alias, is_valid_alias, parse_specifier};
use anyhow::{Result, anyhow, bail};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub const LICENSE_NOTICES_FILE: &str = "LICENSES.txt";

struct Target {
    alias: String,
    scheme: String,
    name: String,
    version: Option<String>,
    subpath: String,
}

pub struct Prepared {
    alias: String,
    specifier: String,
    files: Vec<(String, Vec<u8>)>,
    manifest: Value,
    unknown: Vec<crate::license_policy::Unknown>,
    imp_imports: Vec<String>,
}

impl Prepared {
    pub fn new(
        alias: &str,
        specifier: &str,
        files: Vec<(String, Vec<u8>)>,
        manifest: Value,
    ) -> Prepared {
        Prepared {
            alias: alias.to_string(),
            specifier: specifier.to_string(),
            files,
            manifest,
            unknown: Vec::new(),
            imp_imports: Vec::new(),
        }
    }
}

pub trait ProjectFileSystem {
    fn write_file(&self, path: &Path, bytes: &[u8]) -> std::io::Result<()>;
    fn rename(&self, from: &Path, to: &Path) -> std::io::Result<()>;
    fn update_config(&self, path: &Path, changes: &[ConfigChange]) -> Result<()>;
}

pub struct DiskFileSystem;

impl ProjectFileSystem for DiskFileSystem {
    fn write_file(&self, path: &Path, bytes: &[u8]) -> std::io::Result<()> {
        std::fs::write(path, bytes)
    }

    fn rename(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        std::fs::rename(from, to)
    }

    fn update_config(&self, path: &Path, changes: &[ConfigChange]) -> Result<()> {
        update_config_file(path, changes)
    }
}

fn latest_version(scheme: &str, name: &str) -> Result<String> {
    let npm = crate::npm::shared()?;
    npm.latest_version(&crate::npm::npm_name_of(scheme, name))
}

pub fn component_skill(specifier: &str, entry: Option<&Path>) -> Result<(String, Vec<u8>)> {
    let text = entry
        .and_then(|entry| std::fs::read_to_string(entry.with_file_name(COMPONENT_SKILL_FILE)).ok());
    match text {
        Some(text) => Ok((COMPONENT_SKILL_FILE.to_string(), text.into_bytes())),
        None => bail!(
            "{specifier} imports imp, so it is an imp component, and it has no {COMPONENT_SKILL_FILE} next to its entry module - its author builds it with imp build, which writes {COMPONENT_SKILL_FILE} beside the bundle, and publishes it with the bundle"
        ),
    }
}

fn prepare_one(root: &Path, target: &Target, policy: &Policy) -> Result<Prepared> {
    let version = match &target.version {
        Some(version) => version.clone(),
        None => latest_version(&target.scheme, &target.name)?,
    };
    let specifier = format!(
        "{}:{}@{version}{}",
        target.scheme, target.name, target.subpath
    );
    let bundled = bundle_dependency(root, &specifier, &target.alias)
        .map_err(|error| anyhow!("{}", error.describe()))?;
    let mut files = bundled.files;
    if !bundled.imp_imports.is_empty() {
        files.push(component_skill(&specifier, bundled.entry.as_deref())?);
    }
    let mut packages = bundled.packages;
    crate::integrity::verify_packages(&mut packages)?;
    let manifest = dependency_manifest(
        &target.alias,
        &specifier,
        record_package_licenses(&packages),
        &bundled.imp_imports,
    );
    let (violations, unknown) = review_licenses(std::slice::from_ref(&manifest), policy);
    if !violations.is_empty() {
        bail!("{}", license_violation_problem(&violations, policy));
    }
    Ok(Prepared {
        alias: target.alias.clone(),
        specifier,
        files,
        manifest,
        unknown,
        imp_imports: bundled.imp_imports,
    })
}

fn warn_about_size(max_bytes: u64, ignore: &[String], prepared: &Prepared) {
    let counted: u64 = prepared
        .files
        .iter()
        .filter(|(name, _)| {
            !is_file_size_ignored(&format!("dependencies/{}/{name}", prepared.alias), ignore)
        })
        .map(|(_, bytes)| bytes.len() as u64)
        .sum();
    if counted > max_bytes {
        logger::warn(&format!(
            "{} bundles to {}, which will be committed into your git repository - {MAX_FILE_SIZE_HINT}",
            prepared.specifier,
            format_size(counted)
        ));
    }
}

fn report_installed(prepared: &Prepared) {
    println!("installed {} ({})", prepared.alias, prepared.specifier);
    for (name, bytes) in &prepared.files {
        println!(
            "  dependencies/{}/{name} ({})",
            prepared.alias,
            format_size(bytes.len() as u64)
        );
    }
    println!(
        "  dependencies/{}/{DEPENDENCY_MANIFEST_FILE} (packages, versions, licenses)",
        prepared.alias
    );
    println!("  bundled packages:");
    let packages = prepared
        .manifest
        .get("packages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for entry in &packages {
        let attestation = if entry.get("attestationListed").and_then(Value::as_bool) == Some(true) {
            ", attestation listed by the registry"
        } else {
            ""
        };
        println!(
            "    {} - {}{attestation}",
            package_id(entry),
            entry
                .get("license")
                .and_then(Value::as_str)
                .unwrap_or("license not declared")
        );
    }
    let checked = packages
        .iter()
        .filter(|entry| entry.get("integrity").is_some_and(|value| !value.is_null()))
        .count();
    if checked > 0 {
        println!(
            "  integrity: {checked} npm package{} checked against the signed hash of the npm registry",
            if checked == 1 { "" } else { "s" }
        );
    }
    let undeclared = unlicensed_packages(&prepared.manifest);
    if !undeclared.is_empty() {
        logger::warn(&format!(
            "no license text found for {} - {LICENSE_NOTICES_FILE} will not carry a notice for {}",
            undeclared.join(", "),
            if undeclared.len() == 1 { "it" } else { "them" }
        ));
    }
    if !prepared.unknown.is_empty() {
        logger::warn(&unknown_license_warning(&prepared.unknown));
    }
    if !prepared.imp_imports.is_empty() {
        println!(
            "  imp imports kept bare (resolved by this app at runtime): {}",
            prepared.imp_imports.join(", ")
        );
        println!(
            "    note: this package runs against the imp version this app provides, not the one it was built with"
        );
    }
}

struct Swap {
    target: PathBuf,
    aside: PathBuf,
    moved_aside: bool,
    placed: bool,
}

pub fn commit_dependencies(
    root: &Path,
    prepared: &[Prepared],
    changes: &[ConfigChange],
    fs: &dyn ProjectFileSystem,
) -> Result<()> {
    let folder = root.join("dependencies");
    for dependency in prepared {
        if !is_valid_alias(&dependency.alias) {
            bail!(
                "invalid dependency alias: '{}' - imp writes a dependency only into its own folder of dependencies/",
                dependency.alias
            );
        }
    }
    let work = root.join(".imp");
    let created_work = !work.exists();
    let created_folder = !folder.exists();
    let staging = work.join(format!(
        "install-{}-{}",
        std::process::id(),
        crate::time::now_millis()
    ));
    let config_path = config_target_path(root);
    let config_before = std::fs::read_to_string(&config_path).ok();
    let mut swaps: Vec<Swap> = Vec::new();
    let mut config_touched = false;
    let attempt = (|| -> Result<()> {
        for dependency in prepared {
            let target = staging.join("new").join(&dependency.alias);
            std::fs::create_dir_all(&target)?;
            for (name, bytes) in &dependency.files {
                fs.write_file(&target.join(name), bytes)?;
            }
            fs.write_file(
                &target.join(DEPENDENCY_MANIFEST_FILE),
                manifest_file_contents(&dependency.manifest).as_bytes(),
            )?;
        }
        std::fs::create_dir_all(staging.join("old"))?;
        std::fs::create_dir_all(&folder)?;
        for dependency in prepared {
            let mut swap = Swap {
                target: folder.join(&dependency.alias),
                aside: staging.join("old").join(&dependency.alias),
                moved_aside: false,
                placed: false,
            };
            if std::fs::symlink_metadata(&swap.target).is_ok() {
                fs.rename(&swap.target, &swap.aside)?;
                swap.moved_aside = true;
            }
            let placed = fs.rename(&staging.join("new").join(&dependency.alias), &swap.target);
            swap.placed = placed.is_ok();
            swaps.push(swap);
            placed?;
        }
        config_touched = true;
        fs.update_config(&config_path, changes)
    })();
    let mut keep_staging = false;
    let outcome = match attempt {
        Ok(()) => Ok(()),
        Err(error) => {
            let mut problems = Vec::new();
            for swap in swaps.iter().rev() {
                if swap.placed
                    && let Err(problem) = std::fs::remove_dir_all(&swap.target)
                {
                    problems.push(format!("remove {}: {problem}", swap.target.display()));
                }
                if swap.moved_aside
                    && let Err(problem) = std::fs::rename(&swap.aside, &swap.target)
                {
                    problems.push(format!("restore {}: {problem}", swap.target.display()));
                }
            }
            if config_touched {
                let restored = match &config_before {
                    None => std::fs::remove_file(&config_path),
                    Some(text) => std::fs::write(&config_path, text),
                };
                if let Err(problem) = restored {
                    problems.push(format!("restore {}: {problem}", config_path.display()));
                }
            }
            if created_folder {
                let _ = std::fs::remove_dir(&folder);
            }
            if problems.is_empty() {
                Err(anyhow!("{error} - nothing was installed"))
            } else {
                keep_staging = true;
                Err(anyhow!(
                    "{error} - and the rollback failed ({}); the previous versions are in {}",
                    problems.join("; "),
                    staging.join("old").display()
                ))
            }
        }
    };
    if !keep_staging {
        let _ = std::fs::remove_dir_all(&staging);
        if created_work {
            let _ = std::fs::remove_dir(&work);
        }
    }
    outcome
}

fn declared_target(alias: &str, specifier: &str, version: Option<String>) -> Result<Target> {
    match parse_specifier(specifier) {
        Some(declared) if declared.scheme.is_some() => Ok(Target {
            alias: alias.to_string(),
            scheme: declared.scheme.unwrap(),
            name: declared.name,
            version,
            subpath: declared.subpath,
        }),
        _ => bail!("invalid specifier for dependency '{alias}' in imp.json: '{specifier}'"),
    }
}

fn requested_target(
    package: &str,
    version: Option<String>,
    alias: Option<String>,
    dependencies: &[(String, String)],
) -> Result<Target> {
    let Some(parsed) = parse_specifier(package) else {
        bail!("invalid package specifier: '{package}'")
    };
    if let (Some(first), Some(second)) = (&parsed.version, &version) {
        bail!("two versions given: '{first}' and '{second}'");
    }
    let version = parsed.version.clone().or(version);
    if let Some(version) = &version
        && !EXACT_VERSION.is_match(version)
    {
        bail!(
            "'{version}' is not an exact version - give an exact version (e.g. 1.2.3) or omit it to resolve the latest"
        );
    }
    if parsed.scheme.is_none()
        && parsed.subpath.is_empty()
        && alias.is_none()
        && let Some((name, specifier)) = dependencies.iter().find(|(name, _)| *name == parsed.name)
    {
        return declared_target(name, specifier, version);
    }
    if parsed.scheme.as_deref() == Some("jsr") && !parsed.name.starts_with('@') {
        bail!("jsr packages are scoped: 'jsr:@scope/name', got '{package}'");
    }
    let alias = alias.unwrap_or_else(|| default_alias(&parsed));
    if !is_valid_alias(&alias) {
        bail!("invalid dependency alias: '{alias}'");
    }
    if alias == "imp" {
        bail!(
            "'imp' is reserved for the imp library, which every app can already import - pick a different alias"
        );
    }
    Ok(Target {
        alias,
        scheme: parsed.scheme.unwrap_or_else(|| "npm".into()),
        name: parsed.name,
        version,
        subpath: parsed.subpath,
    })
}

pub fn install(
    root: &Path,
    package: Option<String>,
    version: Option<String>,
    alias: Option<String>,
) -> Result<()> {
    let config = load_imp_config(root)?;
    let dependencies = crate::config::dependencies(&config);
    let max_bytes = max_file_bytes(&config);
    let policy = license_policy(&config);
    let ignore = get_strings(&config, &["maxFileSizeIgnore"]);
    let mut targets = Vec::new();
    match package {
        Some(package) => targets.push(requested_target(&package, version, alias, &dependencies)?),
        None => {
            if version.is_some() || alias.is_some() {
                bail!("a version or alias requires a package name");
            }
            if dependencies.is_empty() {
                println!("nothing to install - no dependencies declared in imp.json");
                return Ok(());
            }
            for (alias, specifier) in &dependencies {
                targets.push(declared_target(alias, specifier, None)?);
            }
        }
    }
    let mut prepared = Vec::new();
    for target in &targets {
        prepared.push(prepare_one(root, target, &policy)?);
    }
    for dependency in &prepared {
        warn_about_size(max_bytes, &ignore, dependency);
    }
    let changes: Vec<ConfigChange> = prepared
        .iter()
        .map(|dependency| ConfigChange {
            path: vec!["dependencies".into(), dependency.alias.clone()],
            value: Some(Value::String(dependency.specifier.clone())),
            insertion: Insertion::Alphabetical,
        })
        .collect();
    commit_dependencies(root, &prepared, &changes, &DiskFileSystem)?;
    for dependency in &prepared {
        report_installed(dependency);
    }
    Ok(())
}

pub fn uninstall(root: &Path, alias: Option<String>) -> Result<()> {
    let Some(alias) = alias else {
        bail!("usage: imp uninstall <package>")
    };
    let config = load_imp_config(root)?;
    let dependencies = crate::config::dependencies(&config);
    let Some((_, specifier)) = dependencies
        .iter()
        .find(|(name, _)| *name == alias)
        .filter(|(_, spec)| !spec.is_empty())
    else {
        bail!("'{alias}' is not a declared dependency in imp.json");
    };
    if is_valid_alias(&alias) {
        let _ = std::fs::remove_dir_all(root.join("dependencies").join(&alias));
    }
    let change = if dependencies.len() > 1 {
        ConfigChange {
            path: vec!["dependencies".into(), alias.clone()],
            value: None,
            insertion: Insertion::End,
        }
    } else {
        ConfigChange {
            path: vec!["dependencies".into()],
            value: None,
            insertion: Insertion::End,
        }
    };
    update_config_file(&config_target_path(root), &[change])?;
    println!("uninstalled {alias} ({specifier})");
    Ok(())
}
