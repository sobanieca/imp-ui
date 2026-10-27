use crate::time::{iso_string, now_millis};
use std::fs::{File, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub const DEFAULT_MAX_LOG_ENTRIES: usize = 4000;

pub fn dev_log_path(root: &Path) -> PathBuf {
    root.join(".imp").join("dev.log")
}

struct State {
    file: File,
    recent: std::collections::VecDeque<String>,
    entries_in_file: usize,
    max_entries: usize,
    closed: bool,
}

#[derive(Clone)]
pub struct DevLog {
    state: Arc<Mutex<State>>,
}

impl DevLog {
    pub fn create(root: &Path, max_entries: usize) -> std::io::Result<DevLog> {
        std::fs::create_dir_all(root.join(".imp"))?;
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(dev_log_path(root))?;
        Ok(DevLog {
            state: Arc::new(Mutex::new(State {
                file,
                recent: Default::default(),
                entries_in_file: 0,
                max_entries,
                closed: false,
            })),
        })
    }

    pub fn write(&self, line: &str) {
        let mut state = self.state.lock().unwrap();
        if state.closed {
            return;
        }
        let entry = format!("{} {}", iso_string(now_millis()), line.replace('\n', " "));
        state.recent.push_back(entry.clone());
        if state.recent.len() > state.max_entries {
            state.recent.pop_front();
        }
        let _ = state.file.write_all(format!("{entry}\n").as_bytes());
        state.entries_in_file += 1;
        if state.entries_in_file >= state.max_entries * 2 {
            let lines: Vec<String> = state.recent.iter().cloned().collect();
            let _ = state.file.set_len(0);
            let _ = state.file.seek(SeekFrom::Start(0));
            if !lines.is_empty() {
                let _ = state
                    .file
                    .write_all(format!("{}\n", lines.join("\n")).as_bytes());
            }
            state.entries_in_file = lines.len();
        }
    }

    pub fn recent(&self, limit: usize) -> Vec<String> {
        let state = self.state.lock().unwrap();
        let skip = state.recent.len().saturating_sub(limit);
        state.recent.iter().skip(skip).cloned().collect()
    }

    pub fn close(&self) {
        self.state.lock().unwrap().closed = true;
    }
}
