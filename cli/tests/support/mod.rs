#![allow(dead_code)]

use regex::Regex;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::LazyLock;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn cli_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

pub fn tests_dir() -> PathBuf {
    cli_dir().join("tests")
}

pub fn fixture(name: &str) -> PathBuf {
    tests_dir().join("fixtures").join(name)
}

pub fn imp_binary() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_imp"))
}

pub struct TempDir {
    pub path: PathBuf,
}

impl TempDir {
    pub fn new() -> TempDir {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let path = std::env::temp_dir().join(format!(
            "imp-test-{}-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&path).unwrap();
        TempDir {
            path: path.canonicalize().unwrap(),
        }
    }

    pub fn join(&self, path: &str) -> PathBuf {
        self.path.join(path)
    }

    pub fn text(&self) -> String {
        posix(&self.path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

pub fn posix(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub fn write(path: &Path, text: &str) {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }
    std::fs::write(path, text).unwrap();
}

pub fn read(path: &Path) -> String {
    std::fs::read_to_string(path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

pub fn list_files(dir: &Path) -> Vec<String> {
    fn walk(dir: &Path, prefix: &str, into: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let path = if prefix.is_empty() {
                name.clone()
            } else {
                format!("{prefix}/{name}")
            };
            if entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                walk(&entry.path(), &path, into);
            } else {
                into.push(path);
            }
        }
    }
    let mut found = Vec::new();
    walk(dir, "", &mut found);
    found.sort();
    found
}

pub fn copy_directory(source: &Path, destination: &Path) {
    std::fs::create_dir_all(destination).unwrap();
    for entry in std::fs::read_dir(source).unwrap().flatten() {
        let to = destination.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_directory(&entry.path(), &to);
        } else {
            std::fs::copy(entry.path(), to).unwrap();
        }
    }
}

static ANSI: LazyLock<Regex> = LazyLock::new(|| Regex::new("\x1b\\[[0-9;]*[a-zA-Z]").unwrap());
static MILLIS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\b\d+ms\b").unwrap());
static TIME_ATTRIBUTE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"time="[\d.]+""#).unwrap());
static DURATION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#""durationMs": \d+"#).unwrap());
static STACK: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^( *)at .*:\d+:\d+\)?\n(?:[ ]*at .*:\d+:\d+\)?\n?)*").unwrap()
});

pub fn normalize(text: &str) -> String {
    let text = ANSI.replace_all(text, "");
    let text = text.replace(&format!("{}/", posix(&cli_dir())), "<root>/");
    let text = text.replace(VERSION, "<version>");
    let text = MILLIS.replace_all(&text, "*ms");
    let text = TIME_ATTRIBUTE.replace_all(&text, "time=\"*\"");
    let text = DURATION.replace_all(&text, "\"durationMs\": *");
    STACK
        .replace_all(&text, "${1}at <stack frames>\n")
        .into_owned()
}

