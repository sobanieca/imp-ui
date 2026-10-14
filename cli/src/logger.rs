use crate::colors::{blue, cyan, dim, magenta, red, strip_ansi, yellow};
use std::sync::{Arc, Mutex};

type Sink = Arc<dyn Fn(&str) + Send + Sync>;

static SINKS: Mutex<Vec<(usize, Sink)>> = Mutex::new(Vec::new());
static NEXT_SINK: Mutex<usize> = Mutex::new(0);

pub struct SinkGuard(usize);

impl Drop for SinkGuard {
    fn drop(&mut self) {
        SINKS.lock().unwrap().retain(|(id, _)| *id != self.0);
    }
}

pub fn add_sink(sink: impl Fn(&str) + Send + Sync + 'static) -> SinkGuard {
    let mut next = NEXT_SINK.lock().unwrap();
    *next += 1;
    let id = *next;
    SINKS.lock().unwrap().push((id, Arc::new(sink)));
    SinkGuard(id)
}

fn emit(to_stderr: bool, header: String, message: &str) {
    let line = format!("{header} {message}");
    if to_stderr {
        eprintln!("{line}");
    } else {
        println!("{line}");
    }
    let sinks: Vec<Sink> = SINKS
        .lock()
        .unwrap()
        .iter()
        .map(|(_, sink)| sink.clone())
        .collect();
    if !sinks.is_empty() {
        let plain = strip_ansi(&line);
        for sink in sinks {
            sink(&plain);
        }
    }
}

pub fn error(message: &str) {
    emit(true, red("[ERROR]"), message);
}
pub fn warn(message: &str) {
    emit(false, yellow("[WARN]"), message);
}
pub fn info(message: &str) {
    emit(false, cyan("[INFO]"), message);
}
pub fn debug(message: &str) {
    emit(false, dim("[DEBUG]"), message);
}
pub fn http(message: &str) {
    emit(false, blue("[HTTP]"), message);
}
pub fn browser(level: &str, message: &str) {
    let header = format!("[BROWSER:{level}]");
    let colored = match level {
        "error" | "uncaught" => red(header),
        "warn" => yellow(header),
        "info" => cyan(header),
        _ => magenta(header),
    };
    emit(false, colored, message);
}
