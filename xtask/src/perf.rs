use crate::script::call_export;
use crate::workspace::{build_imp, repo_root, run_imp};
use anyhow::{Context, Result, anyhow, bail};
use imp::bundler::{Assets, Format, ImpLibrary, LegalComments, Options, bundle};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;

const FRAMEWORKS: [&str; 3] = ["imp", "react", "vue"];

const DEFAULT_SAMPLES: u64 = 10;

const NPM_DEFINES: &[(&str, &str)] = &[
    ("process.env.NODE_ENV", "\"production\""),
    ("__VUE_OPTIONS_API__", "false"),
    ("__VUE_PROD_DEVTOOLS__", "false"),
    ("__VUE_PROD_HYDRATION_MISMATCH_DETAILS__", "false"),
];

const RUNNER_FILES: &[&str] = &["driver.spec.js", "scenarios.js", "report.js"];

struct RunOptions {
    frameworks: Vec<String>,
    samples: u64,
    filter: Option<String>,
    build: bool,
    profile: bool,
}

fn perf_dir() -> PathBuf {
    repo_root().join("perf")
}

fn parse_arguments(args: &[String]) -> Result<RunOptions> {
    let mut options = RunOptions {
        frameworks: FRAMEWORKS.iter().map(|name| name.to_string()).collect(),
        samples: DEFAULT_SAMPLES,
        filter: None,
        build: true,
        profile: false,
    };
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        let mut value = || {
            rest.next()
                .cloned()
                .ok_or_else(|| anyhow!("{arg} needs a value"))
        };
        match arg.as_str() {
            "--frameworks" => {
                options.frameworks = value()?.split(',').map(str::to_string).collect()
            }
            "--samples" => options.samples = value()?.parse()?,
            "--filter" => options.filter = Some(value()?),
            "--skip-build" => options.build = false,
            "--profile" => options.profile = true,
            other => bail!("unknown argument: {other}"),
        }
    }
    for name in &options.frameworks {
        if !FRAMEWORKS.contains(&name.as_str()) {
            bail!("unknown framework: {name}");
        }
    }
    Ok(options)
}

fn npm_version(name: &str) -> Result<String> {
    let source = std::fs::read_to_string(perf_dir().join("apps").join(name).join("app.js"))?;
    let marker = format!("npm:{name}@");
    let start = source
        .find(&marker)
        .ok_or_else(|| anyhow!("perf/apps/{name}/app.js imports no {marker}"))?
        + marker.len();
    Ok(source[start..]
        .chars()
        .take_while(|char| char.is_ascii_digit() || *char == '.')
        .collect())
}

fn version_of(name: &str) -> Result<String> {
    if name == "imp" {
        Ok(imp::version::VERSION.to_string())
    } else {
        npm_version(name)
    }
}

fn write_bundle(name: &str, options: Options) -> Result<()> {
    let target = perf_dir().join("dist").join(name);
    let bundled = bundle(options).map_err(|error| anyhow!("{error}"))?;
    std::fs::create_dir_all(&target)?;
    for chunk in &bundled.chunks {
        std::fs::write(target.join(&chunk.file_name), &chunk.code)?;
    }
    for asset in &bundled.assets {
        std::fs::write(target.join(&asset.file_name), &asset.bytes)?;
    }
    std::fs::copy(
        perf_dir().join("apps").join(name).join("index.html"),
        target.join("index.html"),
    )?;
    Ok(())
}

fn bundle_options(name: &str, readable: bool) -> Options {
    let app = perf_dir().join("apps").join(name);
    let mut options = Options::new(&app);
    options.entries.push((
        Some("app".into()),
        app.join("app.js").to_string_lossy().into_owned(),
    ));
    options.format = Format::Esm;
    options.minify = !readable;
    options.assets = Assets::DataUrl;
    options.legal_comments = LegalComments::None;
    options.entry_names = "[name].js".into();
    options.chunk_names = "[name]-[hash].js".into();
    options
}

fn build_app(binary: &Path, name: &str, readable: bool) -> Result<()> {
    if name == "imp" && !readable {
        let output = perf_dir().join("dist").join("imp");
        return run_imp(
            binary,
            &["build", "--output", &output.to_string_lossy()],
            &perf_dir().join("apps").join("imp"),
        );
    }
    let mut options = bundle_options(name, readable);
    if name == "imp" {
        options.imp = ImpLibrary::Bundled;
        options.define = imp::build::production_defines();
    } else {
        options.imp = ImpLibrary::External;
        options.define = NPM_DEFINES
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect();
    }
    write_bundle(name, options)
}

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn answer(mut stream: TcpStream, root: &Path) -> std::io::Result<()> {
    let mut request_line = String::new();
    let mut reader = BufReader::new(stream.try_clone()?);
    reader.read_line(&mut request_line)?;
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header)? == 0 || header.trim().is_empty() {
            break;
        }
    }
    let path = request_line.split_whitespace().nth(1).unwrap_or("/");
    let path = path.split('?').next().unwrap_or("/");
    if path == "/favicon.ico" {
        return write!(
            stream,
            "HTTP/1.1 204 No Content\r\nconnection: close\r\n\r\n"
        );
    }
    let decoded = imp::http_server::percent_decode_strict(path).unwrap_or_default();
    let mut file = root.join(decoded.trim_start_matches('/'));
    if file.is_dir() {
        file = file.join("index.html");
    }
    let safe = !decoded.split('/').any(|segment| segment == "..");
    let (status, body, kind) = match std::fs::read(&file) {
        Ok(body) if safe => ("200 OK", body, content_type(&file)),
        _ => ("404 Not Found", b"Not found".to_vec(), "text/plain"),
    };
    write!(
        stream,
        "HTTP/1.1 {status}\r\ncontent-type: {kind}\r\ncontent-length: {}\r\ncache-control: no-store\r\nconnection: close\r\n\r\n",
        body.len()
    )?;
    stream.write_all(&body)
}

