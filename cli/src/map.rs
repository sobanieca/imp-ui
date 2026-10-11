use anyhow::{Result, bail};
use std::path::Path;

pub fn route_patterns_of_project(_root: &Path, _map: &str, _dependencies: &[String]) -> Result<Vec<String>> {
    bail!("imp map is not ported yet")
}

pub fn print_map(_cwd: &Path, _file: Option<String>) -> Result<()> {
    bail!("imp map is not ported yet")
}
