use std::path::Path;

pub fn install(_root: &Path, _package: Option<String>, _version: Option<String>, _alias: Option<String>) -> anyhow::Result<()> {
    anyhow::bail!("imp install is not ported yet")
}

pub fn uninstall(_root: &Path, _alias: Option<String>) -> anyhow::Result<()> {
    anyhow::bail!("imp uninstall is not ported yet")
}
