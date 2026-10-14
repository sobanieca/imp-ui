use anyhow::{Result, bail};
use std::path::PathBuf;

pub fn imp_cache_directory() -> Result<PathBuf> {
    if let Some(dir) = std::env::var_os("IMP_CACHE_DIR").filter(|dir| !dir.is_empty()) {
        return Ok(crate::paths::absolute(PathBuf::from(dir)));
    }
    match crate::paths::home_dir() {
        Some(home) => Ok(home.join(".imp")),
        None => bail!("cannot locate the imp cache folder - set IMP_CACHE_DIR or HOME"),
    }
}
