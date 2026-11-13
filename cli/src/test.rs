use crate::browser::{Chrome, RunnerPage, UnitBrowser, resolve_browser};
use crate::bundler::{Assets, ImpLibrary, Mock, Options, bundle};
use crate::colors::{bold, dim, green, red};
use crate::config::{Config, get_path, get_str, get_strings, load_imp_config};
use crate::http_server::{Request, Response, Server};
use crate::js_scan::{extract_calls, parse_string_literal, split_first_argument};
use crate::paths::{absolute, file_name, relative_posix, resolve};
use crate::project_files::{is_spec_file, is_test_file, is_unit_file};
use crate::walk::{Collect, collect_files};
use anyhow::{Result, anyhow, bail};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

type ReportSlot = Arc<(Mutex<Option<String>>, Condvar)>;

type WorkerResult = (i32, String);

type Emit = Arc<dyn Fn(String) + Send + Sync>;

pub struct TestOptions {
    pub root: PathBuf,
    pub paths: Vec<String>,
    pub list: bool,
    pub unit: bool,
    pub e2e: bool,
    pub jobs: Option<usize>,
    pub filter: Option<String>,
    pub screenshot_dir: Option<String>,
    pub video_dir: Option<String>,
    pub mocks: Option<bool>,
}

const UNIT_TIMEOUT: u64 = 5_000;
const E2E_TIMEOUT: u64 = 30_000;

#[derive(Default, Clone, Copy)]
pub struct Counts {
    pub passed: u64,
    pub failed: u64,
    pub skipped: u64,
}

fn mock_module_calls(source: &str) -> Result<Vec<(String, String)>> {
    extract_calls(source, "mockModule")
        .into_iter()
        .map(|call| {
            let (first, rest) = split_first_argument(&call.argument_source);
            let specifier = parse_string_literal(&first).ok_or_else(|| {
                anyhow!("mockModule(specifier, ...) - specifier must be a string literal")
            })?;
            Ok((specifier, rest))
        })
        .collect()
}

fn resolve_mock_target(
    specifier: &str,
    file: &Path,
    root: &Path,
    dependencies: &[String],
) -> Result<(String, PathBuf)> {
    if specifier.starts_with('.') || Path::new(specifier).is_absolute() {
        let real = crate::bundler::resolve_module_file(&resolve(file.parent().unwrap(), specifier))
            .ok_or_else(|| anyhow!("mockModule('{specifier}') - module not found"))?;
        return Ok((real.to_string_lossy().into_owned(), real));
    }
    if !dependencies.iter().any(|alias| alias == specifier) {
        bail!(
            "mockModule('{specifier}') - not a relative module or a dependency declared in imp.json"
        );
    }
    let real = crate::bundler::resolve_module_file(&root.join("dependencies").join(specifier).join(format!("{specifier}.js")))
        .ok_or_else(|| anyhow!("mockModule('{specifier}') - dependency '{specifier}' is not vendored; run 'imp install'"))?;
    Ok((specifier.to_string(), real))
}

fn module_exports(
    real: &Path,
    root: &Path,
    dependencies: &[String],
) -> Result<(Vec<String>, bool)> {
    let mut options = Options::new(root).entry(real.to_string_lossy());
    options.dependencies = dependencies.to_vec();
    options.imp = ImpLibrary::Tooling;
    options.assets = Assets::DataUrl;
    let bundled = bundle(options).map_err(|error| anyhow!("{}", error.describe()))?;
    let exports = bundled
        .chunks
        .iter()
        .find(|chunk| chunk.is_entry)
        .map(|chunk| chunk.exports.clone())
        .unwrap_or_default();
    let has_default = exports.iter().any(|name| name == "default");
    Ok((
        exports
            .into_iter()
            .filter(|name| name != "default")
            .collect(),
        has_default,
    ))
}

