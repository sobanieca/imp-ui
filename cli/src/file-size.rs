use crate::walk::is_within_prefix;

pub const DEFAULT_MAX_FILE_BYTES: u64 = 200 * 1024;

pub fn format_size(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else if bytes < 1024 * 1024 {
        format!("{:.1} kB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

pub fn max_file_bytes(config: &crate::config::Config) -> u64 {
    config
        .get("maxFileSize")
        .and_then(|value| value.as_f64())
        .map(|value| value as u64)
        .unwrap_or(DEFAULT_MAX_FILE_BYTES)
}

pub fn is_file_size_ignored(relative_path: &str, ignore: &[String]) -> bool {
    ignore
        .iter()
        .any(|entry| is_within_prefix(relative_path, entry))
}

pub const MAX_FILE_SIZE_HINT: &str =
    "raise \"maxFileSize\" or add the path to \"maxFileSizeIgnore\" in imp.json";
