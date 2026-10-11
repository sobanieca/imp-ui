use std::path::{Component, Path, PathBuf};

pub fn posix(path: impl AsRef<Path>) -> String {
    path.as_ref().to_string_lossy().replace('\\', "/")
}

pub fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    out.push("..");
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

pub fn absolute(path: impl AsRef<Path>) -> PathBuf {
    let path = path.as_ref();
    if path.is_absolute() {
        normalize(path)
    } else {
        normalize(&cwd().join(path))
    }
}

pub fn resolve(base: &Path, path: impl AsRef<Path>) -> PathBuf {
    normalize(&base.join(path))
}

pub fn cwd() -> PathBuf {
    std::env::current_dir().expect("the current folder is readable")
}

pub fn relative(from: &Path, to: &Path) -> PathBuf {
    let from = normalize(from);
    let to = normalize(to);
    let from_parts: Vec<_> = from.components().collect();
    let to_parts: Vec<_> = to.components().collect();
    let common = from_parts
        .iter()
        .zip(&to_parts)
        .take_while(|(a, b)| a == b)
        .count();
    let mut out = PathBuf::new();
    for _ in common..from_parts.len() {
        out.push("..");
    }
    for part in &to_parts[common..] {
        out.push(part.as_os_str());
    }
    out
}

pub fn relative_posix(from: &Path, to: &Path) -> String {
    posix(relative(from, to))
}

pub fn extension(path: &Path) -> String {
    path.extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

pub fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

pub fn without_extension(path: &str) -> &str {
    match path.rfind('.') {
        Some(dot) if !path[dot..].contains('/') => &path[..dot],
        _ => path,
    }
}

pub fn is_within(parent: &Path, path: &Path) -> bool {
    normalize(path).starts_with(normalize(parent))
}

pub fn exists(path: &Path) -> bool {
    std::fs::metadata(path).is_ok()
}

pub fn is_file(path: &Path) -> bool {
    std::fs::metadata(path).is_ok_and(|meta| meta.is_file())
}

pub fn is_dir(path: &Path) -> bool {
    std::fs::metadata(path).is_ok_and(|meta| meta.is_dir())
}

pub fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .filter(|home| !home.is_empty())
        .or_else(|| std::env::var_os("USERPROFILE").filter(|home| !home.is_empty()))
        .map(PathBuf::from)
}
