use crate::paths::{extension, posix, relative};
use anyhow::{Result, bail};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub const ALWAYS_SKIPPED_DIRECTORIES: [&str; 4] = [".git", "node_modules", "dist", ".imp"];

const VENDORED_DEPENDENCIES: &str = "dependencies";

pub fn is_within_prefix(relative_path: &str, entry: &str) -> bool {
    let path = relative_path.replace('\\', "/");
    let prefix = entry.trim_end_matches('/');
    path == prefix || path.starts_with(&format!("{prefix}/"))
}

pub fn is_skipped_path(path: &str) -> bool {
    path.split(['/', '\\'])
        .any(|segment| ALWAYS_SKIPPED_DIRECTORIES.contains(&segment))
}

pub struct Collect<'a> {
    pub root: &'a Path,
    pub paths: &'a [String],
    pub extensions: &'a [&'a str],
    pub exclude: &'a [String],
}

pub fn collect_files(options: Collect) -> Result<Vec<PathBuf>> {
    let Collect {
        root,
        paths,
        extensions,
        exclude,
    } = options;
    let extensions: HashSet<&str> = extensions.iter().copied().collect();
    let mut files = Vec::new();
    let excluded = |path: &Path| {
        let relative_path = posix(relative(root, path));
        let segments: Vec<&str> = relative_path.split('/').collect();
        if segments
            .iter()
            .any(|segment| ALWAYS_SKIPPED_DIRECTORIES.contains(segment))
        {
            return true;
        }
        if segments.first() == Some(&VENDORED_DEPENDENCIES) {
            return true;
        }
        exclude
            .iter()
            .any(|entry| is_within_prefix(&relative_path, entry))
    };
    fn walk(
        directory: &Path,
        excluded: &dyn Fn(&Path) -> bool,
        extensions: &HashSet<&str>,
        files: &mut Vec<PathBuf>,
    ) -> Result<()> {
        let mut entries: Vec<_> = std::fs::read_dir(directory)?.flatten().collect();
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let path = entry.path();
            if excluded(&path) {
                continue;
            }
            let file_type = entry.file_type()?;
            let file_type = if file_type.is_symlink() {
                match std::fs::metadata(&path) {
                    Ok(meta) => meta.file_type(),
                    Err(_) => continue,
                }
            } else {
                file_type
            };
            if file_type.is_dir() {
                walk(&path, excluded, extensions, files)?;
            } else if file_type.is_file() && extensions.contains(extension(&path).as_str()) {
                files.push(path);
            }
        }
        Ok(())
    }
    let targets: Vec<String> = if paths.is_empty() {
        vec![".".into()]
    } else {
        paths.to_vec()
    };
    for target in targets {
        let path = crate::paths::resolve(root, &target);
        let Ok(meta) = std::fs::metadata(&path) else {
            bail!("path not found: {target}")
        };
        if meta.is_dir() {
            walk(&path, &excluded, &extensions, &mut files)?;
        } else if extensions.contains(extension(&path).as_str()) {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}