fn mock_code(real: &Path, factory: &str, named: &[String], has_default: bool) -> String {
    let uses_orig =
        !factory.is_empty() && regex::Regex::new(r"\borig\b").unwrap().is_match(factory);
    let mut lines = vec!["import { spy as __spy } from 'imp/test'".to_string()];
    if uses_orig {
        lines.push(format!(
            "import * as __real from {}",
            serde_json::to_string(&real.to_string_lossy()).unwrap()
        ));
    }
    let helpers = if uses_orig {
        "{ spy: __spy, orig: () => __real }"
    } else {
        "{ spy: __spy }"
    };
    if factory.is_empty() {
        lines.push("const __exports = {}".into());
    } else {
        lines.push(format!("const __exports = ({factory})({helpers})"));
    }
    lines.push("const __pick = (name) => (__exports != null && name in __exports) ? __exports[name] : __spy()".into());
    for (index, name) in named.iter().enumerate() {
        lines.push(format!(
            "const __export{index} = __pick({})",
            serde_json::to_string(name).unwrap()
        ));
        lines.push(format!(
            "export {{ __export{index} as {} }}",
            serde_json::to_string(name).unwrap()
        ));
    }
    if has_default {
        lines.push("export default __pick('default')".into());
    }
    format!("{}\n", lines.join("\n"))
}

pub fn collect_mocks(
    file: &Path,
    root: &Path,
    dependencies: &[String],
) -> Result<HashMap<String, Mock>> {
    let mut mocks = HashMap::new();
    for (specifier, factory) in mock_module_calls(&std::fs::read_to_string(file)?)? {
        let (id, real) = resolve_mock_target(&specifier, file, root, dependencies)?;
        if mocks.contains_key(&id) {
            bail!("mockModule('{specifier}') - this module is mocked more than once");
        }
        let (named, has_default) = module_exports(&real, root, dependencies)?;
        let code = mock_code(&real, &factory, &named, has_default);
        mocks.insert(
            id,
            Mock {
                real_file: real,
                code,
            },
        );
    }
    Ok(mocks)
}

fn bundle_test_file(file: &Path, root: &Path, dependencies: &[String]) -> Result<String> {
    let mocks = collect_mocks(file, root, dependencies)?;
    let mut options = Options::new(root).entry(file.to_string_lossy());
    options.dependencies = dependencies.to_vec();
    options.imp = ImpLibrary::Tooling;
    options.mocks = mocks;
    options.assets = Assets::DataUrl;
    let bundled = bundle(options).map_err(|error| anyhow!("{error}"))?;
    Ok(bundled.entry_code().to_string())
}

struct Run {
    activity: Mutex<Instant>,
    lines: Mutex<Vec<String>>,
    done: Mutex<Option<Counts>>,
    ready: Condvar,
}

fn video_options(config: &Config) -> Value {
    let video = |key: &str, fallback: f64| {
        get_path(config, &["test", "video", key])
            .and_then(Value::as_f64)
            .unwrap_or(fallback)
    };
    json!({ "fps": video("fps", 10.0), "maxDuration": video("maxDuration", 30.0), "width": video("width", 800.0), "quality": video("quality", 80.0) })
}

fn slug(text: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for char in text.chars() {
        if char.is_alphanumeric() || char == '_' || char == '.' || char == '-' {
            out.push(char);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').chars().take(60).collect()
}

fn runner_page() -> &'static str {
    "<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>imp test</title><script>globalThis.__IMP_DEV__ = true</script><script type=\"module\" src=\"/@imp/runner/test-runner.js\"></script></head><body></body></html>\n"
}

pub struct E2eApp {
    pub base_url: String,
    pub mock_server: bool,
    pub _server: Server,
}

#[derive(Clone, Copy)]
enum Level<'a> {
    Unit(&'a UnitBrowser),
    E2e { browser: &'a Path, app: &'a E2eApp },
}

struct Suite<'a> {
    root: &'a Path,
    config: &'a Config,
    dependencies: &'a [String],
    filter: Option<String>,
    screenshot_dir: Option<PathBuf>,
    video_dir: Option<PathBuf>,
}