fn serve_dist() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let root = perf_dir().join("dist");
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let root = root.clone();
            std::thread::spawn(move || answer(stream, &root));
        }
    });
    Ok(port)
}

fn write_runner(options: &RunOptions, port: u16, versions: &Value) -> Result<PathBuf> {
    let runner = perf_dir().join("dist").join("runner");
    let _ = std::fs::remove_dir_all(&runner);
    std::fs::create_dir_all(&runner)?;
    for file in RUNNER_FILES {
        std::fs::copy(perf_dir().join(file), runner.join(file))?;
    }
    let run_options = json!({
        "frameworks": options.frameworks,
        "samples": options.samples,
        "filter": options.filter,
        "profile": options.profile,
        "platform": format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
    });
    std::fs::write(
        runner.join("run-options.js"),
        format!(
            "export const base = 'http://127.0.0.1:{port}'\nexport const options = {run_options}\nexport const versions = {versions}\n"
        ),
    )?;
    std::fs::write(
        runner.join("index.html"),
        "<!doctype html>\n<title>perf runner</title>\n",
    )?;
    Ok(runner)
}

fn run_driver(binary: &Path, runner: &Path) -> Result<Value> {
    let output = Command::new(binary)
        .args(["test", "driver.spec.js"])
        .current_dir(runner)
        .stderr(std::process::Stdio::inherit())
        .output()
        .context("cannot run imp test")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let begin = "IMP-REPORT-BEGIN\n";
    let Some(start) = stdout.find(begin) else {
        print!("{stdout}");
        bail!("the perf driver printed no report");
    };
    print!("{}", &stdout[..start]);
    let rest = &stdout[start + begin.len()..];
    let end = rest
        .find("\nIMP-REPORT-END")
        .ok_or_else(|| anyhow!("the perf report has no end"))?;
    Ok(serde_json::from_str(&rest[..end])?)
}

pub fn perf(args: &[String]) -> Result<()> {
    let options = parse_arguments(args)?;
    let binary = build_imp("local")?;
    let mut versions = serde_json::Map::new();
    for name in &options.frameworks {
        versions.insert(name.clone(), Value::String(version_of(name)?));
    }
    if options.build {
        let _ = std::fs::remove_dir_all(perf_dir().join("dist"));
        for name in &options.frameworks {
            println!("building {name} {}", versions[name].as_str().unwrap_or(""));
            build_app(&binary, name, options.profile)?;
        }
    }
    let port = serve_dist()?;
    let runner = write_runner(&options, port, &Value::Object(versions))?;
    let report = run_driver(&binary, &runner)?;
    let results = perf_dir().join("results");
    std::fs::create_dir_all(&results)?;
    if let Some(profiles) = report["profiles"].as_object() {
        for (name, profile) in profiles {
            std::fs::write(results.join(name), profile.to_string())?;
        }
    }
    let run = &report["run"];
    let stamp: String = run["date"]
        .as_str()
        .unwrap_or("run")
        .replace(':', "-")
        .chars()
        .take(19)
        .collect();
    let json_name = format!("{stamp}.json");
    std::fs::write(
        results.join(&json_name),
        format!("{}\n", serde_json::to_string_pretty(run)?),
    )?;
    std::fs::write(
        results.join("latest.md"),
        report["markdown"].as_str().unwrap_or(""),
    )?;
    println!("results: perf/results/{json_name} and perf/results/latest.md");
    Ok(())
}

pub fn profile_summary(args: &[String]) -> Result<()> {
    let path = args.first().ok_or_else(|| {
        anyhow!("usage: cargo xtask perf-profile <file.cpuprofile> [count] [--tree]")
    })?;
    let count: u64 = args
        .get(1)
        .filter(|arg| !arg.starts_with("--"))
        .map(|arg| arg.parse())
        .transpose()?
        .unwrap_or(25);
    let profile: Value = serde_json::from_str(&std::fs::read_to_string(path)?)?;
    let summary = call_export(
        &perf_dir().join("profile-summary.js"),
        "profileSummary",
        &json!({ "profile": profile, "count": count, "tree": args.iter().any(|arg| arg == "--tree") }),
        &[],
    )?;
    println!("{}", summary.as_str().unwrap_or(""));
    Ok(())
}
