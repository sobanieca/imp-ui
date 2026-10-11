use anyhow::{Result, bail};
use std::path::{Path, PathBuf};

pub fn public_copy_of_entry(root: &Path, entry_name: &str) -> Option<PathBuf> {
    let path = crate::config::public_directory(root).join(entry_name);
    path.is_file().then_some(path)
}

pub fn resolve_entry_path(entry: &str, expected: &str) -> Result<PathBuf> {
    let entry_path = crate::paths::absolute(entry);
    match std::fs::metadata(&entry_path) {
        Err(_) => {
            let entry_name = crate::paths::file_name(&entry_path);
            let indent = " ".repeat("[ERROR] ".len());
            if public_copy_of_entry(entry_path.parent().unwrap_or(Path::new("/")), &entry_name).is_some() {
                bail!(
                    "file not found: {}\n{indent}public/{entry_name} exists - move it to the project root: public/ ships verbatim, while the entry page is the one imp bundles, injects environment values into and adds PWA tags to",
                    entry_path.display()
                );
            }
            bail!("file not found: {}", entry_path.display());
        }
        Ok(meta) if meta.is_dir() => bail!("expected {expected}, got a directory: {entry}"),
        Ok(_) => Ok(entry_path),
    }
}