struct FileRun<'a> {
    suite: &'a Suite<'a>,
    file: &'a Path,
    code: String,
    level: Level<'a>,
    emit: Emit,
}

struct Runner {
    state: Arc<Run>,
    endpoint: Arc<Mutex<Option<ReportSlot>>>,
    url: String,
    _server: Server,
}

fn serve_runner(options: FileRun) -> Result<Runner> {
    let state = Arc::new(Run {
        activity: Mutex::new(Instant::now()),
        lines: Mutex::new(Vec::new()),
        done: Mutex::new(None),
        ready: Condvar::new(),
    });
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let endpoint: Arc<Mutex<Option<ReportSlot>>> = Arc::new(Mutex::new(None));
    let app = match options.level {
        Level::Unit(_) => None,
        Level::E2e { app, .. } => Some(app),
    };
    let suite = options.suite;
    let screenshot_dir = app.and(suite.screenshot_dir.clone());
    let video_dir = app.and(suite.video_dir.clone());
    let video = video_options(suite.config);
    let run_config = json!({
        "mode": if app.is_some() { "e2e" } else { "unit" },
        "filter": suite.filter,
        "color": crate::colors::red("x") != "x",
        "unitTimeout": UNIT_TIMEOUT,
        "e2eTimeout": E2E_TIMEOUT,
        "baseUrl": app.map(|app| app.base_url.clone()),
        "mockServer": app.is_some_and(|app| app.mock_server),
        "screenshots": screenshot_dir.is_some(),
        "video": if video_dir.is_some() { video.clone() } else { Value::Null },
    });
    let handler_state = state.clone();
    let code = Arc::new(options.code);
    let handler_endpoint = endpoint.clone();
    let root = suite.root.to_path_buf();
    let file = options.file.to_path_buf();
    let emit = options.emit;
    let handler = move |request: Request| -> Response {
        let path = request.path.as_str();
        match (request.method.as_str(), path) {
            ("GET", "/") => Response::new(200, "text/html; charset=utf-8", runner_page()),
            ("GET", "/favicon.ico") => Response::empty(204),
            ("GET", "/@imp/run.json") => Response::json(200, &run_config),
            ("GET", "/@imp/test.js") => Response::new(
                200,
                "text/javascript; charset=utf-8",
                code.as_bytes().to_vec(),
            ),
            ("GET", "/@imp/devtools") => {
                let shared = handler_endpoint.lock().unwrap().clone();
                let value = shared.and_then(|shared| {
                    let (lock, ready) = &*shared;
                    let guard = lock.lock().unwrap();
                    let (guard, _) = ready
                        .wait_timeout_while(guard, Duration::from_secs(30), |value| value.is_none())
                        .unwrap();
                    guard.clone()
                });
                Response::text(200, value.unwrap_or_default())
            }
            ("POST", "/@imp/out") => {
                *handler_state.activity.lock().unwrap() = Instant::now();
                if let Some(lines) = request.json().and_then(|body| body.get("lines").cloned()) {
                    for line in lines.as_array().into_iter().flatten() {
                        let text = line.as_str().unwrap_or("").to_string();
                        handler_state.lines.lock().unwrap().push(text.clone());
                        emit(text);
                    }
                }
                Response::text(200, "ok")
            }
            ("POST", "/@imp/done") => {
                let body = request.json().unwrap_or(Value::Null);
                let count = |key: &str| body.get(key).and_then(Value::as_u64).unwrap_or(0);
                *handler_state.done.lock().unwrap() = Some(Counts {
                    passed: count("passed"),
                    failed: count("failed"),
                    skipped: count("skipped"),
                });
                handler_state.ready.notify_all();
                Response::text(200, "ok")
            }
            ("POST", "/@imp/screenshot") => {
                if let (Some(dir), Some(body)) = (&screenshot_dir, request.json()) {
                    let test = body.get("test").and_then(Value::as_str).unwrap_or("test");
                    let data = body.get("data").and_then(Value::as_str).unwrap_or("");
                    let target =
                        dir.join(format!("{}-{}.png", slug(&file_name(&file)), slug(test)));
                    if write_base64(&target, data).is_ok() {
                        emit(dim(format!(
                            "      screenshot: {}",
                            relative_posix(&root, &target)
                        )));
                    }
                }
                Response::text(200, "ok")
            }
            ("POST", "/@imp/save") => {
                if let Some(body) = request.json() {
                    let target = resolve(
                        &root,
                        body.get("path")
                            .and_then(Value::as_str)
                            .unwrap_or("screenshot.png"),
                    );
                    let _ = write_base64(
                        &target,
                        body.get("data").and_then(Value::as_str).unwrap_or(""),
                    );
                }
                Response::text(200, "ok")
            }
            ("POST", "/@imp/video") => {
                if let (Some(dir), Some(body)) = (&video_dir, request.json()) {
                    let frames = body
                        .get("frames")
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                    match crate::test_video::encode_gif(&frames, &video) {
                        Ok(Some(bytes)) => {
                            let target = dir.join(format!("{}.gif", slug(&file_name(&file))));
                            if std::fs::create_dir_all(dir).is_ok()
                                && std::fs::write(&target, bytes).is_ok()
                            {
                                emit(dim(format!("  video: {}", relative_posix(&root, &target))));
                            }
                        }
                        Ok(None) => {}
                        Err(error) => crate::logger::warn(&format!(
                            "failed to write video for {} - {error}",
                            relative_posix(&root, &file)
                        )),
                    }
                }
                Response::text(200, "ok")
            }
            ("GET", path) if path.starts_with("/@imp/runner/") => {
                let name = &path["/@imp/runner/".len()..];
                match crate::embedded::text(&format!("cli/js/{name}")) {
                    Some(source) => Response::new(200, "text/javascript; charset=utf-8", source),
                    None => Response::text(404, "not found"),
                }
            }
            ("GET", path) if path.starts_with("/@imp/puppeteer/") => {
                let name = &path["/@imp/puppeteer/".len()..];
                match crate::embedded::text(&format!("cli/vendor/puppeteer/{name}")) {
                    Some(source) => Response::new(200, "text/javascript; charset=utf-8", source),
                    None => Response::text(404, "not found"),
                }
            }
            _ => Response::text(404, "not found"),
        }
    };
    Ok(Runner {
        state,
        endpoint,
        url: format!("http://127.0.0.1:{port}/"),
        _server: crate::http_server::spawn(listener, Arc::new(handler)),
    })
}

