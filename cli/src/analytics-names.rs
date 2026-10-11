use anyhow::Result;
use std::collections::HashMap;
use std::path::Path;

pub fn collect_bundle_names(_root: &Path, _inputs: &[String], _inline: &HashMap<String, String>) -> Result<(Vec<String>, Vec<String>)> {
    Ok((Vec::new(), Vec::new()))
}