pub struct Run {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl Run {
    pub fn replace(mut self, from: &str, to: &str) -> Run {
        self.stdout = self.stdout.replace(from, to);
        self.stderr = self.stderr.replace(from, to);
        self
    }
}

pub fn imp_command(cwd: &Path) -> Command {
    let mut command = Command::new(imp_binary());
    command.current_dir(cwd).env("IMP_NO_UPDATE_CHECK", "1");
    command
}

pub fn run_imp(args: &[&str], cwd: &Path) -> Run {
    run_imp_with(args, cwd, &[])
}

pub fn run_imp_with(args: &[&str], cwd: &Path, env: &[(&str, &str)]) -> Run {
    let output = imp_command(cwd)
        .args(args)
        .envs(env.iter().copied())
        .stdin(Stdio::null())
        .output()
        .expect("imp runs");
    Run {
        code: output.status.code().unwrap_or(-1),
        stdout: normalize(&String::from_utf8_lossy(&output.stdout)),
        stderr: normalize(&String::from_utf8_lossy(&output.stderr)),
    }
}

pub fn section(label: &str, text: &str) -> String {
    let body = if text.trim().is_empty() {
        "(empty)".to_string()
    } else {
        text.trim_end().to_string()
    };
    format!("--- {label} ---\n{body}")
}

pub fn transcript(display: &str, run: &Run) -> String {
    format!(
        "$ {display}\nexit code: {}\n\n{}\n\n{}\n",
        run.code,
        section("stdout", &run.stdout),
        section("stderr", &run.stderr)
    )
}

pub fn fixture_location(cwd: &Path) -> String {
    let relative = posix(cwd.strip_prefix(cli_dir()).unwrap_or(cwd));
    format!("  (cwd: {relative})")
}

pub fn snapshot_command(name: &str, args: &[&str], cwd: Option<&Path>) {
    let dir = cwd.map(Path::to_path_buf).unwrap_or_else(cli_dir);
    let run = run_imp(args, &dir);
    let location = cwd.map(fixture_location).unwrap_or_default();
    let display = format!("imp {}{location}", args.join(" "));
    assert_snapshot(name, &transcript(&display, &run));
}

fn diff_lines(expected: &str, actual: &str) -> String {
    let expected: Vec<&str> = expected.split('\n').collect();
    let actual: Vec<&str> = actual.split('\n').collect();
    let mut lines = Vec::new();
    for index in 0..expected.len().max(actual.len()) {
        if expected.get(index) == actual.get(index) {
            continue;
        }
        if let Some(line) = expected.get(index) {
            lines.push(format!("- {line}"));
        }
        if let Some(line) = actual.get(index) {
            lines.push(format!("+ {line}"));
        }
    }
    lines.join("\n")
}

pub fn assert_snapshot(name: &str, actual: &str) {
    let path = tests_dir().join("snapshots").join(format!("{name}.txt"));
    if std::env::var_os("UPDATE_SNAPSHOTS").is_some() {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, actual).unwrap();
        return;
    }
    let Ok(expected) = std::fs::read_to_string(&path) else {
        panic!(
            "missing snapshot cli/tests/snapshots/{name}.txt - run `cargo update-snapshots` to create it\n\n{actual}"
        );
    };
    if expected != actual {
        panic!(
            "snapshot mismatch in cli/tests/snapshots/{name}.txt (- expected, + actual):\n{}\n\nrun `cargo update-snapshots` if the new output is correct",
            diff_lines(&expected, actual)
        );
    }
}

pub fn check(condition: bool, message: impl AsRef<str>) {
    assert!(condition, "{}", message.as_ref());
}

pub fn has_browser() -> bool {
    std::env::var_os("IMP_TEST_SKIP_BROWSER").is_none()
}

pub struct Server {
    pub port: u16,
    pub banner: String,
    child: Child,
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub fn start_server(cwd: &Path, extra: &[&str], command: &[&str]) -> Server {
    let mut child = imp_command(cwd)
        .args(command)
        .args(["--port", "0"])
        .args(extra)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("imp starts");
    let stdout = child.stdout.take().unwrap();
    let mut reader = BufReader::new(stdout);
    let mut banner = String::new();
    while !banner.contains("imp auto-injected") {
        let mut line = String::new();
        if reader.read_line(&mut line).unwrap_or(0) == 0 {
            break;
        }
        banner.push_str(&line);
    }
    std::thread::spawn(move || {
        let mut sink = Vec::new();
        let _ = reader.read_to_end(&mut sink);
    });
    let plain = ANSI.replace_all(&banner, "").into_owned();
    let port = Regex::new(r"localhost:(\d+)/")
        .unwrap()
        .captures(&plain)
        .and_then(|caps| caps[1].parse().ok())
        .unwrap_or_else(|| panic!("no port in the banner:\n{plain}"));
    Server {
        port,
        banner: plain,
        child,
    }
}

pub fn start_dev(cwd: &Path, extra: &[&str]) -> Server {
    start_server(cwd, extra, &["start", "index.html"])
}

pub fn start_preview(cwd: &Path, extra: &[&str]) -> Server {
    start_server(cwd, extra, &["preview"])
}

pub struct Answer {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Answer {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.as_str())
    }

    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.body).into_owned()
    }
}