fn await_counts(state: &Run, page: &mut dyn RunnerPage, idle_limit: Duration) -> Result<Counts> {
    loop {
        let guard = state.done.lock().unwrap();
        let (guard, _) = state
            .ready
            .wait_timeout(guard, Duration::from_millis(200))
            .unwrap();
        if let Some(counts) = *guard {
            return Ok(counts);
        }
        drop(guard);
        if let Some(failure) = page.failure() {
            bail!("{failure}");
        }
        let idle = state.activity.lock().unwrap().elapsed();
        if idle > idle_limit {
            let last = state
                .lines
                .lock()
                .unwrap()
                .iter()
                .rev()
                .find(|line| line.contains('✓') || line.contains('✗'))
                .cloned();
            let after = last
                .map(|line| format!(" after '{}'", line.trim()))
                .unwrap_or_default();
            bail!(
                "the page stopped responding for {} seconds{after} - a test blocks the page, or navigates it away",
                idle.as_secs()
            );
        }
    }
}

fn run_in_browser(options: FileRun) -> Result<Counts> {
    let level = options.level;
    let runner = serve_runner(options)?;
    match level {
        Level::Unit(browser) => {
            let mut page = browser.open(&runner.url)?;
            await_counts(
                &runner.state,
                &mut page,
                Duration::from_millis(UNIT_TIMEOUT * 12),
            )
        }
        Level::E2e { browser, .. } => {
            let mut chrome = Chrome::launch(browser, &runner.url)?;
            *runner.endpoint.lock().unwrap() = Some(chrome.shared_endpoint());
            await_counts(
                &runner.state,
                &mut chrome,
                Duration::from_millis(E2E_TIMEOUT * 4),
            )
        }
    }
}

