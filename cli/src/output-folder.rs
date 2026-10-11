use crate::paths::{is_within, relative_posix};
use anyhow::{Result, bail};
use std::path::Path;

pub const OUTPUT_MARKER: &str = ".imp-output";
const OUTPUT_MARKER_TEXT: &str = "imp wrote this folder. imp deletes the folder and writes it again on each build.\n";

fn shown(path: &Path) -> String {
    let relative = relative_posix(&crate::paths::cwd(), path);
    if relative.is_empty() { ".".into() } else { relative }
}

pub fn assert_output_folder(outdir: &Path, output: &str, root: &Path, sources: &[&Path], inside_public: bool) -> Result<()> {
    if is_within(outdir, root) || is_within(outdir, &crate::config::project_root(root)) {
        bail!("the output folder must not be the project or contain it: {output}");
    }
    let public = crate::config::public_directory(root);
    if is_within(outdir, &public) {
        bail!("the output folder must not be public/ or contain it: {output}");
    }
    if !inside_public && is_within(&public, outdir) {
        bail!("the output folder must not be inside public/, because imp copies public/ into it: {output}");
    }
    if let Some(source) = sources.iter().find(|source| is_within(outdir, source)) {
        bail!("the output folder must not contain a source of the project: {output} holds {}", shown(source));
    }
    let Ok(meta) = std::fs::metadata(outdir) else { return Ok(()) };
    if !meta.is_dir() {
        bail!("the output folder is a file: {output} - pick a folder for the output");
    }
    let names: Vec<String> = std::fs::read_dir(outdir)?.flatten().map(|entry| entry.file_name().to_string_lossy().into_owned()).collect();
    if names.is_empty() || names.iter().any(|name| name == OUTPUT_MARKER) {
        return Ok(());
    }
    bail!(
        "the output folder {output} holds files that imp did not write - imp deletes the output folder before it writes into it, so pick a new or empty folder, or delete {output} yourself"
    )
}

pub fn replace_output_folder(outdir: &Path) -> Result<()> {
    match std::fs::remove_dir_all(outdir) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    std::fs::create_dir_all(outdir)?;
    std::fs::write(outdir.join(OUTPUT_MARKER), OUTPUT_MARKER_TEXT)?;
    Ok(())
}