pub fn http(
    port: u16,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: Option<&[u8]>,
) -> Answer {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("the server answers");
    stream
        .set_read_timeout(Some(Duration::from_secs(60)))
        .unwrap();
    let mut request = format!("{method} {path} HTTP/1.1\r\nconnection: close\r\n");
    if !headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("host"))
    {
        request.push_str(&format!("host: localhost:{port}\r\n"));
    }
    for (name, value) in headers {
        request.push_str(&format!("{name}: {value}\r\n"));
    }
    let body = body.unwrap_or_default();
    request.push_str(&format!("content-length: {}\r\n\r\n", body.len()));
    stream.write_all(request.as_bytes()).unwrap();
    stream.write_all(body).unwrap();
    let mut raw = Vec::new();
    let _ = stream.read_to_end(&mut raw);
    let split = raw
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .expect("a response head");
    let head = String::from_utf8_lossy(&raw[..split]).into_owned();
    let mut lines = head.split("\r\n");
    let status = lines
        .next()
        .and_then(|line| line.split(' ').nth(1))
        .and_then(|code| code.parse().ok())
        .unwrap_or(0);
    let headers = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
        .collect();
    Answer {
        status,
        headers,
        body: raw[split + 4..].to_vec(),
    }
}

pub fn get(port: u16, path: &str) -> Answer {
    http(port, "GET", path, &[], None)
}

pub const HEADERS_OF_INTEREST: [&str; 4] = [
    "content-type",
    "location",
    "service-worker-allowed",
    "cache-control",
];

pub fn response_transcript(path: &str, answer: &Answer, body: &str) -> String {
    let mut lines = vec![format!("GET {path}"), format!("status: {}", answer.status)];
    for header in HEADERS_OF_INTEREST {
        if let Some(value) = answer.header(header) {
            lines.push(format!("{header}: {value}"));
        }
    }
    format!("{}\n\n{}\n", lines.join("\n"), body.trim_end())
}

pub fn first_reload_event(port: u16, wait: Duration) -> Option<&'static str> {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).ok()?;
    stream
        .set_read_timeout(Some(Duration::from_millis(100)))
        .unwrap();
    let request = format!(
        "GET /@imp/events HTTP/1.1\r\nhost: localhost:{port}\r\nsec-fetch-site: same-origin\r\n\r\n"
    );
    stream.write_all(request.as_bytes()).ok()?;
    let started = Instant::now();
    let mut received = Vec::new();
    while started.elapsed() < wait {
        let mut buffer = [0u8; 1024];
        match stream.read(&mut buffer) {
            Ok(0) => return None,
            Ok(count) => received.extend_from_slice(&buffer[..count]),
            Err(_) => {}
        }
        if String::from_utf8_lossy(&received).contains("data: reload") {
            return Some("reload");
        }
    }
    None
}

pub fn touch(file: &Path) {
    let text = read(file);
    write(file, &format!("{text}\n"));
}

pub fn wait_for(mut condition: impl FnMut() -> bool, wait: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < wait {
        if condition() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    false
}

pub fn git(dir: &Path, args: &[&str]) {
    Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .expect("git runs");
}

pub fn png_size(path: &Path) -> String {
    let bytes = std::fs::read(path).unwrap();
    let is_png = bytes.starts_with(&[0x89, 0x50, 0x4e, 0x47]);
    let read = |offset: usize| u32::from_be_bytes(bytes[offset..offset + 4].try_into().unwrap());
    format!(
        "{}: {} {}x{}",
        path.file_name().unwrap().to_string_lossy(),
        if is_png { "PNG" } else { "NOT PNG" },
        read(16),
        read(20)
    )
}