fn run_file<'a>(
    suite: &'a Suite<'a>,
    file: &'a Path,
    emit: &Emit,
    started: Instant,
    level: impl FnOnce() -> Result<Level<'a>>,
) -> Counts {
    let mut totals = Counts::default();
    emit(relative_posix(suite.root, file));
    match bundle_test_file(file, suite.root, suite.dependencies) {
        Err(error) => {
            totals.failed += 1;
            emit(format!("  {} failed to load", red("✗")));
            emit(red(indent(&format!("{error:#}"))));
        }
        Ok(code) => {
            let result = level().and_then(|level| {
                run_in_browser(FileRun {
                    suite,
                    file,
                    code,
                    level,
                    emit: emit.clone(),
                })
            });
            match result {
                Ok(counts) => totals = counts,
                Err(error) => {
                    totals.failed += 1;
                    emit(format!("  {} failed to run", red("✗")));
                    emit(red(indent(&format!("{error:#}"))));
                }
            }
        }
    }
    let mut parts = vec![format!("{} passed", totals.passed)];
    if totals.failed > 0 {
        parts.push(red(format!("{} failed", totals.failed)));
    }
    if totals.skipped > 0 {
        parts.push(format!("{} skipped", totals.skipped));
    }
    emit(format!(
        "\nimp test: {} {}",
        parts.join(", "),
        dim(format!("(1 file, {}ms)", started.elapsed().as_millis()))
    ));
    totals
}

fn write_base64(target: &Path, data: &str) -> Result<()> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(data)?;
    std::fs::create_dir_all(target.parent().unwrap())?;
    std::fs::write(target, bytes)?;
    Ok(())
}

fn select_files(
    root: &Path,
    paths: &[String],
    unit: bool,
    e2e: bool,
    exclude: &[String],
) -> Result<(Vec<PathBuf>, Vec<PathBuf>)> {
    for target in paths {
        let path = resolve(root, target);
        let Ok(meta) = std::fs::metadata(&path) else {
            bail!("path not found: {target}")
        };
        if meta.is_file() && !is_test_file(&path.to_string_lossy()) {
            bail!(
                "not a test file: {target} - unit tests end with .test.js, e2e specs with .spec.js"
            );
        }
    }
    let files: Vec<PathBuf> = collect_files(Collect {
        root,
        paths,
        extensions: &["js", "mjs"],
        exclude,
    })?
    .into_iter()
    .filter(|file| is_test_file(&file.to_string_lossy()))
    .collect();
    let unit_only = unit && !e2e;
    let e2e_only = e2e && !unit;
    let units = if e2e_only {
        Vec::new()
    } else {
        files
            .iter()
            .filter(|file| is_unit_file(&file.to_string_lossy()))
            .cloned()
            .collect()
    };
    let specs = if unit_only {
        Vec::new()
    } else {
        files
            .iter()
            .filter(|file| is_spec_file(&file.to_string_lossy()))
            .cloned()
            .collect()
    };
    Ok((units, specs))
}

fn print_choose_level() {
    println!(
        "imp test needs a single file, or a level to run every file of that kind in parallel:"
    );
    println!(
        "  {}   run every *.test.js file, each in a page of its own",
        bold("imp test --unit")
    );
    println!(
        "  {}    run every *.spec.js file, each in its own browser",
        bold("imp test --e2e")
    );
    println!("  {}   run a single test file", bold("imp test <file>"));
    println!(
        "\nNarrow discovery with a path ({}), cap parallelism",
        dim("imp test --e2e checkout/")
    );
    println!(
        "with {}, or filter tests with {}.",
        dim("--jobs <n>"),
        dim("--filter <text>")
    );
}

fn default_jobs() -> usize {
    std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(4)
        .max(1)
}

