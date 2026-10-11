use crate::config::load_imp_config;
use crate::dev_log::{DEFAULT_MAX_LOG_ENTRIES, dev_log_path};
use crate::paths::relative_posix;
use anyhow::{Result, bail};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

const NOT_SEARCHED: [&str; 5] = [".git", ".imp", "node_modules", "dist", "dependencies"];

fn nested_log_folders(root: &Path) -> Vec<String> {
    let mut found = Vec::new();
    fn search(root: &Path, directory: &Path, found: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(directory) else { return };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !entry.file_type().is_ok_and(|kind| kind.is_dir()) || NOT_SEARCHED.contains(&name.as_str()) {
                continue;
            }
            let folder = entry.path();
            if dev_log_path(&folder).exists() {
                found.push(relative_posix(root, &folder));
            }
            search(root, &folder, found);
        }
    }
    search(root, root, &mut found);
    found.sort();
    found
}

fn no_log_message(root: &Path, path: &Path) -> String {
    let nested = nested_log_folders(root);
    if nested.is_empty() {
        return format!("no dev server has run in this project - imp start writes the log to {}", path.display());
    }
    let place = if nested.len() == 1 { "that folder" } else { "one of them" };
    format!(
        "no session log at {} - there is one in {}, run imp logs from {place}",
        path.display(),
        nested.join(", ")
    )
}

fn print(text: &str) {
    let mut stdout = std::io::stdout().lock();
    if stdout.write_all(text.as_bytes()).and_then(|_| stdout.flush()).is_err() {
        std::process::exit(0);
    }
}

fn entries_of(text: &str) -> Vec<String> {
    let mut entries: Vec<String> = text.split('\n').map(String::from).collect();
    if entries.last().is_some_and(String::is_empty) {
        entries.pop();
    }
    entries
}

fn complete_length(bytes: &[u8]) -> usize {
    bytes.iter().rposition(|byte| *byte == b'\n').map_or(0, |index| index + 1)
}

fn already_printed_prefix(file_entries: &[String], printed: &[String]) -> usize {
    for length in (1..=file_entries.len().min(printed.len())).rev() {
        if file_entries[..length] == printed[printed.len() - length..] {
            return length;
        }
    }
    0
}

fn follow(path: PathBuf, remember: usize, start_offset: usize, printed: Vec<String>) {
    let mut offset = start_offset;
    let mut recent: Vec<String> = printed[printed.len().saturating_sub(remember)..].to_vec();
    let emit = |entries: Vec<String>, recent: &mut Vec<String>| {
        if entries.is_empty() {
            return;
        }
        print(&format!("{}\n", entries.join("\n")));
        recent.extend(entries);
        if recent.len() > remember {
            recent.drain(..recent.len() - remember);
        }
    };
    loop {
        if let Ok(mut file) = std::fs::File::open(&path) {
            let size = file.metadata().map(|meta| meta.len() as usize).unwrap_or(0);
            if size != offset {
                let rewritten = size < offset || offset == 0;
                let from = if rewritten { 0 } else { offset };
                let mut bytes = Vec::new();
                if file.seek(SeekFrom::Start(from as u64)).is_ok() && file.read_to_end(&mut bytes).is_ok() {
                    let complete = complete_length(&bytes);
                    let entries = entries_of(&String::from_utf8_lossy(&bytes[..complete]));
                    if rewritten {
                        offset = complete;
                        let skip = already_printed_prefix(&entries, &recent);
                        emit(entries[skip..].to_vec(), &mut recent);
                    } else if complete > 0 {
                        offset += complete;
                        emit(entries, &mut recent);
                    }
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

pub fn logs(root: &Path, count: Option<usize>, keep_open: bool) -> Result<()> {
    let path = crate::paths::absolute(dev_log_path(root));
    let bytes = match std::fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => bail!("{}", no_log_message(root, &path)),
        Err(error) => return Err(error.into()),
    };
    let complete = if keep_open { complete_length(&bytes) } else { bytes.len() };
    let entries = entries_of(&String::from_utf8_lossy(&bytes[..complete]));
    let shown = match count {
        Some(count) => &entries[entries.len().saturating_sub(count)..],
        None => &entries[..],
    };
    if !shown.is_empty() {
        print(&format!("{}\n", shown.join("\n")));
    }
    if !keep_open {
        return Ok(());
    }
    let config = load_imp_config(root)?;
    let max = config.get("maxLogEntries").and_then(|value| value.as_u64()).map(|value| value as usize);
    let remember = max.unwrap_or(DEFAULT_MAX_LOG_ENTRIES).max(entries.len());
    follow(path, remember, complete, entries);
    Ok(())
}