fn indent_block(text: &str) -> String {
    text.split('\n')
        .map(|line| format!("    {line}"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn run_pool<State, Work>(count: usize, jobs: usize, work: Work) -> Vec<WorkerResult>
where
    State: Default,
    Work: Fn(&mut State, usize) -> WorkerResult + Sync,
{
    let next = AtomicUsize::new(0);
    let results: Mutex<Vec<Option<WorkerResult>>> = Mutex::new(vec![None; count]);
    std::thread::scope(|scope| {
        for _ in 0..jobs.min(count).max(1) {
            scope.spawn(|| {
                let mut state = State::default();
                loop {
                    let index = next.fetch_add(1, Ordering::Relaxed);
                    if index >= count {
                        return;
                    }
                    let result = work(&mut state, index);
                    results.lock().unwrap()[index] = Some(result);
                }
            });
        }
    });
    results
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|result| result.unwrap_or((1, String::new())))
        .collect()
}

fn ready_browser<'a>(
    slot: &'a mut Option<UnitBrowser>,
    executable: &Path,
) -> Result<&'a UnitBrowser> {
    if !slot.as_ref().is_some_and(UnitBrowser::alive) {
        slot.take();
        *slot = Some(UnitBrowser::launch(executable)?);
    }
    slot.as_ref()
        .ok_or_else(|| anyhow!("the browser did not start"))
}

fn run_unit_files(
    suite: &Suite,
    files: &[PathBuf],
    jobs: usize,
    executable: &Path,
) -> Vec<WorkerResult> {
    run_pool(
        files.len(),
        jobs,
        |browser: &mut Option<UnitBrowser>, index| {
            let lines = Arc::new(Mutex::new(Vec::new()));
            let sink = lines.clone();
            let emit: Emit = Arc::new(move |line| sink.lock().unwrap().push(line));
            let counts = run_file(suite, &files[index], &emit, Instant::now(), || {
                Ok(Level::Unit(ready_browser(browser, executable)?))
            });
            let output = lines.lock().unwrap().join("\n");
            (i32::from(counts.failed > 0), output)
        },
    )
}

fn run_spec_files(
    suite: &Suite,
    files: &[PathBuf],
    jobs: usize,
    passthrough: &[String],
) -> Result<Vec<WorkerResult>> {
    let executable = std::env::current_exe()?;
    Ok(run_pool(files.len(), jobs, |_: &mut (), index| {
        let output = std::process::Command::new(&executable)
            .arg("test")
            .arg(relative_posix(suite.root, &files[index]))
            .args(passthrough)
            .current_dir(suite.root)
            .env("IMP_DELEGATED", "1")
            .output();
        match output {
            Ok(output) => (
                output.status.code().unwrap_or(1),
                format!(
                    "{}{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                ),
            ),
            Err(error) => (1, error.to_string()),
        }
    }))
}

struct LevelRun<'a> {
    units: &'a [PathBuf],
    specs: &'a [PathBuf],
    jobs: usize,
    browser: &'a Path,
    passthrough: &'a [String],
}

fn run_level(suite: &Suite, run: LevelRun) -> Result<i32> {
    let started = Instant::now();
    let files: Vec<&PathBuf> = run.units.iter().chain(run.specs).collect();
    let file_count = format!(
        "{} {}",
        files.len(),
        if files.len() == 1 { "file" } else { "files" }
    );
    println!("imp test: running {file_count} in parallel\n");
    let mut results = Vec::new();
    if !run.units.is_empty() {
        results.extend(run_unit_files(suite, run.units, run.jobs, run.browser));
    }
    if !run.specs.is_empty() {
        results.extend(run_spec_files(suite, run.specs, run.jobs, run.passthrough)?);
    }
    let mut failed = 0;
    for (file, (code, output)) in files.iter().zip(results) {
        let file = relative_posix(suite.root, file);
        if code == 0 {
            println!("{} {file}", green("✓"));
        } else {
            failed += 1;
            println!("{} {file}", red("✗"));
            let output = output.trim_end();
            if !output.is_empty() {
                println!("{}", indent_block(output));
            }
        }
    }
    let mut parts = vec![format!("{} passed", files.len() - failed)];
    if failed > 0 {
        parts.push(red(format!("{failed} failed")));
    }
    println!(
        "\nimp test: {} {}",
        parts.join(", "),
        dim(format!(
            "({file_count}, {}ms)",
            started.elapsed().as_millis()
        ))
    );
    Ok(if failed > 0 { 1 } else { 0 })
}

pub fn run_tests(options: TestOptions) -> Result<i32> {
    let root = options.root.clone();
    let config = load_imp_config(&root)?;
    let dependencies: Vec<String> = crate::config::dependencies(&config)
        .into_iter()
        .map(|(alias, _)| alias)
        .collect();
    let video_enabled =
        get_path(&config, &["test", "video", "enable"]).and_then(Value::as_bool) == Some(true);
    let video_dir = if options.video_dir.is_some() || video_enabled {
        Some(
            options
                .video_dir
                .clone()
                .unwrap_or_else(|| ".imp/videos".into()),
        )
    } else {
        None
    };
    let (units, specs) = select_files(
        &root,
        &options.paths,
        options.unit,
        options.e2e,
        &get_strings(&config, &["test", "exclude"]),
    )?;
    let to_relative = |file: &PathBuf| relative_posix(&root, file);
    if options.list {
        let listed: Vec<String> = units.iter().chain(specs.iter()).map(to_relative).collect();
        println!("{}", serde_json::to_string(&listed)?);
        return Ok(0);
    }
    let files: Vec<PathBuf> = units.iter().chain(specs.iter()).cloned().collect();
    if files.is_empty() {
        println!("no test files found (unit tests end with .test.js, e2e specs with .spec.js)");
        return Ok(0);
    }
    let suite = Suite {
        root: &root,
        config: &config,
        dependencies: &dependencies,
        filter: options.filter.clone(),
        screenshot_dir: options
            .screenshot_dir
            .as_ref()
            .map(|dir| absolute(root.join(dir))),
        video_dir: video_dir.as_ref().map(|dir| absolute(root.join(dir))),
    };
    if options.unit || options.e2e {
        let mut passthrough = Vec::new();
        if let Some(filter) = &options.filter {
            passthrough.extend(["--filter".to_string(), filter.clone()]);
        }
        if let Some(dir) = &options.screenshot_dir {
            passthrough.extend(["--screenshots".to_string(), dir.clone()]);
        }
        if let Some(dir) = &options.video_dir {
            passthrough.extend(["--video".to_string(), dir.clone()]);
        }
        if let Some(mocks) = options.mocks {
            passthrough.push(if mocks {
                "--mock".into()
            } else {
                "--no-mock".into()
            });
        }
        let browser = resolve_browser(get_str(&config, &["test", "browser"]))?;
        return run_level(
            &suite,
            LevelRun {
                units: &units,
                specs: &specs,
                jobs: options.jobs.unwrap_or_else(default_jobs),
                browser: &browser,
                passthrough: &passthrough,
            },
        );
    }
    if files.len() > 1 {
        print_choose_level();
        return Ok(1);
    }
    let started = Instant::now();
    let file = &files[0];
    let browser_path = resolve_browser(get_str(&config, &["test", "browser"]))?;
    let emit: Emit = Arc::new(|line| println!("{line}"));
    let totals = if is_spec_file(&file.to_string_lossy()) {
        let app = crate::start::start_e2e_app(&root, &config, options.mocks)?;
        let level = Level::E2e {
            browser: &browser_path,
            app: &app,
        };
        run_file(&suite, file, &emit, started, || Ok(level))
    } else {
        let mut browser = None;
        run_file(&suite, file, &emit, started, || {
            Ok(Level::Unit(ready_browser(&mut browser, &browser_path)?))
        })
    };
    Ok(if totals.failed > 0 { 1 } else { 0 })
}

fn indent(text: &str) -> String {
    text.split('\n')
        .map(|line| format!("      {line}"))
        .collect::<Vec<_>>()
        .join("\n")
}
