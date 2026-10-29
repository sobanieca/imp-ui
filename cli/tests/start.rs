mod support;

use imp::review::read_widget_mark;
use imp::start::{Widget, client_script};
use regex::Regex;
use serde_json::{Value, json};
use std::time::Duration;
use support::worker::Worker;
use support::*;

fn banner_of(server: &Server) -> String {
    normalize(&server.banner).replace(&format!(":{}", server.port), ":<port>")
}

fn without_client(body: &str, mocks: bool) -> String {
    let script = client_script(
        mocks,
        false,
        &read_widget_mark(),
        Widget::ReviewAndThemeEditor,
    );
    normalize(&body.replace(&script, "\n[imp client script]\n"))
}

fn get_snapshot(server: &Server, name: &str, path: &str, body: impl Fn(&str) -> String) {
    let answer = get(server.port, path);
    assert_snapshot(
        name,
        &response_transcript(path, &answer, &body(&answer.text())),
    );
}

#[test]
fn start_serves_the_basic_fixture() {
    let server = start_dev(&fixture("basic"), &[]);
    assert_snapshot("start-banner", &banner_of(&server));
    get_snapshot(&server, "start-injected-html", "/", |body| {
        without_client(body, false)
    });
    get_snapshot(
        &server,
        "start-serves-module-verbatim",
        "/app.js",
        normalize,
    );

    let path = "/dependencies/mitt/mitt.js";
    let answer = get(server.port, path);
    let dir = TempDir::new();
    write(&dir.join("mitt.js"), &answer.text());
    let summary = run_module_probe(
        &dir.path,
        "import mitt from './mitt.js'\nconst emitter = mitt()\nlet received = null\nemitter.on('ping', (value) => { received = value })\nemitter.emit('ping', 'pong')\nglobalThis.__probe = `[vendored module: default export is ${typeof mitt}, emit('ping') delivered '${received}']`\n",
    );
    assert_snapshot(
        "start-vendored-dependency",
        &response_transcript(path, &answer, &summary),
    );

    get_snapshot(&server, "start-framework-module", "/@imp/imp.js", |_| {
        "[imp library source]".into()
    });
    get_snapshot(&server, "start-service-worker", "/@imp/sw.js", |_| {
        "[imp service worker source]".into()
    });
    get_snapshot(&server, "start-static-asset", "/assets/note.txt", normalize);
    get_snapshot(&server, "start-directory-redirect", "/assets", normalize);
    get_snapshot(&server, "start-not-found", "/missing.js", normalize);

    let path = "/todos/42";
    let answer = http(server.port, "GET", path, &[("accept", "text/html")], None);
    assert_snapshot(
        "start-history-fallback",
        &response_transcript(path, &answer, &without_client(&answer.text(), false)),
    );

    let status = raw_status_line(server.port, "/../secret.txt", "GET", "localhost", &[]);
    assert_snapshot(
        "start-path-traversal",
        &format!("GET /../secret.txt (raw request)\n\n{status}\n"),
    );
}

fn mocks_transcript(worker: &Worker, port: u16) -> Vec<String> {
    let _ = port;
    vec![
        worker.send("/api/users", "GET", None, None),
        worker.send(
            "/api/users",
            "POST",
            Some(&json!({ "name": "Alan" }).to_string()),
            Some("application/json"),
        ),
        worker.send("/api/reports?name=q3", "GET", None, None),
        worker.send("/api/orders/o%207/lines/2", "GET", None, None),
        worker.send("/api/orders/o7", "GET", None, None),
        worker.send("/api/flaky", "GET", None, None),
        worker.send("/api/flaky", "GET", None, None),
        worker.send("/api/unmocked", "GET", None, None),
    ]
}

#[test]
fn start_serves_mocks_through_the_service_worker() {
    let server = start_dev(&fixture("start-mocks"), &[]);
    assert_snapshot("start-mocks-banner", &banner_of(&server));
    let answer = get(server.port, "/");
    assert_snapshot(
        "start-mocks-injected-html",
        &response_transcript("/", &answer, &without_client(&answer.text(), true)),
    );
    let source = get(server.port, "/@imp/sw.js").text();
    let worker = Worker::new(&source, Some(server.port));
    let mut lines = vec![
        format!("mock endpoint: {}", worker.mock_endpoint()),
        format!(
            "mock code in the worker: {}",
            if source.contains("/api/users") {
                "yes"
            } else {
                "no"
            }
        ),
        String::new(),
    ];
    lines.extend(mocks_transcript(&worker, server.port));
    lines.push(String::new());
    lines.push("a new worker, as after the browser stops an idle one:".into());
    lines.push(Worker::new(&source, Some(server.port)).send("/api/flaky", "GET", None, None));
    assert_snapshot(
        "start-mocks-service-worker",
        &format!("{}\n", section("what the mocks answer", &lines.join("\n"))),
    );
}

fn mocked_request(port: u16) -> String {
    let worker = Worker::new(&get(port, "/@imp/sw.js").text(), Some(port));
    format!(
        "mock endpoint {} | {}",
        worker.mock_endpoint(),
        worker.send("/api/users", "GET", None, None)
    )
}

#[test]
fn mock_flags_decide_whether_the_mocks_folder_is_served() {
    let disabled = TempDir::new();
    copy_directory(&fixture("start-mocks"), &disabled.path);
    write(
        &disabled.join("imp.json"),
        "{\n  \"mocks\": { \"folder\": \"mocks\", \"enabled\": false }\n}\n",
    );
    let enabled = fixture("start-mocks");
    let runs: [(&str, &std::path::Path, &[&str]); 4] = [
        ("\"enabled\": true", &enabled, &[]),
        ("\"enabled\": true with --no-mock", &enabled, &["--no-mock"]),
        ("\"enabled\": false", &disabled.path, &[]),
        (
            "\"enabled\": false with --mock",
            &disabled.path,
            &["--mock"],
        ),
    ];
    let lines: Vec<String> = runs
        .iter()
        .map(|(label, cwd, args)| {
            let server = start_dev(cwd, args);
            format!("{label} -> {}", mocked_request(server.port))
        })
        .collect();
    assert_snapshot(
        "mocks-flag-decides",
        &format!("{}\n", section("imp start", &lines.join("\n"))),
    );
}

fn settled() {
    std::thread::sleep(Duration::from_millis(300));
}

fn reload_after_touch(port: u16, file: &std::path::Path) -> Option<&'static str> {
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = sender.send(first_reload_event(port, Duration::from_millis(1500)));
    });
    settled();
    touch(file);
    receiver.recv().unwrap()
}

#[test]
fn no_reload_keeps_the_page_as_it_is_when_a_file_changes() {
    let mut lines = Vec::new();
    let mut banners = Vec::new();
    let mut logs = Vec::new();
    for (label, args, expected) in [
        ("default", &[][..], Some("reload")),
        ("--no-reload", &["--no-reload"][..], None),
    ] {
        let dir = TempDir::new();
        copy_directory(&fixture("basic"), &dir.path);
        let server = start_dev(&dir.path, args);
        let banner = banner_of(&server)
            .replace(&dir.text(), "<tmp>")
            .replace(&dir.text()[1..], "<tmp>");
        banners.push(section(label, &banner));
        let result = reload_after_touch(server.port, &dir.join("lib.js"));
        check(
            result == expected,
            format!("{label}: the event stream sends {result:?}"),
        );
        lines.push(format!("{label} -> {}", result.unwrap_or("nothing")));
        settled();
        let session = run_imp(&["logs"], &dir.path);
        let changes: Vec<&str> = session
            .stdout
            .lines()
            .filter(|line| line.contains("change detected"))
            .collect();
        logs.push(section(label, &changes.join("\n")));
    }
    assert_snapshot(
        "no-reload-flag",
        &format!("{}\n", section("imp start", &lines.join("\n"))),
    );
    assert_snapshot("no-reload-banner", &format!("{}\n", banners.join("\n\n")));
    assert_snapshot("no-reload-logs", &format!("{}\n", logs.join("\n\n")));

    let dir = TempDir::new();
    copy_directory(&fixture("basic"), &dir.path);
    write(
        &dir.join("app.html"),
        "<!doctype html><title>app entry</title>\n",
    );
    let server = start_server(&dir.path, &["--no-reload"], &["start", "app.html"]);
    check(
        get(server.port, "/").text().contains("app entry"),
        "app.html is the entry when --no-reload follows it",
    );
    check(
        server.banner.contains("serving app.html"),
        "the banner names app.html",
    );

    let dir = TempDir::new();
    copy_directory(&fixture("start-mocks"), &dir.path);
    let server = start_dev(&dir.path, &["--mock", "--no-reload"]);
    check(
        server.banner.contains("serving index.html"),
        "index.html stays the entry",
    );
    check(
        server.banner.contains("no reload"),
        "the banner says no reload",
    );
    let mocked = mocked_request(server.port);
    let result = reload_after_touch(server.port, &dir.join("app.js"));
    check(
        result.is_none(),
        format!("no reload arrives with --mock --no-reload, got {result:?}"),
    );
    assert_snapshot(
        "no-reload-with-mock",
        &format!("{}\n", section("imp start --mock --no-reload", &mocked)),
    );
}

fn own_worker_fixture(edit: impl Fn(&TempDir)) -> TempDir {
    let dir = TempDir::new();
    copy_directory(&fixture("start-service-worker"), &dir.path);
    edit(&dir);
    dir
}

#[test]
fn a_project_worker_gets_dev_mode_from_start_dev_mode() {
    let server = start_dev(&fixture("start-service-worker"), &[]);
    assert_snapshot("start-own-worker-banner", &banner_of(&server));

    let answer = get(server.port, "/");
    let html = answer.text();
    let own_client = client_script(
        true,
        true,
        &read_widget_mark(),
        Widget::ReviewAndThemeEditor,
    );
    let report = [
        format!(
            "registers /@imp/sw.js: {}",
            if html.contains("/@imp/sw.js") {
                "yes"
            } else {
                "no"
            }
        ),
        format!(
            "client script without the dev worker registration: {}",
            if html.contains(&own_client) {
                "yes"
            } else {
                "no"
            }
        ),
    ];
    assert_snapshot(
        "start-own-worker-page",
        &response_transcript("/", &answer, &report.join("\n")),
    );

    let answer = get(server.port, "/sw.js");
    let source = answer.text();
    let worker = Worker::new(&source, Some(server.port));
    let import = Regex::new(r"(?m)^\s*import\s").unwrap();
    let mut bundle_lines = vec![
        format!(
            "bare imports left: {}",
            if import.is_match(&source) {
                "yes"
            } else {
                "no"
            }
        ),
        format!("first line: {}", source.lines().next().unwrap_or("")),
        format!("worker code ran: {}", worker.fixture()),
        format!("listeners: {}", worker.listeners()),
        format!("mock endpoint: {}", worker.mock_endpoint()),
        String::new(),
        worker.send("/api/users", "GET", None, None),
        worker.send("/api/other", "GET", None, None),
        String::new(),
    ];
    bundle_lines.extend(worker.telemetry());
    assert_snapshot(
        "start-own-worker-bundle",
        &response_transcript("/sw.js", &answer, &bundle_lines.join("\n")),
    );

    let answer = get(server.port, "/@imp/sw.js");
    assert_snapshot(
        "start-own-worker-imp-worker-gone",
        &response_transcript("/@imp/sw.js", &answer, &answer.text()),
    );

    let dir =
        own_worker_fixture(|dir| write(&dir.join("env/dev.json"), "{ \"DEV_TOOLS\": \"off\" }\n"));
    let quiet = start_dev(&dir.path, &[]);
    let worker = Worker::new(&get(quiet.port, "/sw.js").text(), None);
    assert_snapshot(
        "start-own-worker-dev-mode-off",
        &format!(
            "worker code ran: {}\nlisteners: {}\nmock endpoint: {}\n",
            worker.fixture(),
            Some(worker.listeners())
                .filter(|listed| !listed.is_empty())
                .unwrap_or_else(|| "(none)".into()),
            worker.mock_endpoint()
        ),
    );

    let dir = own_worker_fixture(|dir| {
        let file = dir.join("src/sw.js");
        write(&file, &format!("{}import './missing.js'\n", read(&file)));
    });
    let broken = start_dev(&dir.path, &[]);
    let answer = get(broken.port, "/sw.js");
    let without_tmp = |text: &str| {
        text.replace(&format!("file://{}", dir.text()), "file://<tmp>")
            .replace(&dir.text(), "<tmp>")
            .replace(&dir.text()[1..], "<tmp>")
    };
    assert_snapshot(
        "start-own-worker-broken-import",
        &format!(
            "{}\n\n{}",
            section("banner", &without_tmp(&banner_of(&broken))),
            response_transcript("/sw.js", &answer, &without_tmp(&answer.text()))
        ),
    );

    let dir = own_worker_fixture(|dir| std::fs::remove_file(dir.join("src/sw.js")).unwrap());
    let result = run_imp(&["start", "index.html", "--port", "0"], &dir.path);
    assert_snapshot(
        "start-own-worker-missing-file",
        &transcript("imp start index.html --port 0  (cwd: <tmp>)", &result)
            .replace(&dir.text(), "<tmp>"),
    );

    let dir = own_worker_fixture(|dir| write(&dir.join("imp.json"), "{ \"serviceWorker\": 5 }\n"));
    let result = run_imp(&["start", "index.html", "--port", "0"], &dir.path);
    assert_snapshot(
        "start-own-worker-invalid-key",
        &transcript("imp start index.html --port 0  (cwd: <tmp>)", &result)
            .replace(&dir.text(), "<tmp>"),
    );
}

fn mask_build(text: &str, dir: &TempDir) -> String {
    let text = text.replace(&dir.text(), "<tmp>");
    let text = Regex::new(r"\(\d+(\.\d+)? k?B\)")
        .unwrap()
        .replace_all(&text, "(<size>)");
    Regex::new(r"-[0-9a-f]{8}\.js")
        .unwrap()
        .replace_all(&text, "-<hash>.js")
        .into_owned()
}

fn precache_report(source: &str) -> String {
    let worker = Worker::new(source, None);
    let precache: Value =
        serde_json::from_str(&worker.global("__IMP_PRECACHE__")).unwrap_or(Value::Null);
    let version = precache["version"].as_str().unwrap_or("");
    let hex = version.len() == 16 && version.chars().all(|char| char.is_ascii_hexdigit());
    let field = |key: &str| {
        precache
            .get(key)
            .cloned()
            .unwrap_or(Value::Null)
            .to_string()
    };
    [
        format!(
            "precache version: {}",
            if hex { "<16 hex digits>" } else { "(none)" }
        ),
        format!("precache shell: {}", field("shell")),
        format!("precache hashed: {}", field("hashed")),
        format!("precache required: {}", field("required")),
        format!("precache optional: {}", field("optional")),
        format!("listeners: {}", worker.listeners()),
    ]
    .join("\n")
}

#[test]
fn build_bundles_the_service_worker_of_the_project() {
    let dir = own_worker_fixture(|_| {});
    let result = run_imp(&["build"], &dir.path);
    let sw = read(&dir.join("dist/sw.js"));
    let worker = Worker::new(&sw, None);
    let import = Regex::new(r"(?m)^\s*import\s").unwrap();
    let report = [
        format!("first line: {}", sw.lines().next().unwrap_or("")),
        format!(
            "bare imports left: {}",
            if import.is_match(&sw) { "yes" } else { "no" }
        ),
        format!("worker code ran: {}", worker.fixture()),
        format!("listeners: {}", worker.listeners()),
        format!("mock endpoint: {}", worker.mock_endpoint()),
    ];
    assert_snapshot(
        "build-own-worker",
        &mask_build(
            &format!(
                "{}\n{}\n",
                transcript("imp build  (cwd: <tmp>)", &result),
                section("dist/sw.js", &report.join("\n"))
            ),
            &dir,
        ),
    );

    let dir = TempDir::new();
    copy_directory(&fixture("build-pwa"), &dir.path);
    copy_directory(
        &fixture("start-service-worker").join("src"),
        &dir.join("src"),
    );
    write(
        &dir.join("src/sw.js"),
        "import { precacheBuild } from 'imp/service-worker'\nimport { greeting } from './greeting.js'\n\nself.__fixture = { greeting }\n\nprecacheBuild()\n",
    );
    let mut config: Value = serde_json::from_str(&read(&dir.join("imp.json"))).unwrap();
    config["serviceWorker"] = Value::from("src/sw.js");
    write(
        &dir.join("imp.json"),
        &format!("{}\n", serde_json::to_string_pretty(&config).unwrap()),
    );
    let plain = run_imp(&["build"], &dir.path);
    check(
        plain.code == 0,
        format!("the plain build failed:\n{}", plain.stderr),
    );
    let plain_worker = read(&dir.join("dist/sw.js"));
    let result = run_imp(&["build", "--pwa"], &dir.path);
    let html = with_built_scripts(&dir.join("dist"), &read(&dir.join("dist/index.html")));
    let sw = read(&dir.join("dist/sw.js"));
    let registration = Regex::new(r"serviceWorker\.register\([^)]*\)")
        .unwrap()
        .find(&html)
        .map(|found| found.as_str().to_string())
        .unwrap_or_else(|| "(none)".into());
    let report = [
        format!("registration: {registration}"),
        format!(
            "dist/sw.js is the project worker: {}",
            if sw.contains("__fixture") {
                "yes"
            } else {
                "no"
            }
        ),
        precache_report(&sw),
        String::new(),
        "without --pwa:".into(),
        precache_report(&plain_worker),
    ];
    assert_snapshot(
        "build-own-worker-pwa",
        &mask_build(
            &format!(
                "{}\n{}\n",
                transcript("imp build --pwa  (cwd: <tmp>)", &result),
                section("output", &report.join("\n"))
            ),
            &dir,
        ),
    );
}

#[test]
fn an_incomplete_mocks_config_is_reported() {
    let dir = TempDir::new();
    write(
        &dir.join("index.html"),
        "<!doctype html>\n<div id=\"app\"></div>\n",
    );
    let reported: Vec<String> = [
        "\"mocks\": \"mocks\"",
        "\"mocks\": { \"folder\": \"mocks\" }",
        "\"mocks\": {}",
    ]
    .iter()
    .map(|declared| {
        write(&dir.join("imp.json"), &format!("{{\n  {declared}\n}}\n"));
        let result = run_imp(&["lint", "index.html"], &dir.path);
        format!("{{ {declared} }}\n{}", result.stderr.trim())
    })
    .collect();
    assert_snapshot(
        "mocks-config-problems",
        &format!("{}\n", reported.join("\n\n")),
    );
}

#[test]
fn build_leaves_the_mocks_folder_behind() {
    let dir = TempDir::new();
    copy_directory(&fixture("start-mocks"), &dir.path);
    let mut result = run_imp(&["build"], &dir.path);
    result.stdout = mask_build(&result.stdout, &dir);
    let built: Vec<String> = list_files(&dir.join("dist"))
        .into_iter()
        .map(|file| format!("dist/{file}"))
        .collect();
    assert_snapshot(
        "build-omits-mocks",
        &format!(
            "{}\n{}\n",
            transcript("imp build  (cwd: <tmp>)", &result),
            mask_build(&section("output files", &built.join("\n")), &dir)
        ),
    );
}

fn ask_mock(port: u16, path: &str) -> String {
    let body = json!({ "method": "GET", "path": path }).to_string();
    let origin = format!("http://localhost:{port}");
    let answer = http(
        port,
        "POST",
        "/@imp/mock",
        &[("content-type", "application/json"), ("origin", &origin)],
        Some(body.as_bytes()),
    );
    format!("{} {}", answer.status, answer.text())
}

#[test]
fn the_mocks_report_problems_and_keep_their_state() {
    let dir = TempDir::new();
    write(&dir.join("index.html"), "<!doctype html>\n");
    write(
        &dir.join("imp.json"),
        "{ \"mocks\": { \"folder\": \"mocks\", \"enabled\": true } }\n",
    );
    let file = dir.join("mocks/counter.mock.js");
    write(&file, "export const mocks = [\n");
    let server = start_dev(&dir.path, &[]);
    let _ = ask_mock(server.port, "/api/count");
    write(&file, "export const mocks = { match: () => true }\n");
    let _ = ask_mock(server.port, "/api/count");
    write(&dir.join("mocks/start.js"), "export const start = 10\n");
    write(
        &file,
        "import { start } from './start.js'\nlet count = start\nexport const mocks = [{ match: () => true, handler: () => ({ body: { count: ++count } }) }]\n",
    );
    let answers = [
        ask_mock(server.port, "/api/count"),
        ask_mock(server.port, "/api/count"),
        ask_mock(server.port, "/api/count"),
    ];
    write(&dir.join("mocks/start.js"), "export const start = 100\n");
    let after_fixture_edit = ask_mock(server.port, "/api/count");
    drop(server);
    let log = read(&dir.join(".imp/dev.log"));
    let reported: Vec<String> = log
        .lines()
        .filter_map(|line| {
            let message = line.split_once("mocks - ")?.1;
            Some(format!("reported: {message}"))
        })
        .collect();
    let missing = TempDir::new();
    write(&missing.join("index.html"), "<!doctype html>\n");
    write(
        &missing.join("imp.json"),
        "{ \"mocks\": { \"folder\": \"absent\", \"enabled\": true } }\n",
    );
    drop(start_dev(&missing.path, &[]));
    let missing_line = read(&missing.join(".imp/dev.log"))
        .lines()
        .find_map(|line| {
            line.split_once("mocks - ")
                .map(|(_, message)| message.to_string())
        })
        .unwrap_or_default();
    let mut lines = reported;
    lines.push(String::new());
    lines.extend(answers.iter().map(|answer| format!("answer: {answer}")));
    lines.push(format!(
        "after an edit to an imported fixture: {after_fixture_edit}"
    ));
    lines.push(format!("missing directory: {missing_line}"));
    lines.push(String::new());
    assert_snapshot("mocks-build-problem", &lines.join("\n"));
}

#[test]
fn a_mock_that_throws_outside_its_handler_stops_only_the_mocks() {
    let dir = TempDir::new();
    write(&dir.join("index.html"), "<!doctype html>\n");
    write(
        &dir.join("imp.json"),
        "{ \"mocks\": { \"folder\": \"mocks\", \"enabled\": true } }\n",
    );
    write(
        &dir.join("mocks/late.mock.js"),
        "let calls = 0\nexport const mocks = [{\n  match: () => true,\n  handler: (request) => {\n    calls++\n    if (request.path === '/crash') setTimeout(() => { throw new Error('late failure') })\n    return { body: calls }\n  },\n}]\n",
    );
    let server = start_dev(&dir.path, &[]);
    let first = ask_mock(server.port, "/api/value");
    let _ = ask_mock(server.port, "/crash");
    std::thread::sleep(Duration::from_millis(500));
    let after_crash = ask_mock(server.port, "/api/value");
    check(first == "200 1", format!("the first answer is {first}"));
    check(
        after_crash == "200 1",
        format!("a reloaded mock set starts again, and answers {after_crash}"),
    );
    drop(server);
    let log = read(&dir.join(".imp/dev.log"));
    check(
        log.contains("late failure"),
        format!("the failure was not reported:\n{log}"),
    );
}

#[test]
fn the_dev_server_answers_its_endpoints_only_for_its_own_pages() {
    let dir = TempDir::new();
    copy_directory(&fixture("start-mocks"), &dir.path);
    write(&dir.join(".env"), "SECRET=1\n");
    write(
        &dir.join(".well-known/security.txt"),
        "Contact: a@b.example\n",
    );
    write(&dir.join("notes/.drafts/plan.txt"), "SECRET plan\n");
    write(
        &dir.join("note.preview.js"),
        "import { div } from 'imp/html'\nexport const plain = div('note')\n",
    );
    let servers = [
        ("imp start", start_dev(&dir.path, &["--mock"])),
        ("imp preview", start_preview(&dir.path, &["--mock"])),
    ];
    let mut transcript_lines = Vec::new();
    for (label, server) in &servers {
        let port = server.port;
        let own = format!("http://localhost:{port}");
        let mut request =
            |name: &str, path: &str, method: &str, headers: &[(&str, &str)], body: Option<&str>| {
                let status = if path == "/@imp/events" {
                    raw_status_line(
                        port,
                        path,
                        method,
                        &format!("localhost:{port}"),
                        &headers
                            .iter()
                            .map(|(name, value)| format!("{name}: {value}"))
                            .collect::<Vec<_>>()
                            .iter()
                            .map(String::as_str)
                            .collect::<Vec<_>>(),
                    )
                    .split(' ')
                    .nth(1)
                    .unwrap_or("")
                    .to_string()
                } else {
                    let answer = http(port, method, path, headers, body.map(str::as_bytes));
                    let leaked = if answer.text().contains("SECRET") {
                        " (the file leaked)"
                    } else {
                        ""
                    };
                    format!("{}{leaked}", answer.status)
                };
                transcript_lines.push(format!("{label} | {name}: {method} {path} -> {status}"));
            };
        let json_type = ("content-type", "application/json");
        let batch = "[]".to_string();
        let described = json!({ "method": "GET", "path": "/api/count" }).to_string();
        request("a dot file", "/.env", "GET", &[], None);
        request("a dot folder", "/notes/.drafts/plan.txt", "GET", &[], None);
        request("an encoded dot file", "/%2Eenv", "GET", &[], None);
        request(
            "the .well-known folder",
            "/.well-known/security.txt",
            "GET",
            &[],
            None,
        );
        for (path, body) in [("/@imp/log", &batch), ("/@imp/mock", &described)] {
            request(
                "from another site",
                path,
                "POST",
                &[json_type, ("origin", "http://evil.example")],
                Some(body),
            );
            request(
                "from the page, as text",
                path,
                "POST",
                &[("content-type", "text/plain"), ("origin", &own)],
                Some(body),
            );
            request("with no origin", path, "POST", &[json_type], Some(body));
            request(
                "from the page",
                path,
                "POST",
                &[json_type, ("origin", &own)],
                Some(body),
            );
            request(
                "same-origin fetch metadata",
                path,
                "POST",
                &[json_type, ("sec-fetch-site", "same-origin")],
                Some(body),
            );
        }
        let review = json!({ "element": { "path": "body" }, "comment": "x" }).to_string();
        request(
            "a review from another site",
            "/@imp/review",
            "POST",
            &[json_type, ("origin", "http://evil.example")],
            Some(&review),
        );
        request(
            "events for another site",
            "/@imp/events",
            "GET",
            &[("origin", "http://evil.example")],
            None,
        );
        request(
            "events for a cross-site page",
            "/@imp/events",
            "GET",
            &[("sec-fetch-site", "cross-site")],
            None,
        );
        request(
            "events for the page",
            "/@imp/events",
            "GET",
            &[("sec-fetch-site", "same-origin")],
            None,
        );
        let rebound_host = format!("rebound.example:{port}");
        let rebound_origin = format!("origin: http://rebound.example:{port}");
        let rebound = raw_status_line(
            port,
            "/@imp/log",
            "POST",
            &rebound_host,
            &[
                &rebound_origin,
                "content-type: application/json",
                "content-length: 2",
            ],
        );
        transcript_lines.push(format!(
            "{label} | a rebound host name: POST /@imp/log -> {rebound}"
        ));
        for path in [
            "/",
            "/app.js",
            "/@imp/imp.js",
            "/@imp/preview/app.js",
            "/missing",
        ] {
            let status = raw_status_line(port, path, "GET", &rebound_host, &[]);
            transcript_lines.push(format!(
                "{label} | a rebound host name: GET {path} -> {status}"
            ));
        }
        for host in [format!("localhost:{port}"), format!("127.0.0.1:{port}")] {
            let status = raw_status_line(port, "/", "GET", &host, &[]);
            transcript_lines.push(format!(
                "{label} | the host {}: GET / -> {status}",
                host.split(':').next().unwrap()
            ));
        }
    }
    transcript_lines.push(format!(
        "a review was saved: {}",
        dir.join(".imp/reviews").exists()
    ));
    assert_snapshot(
        "start-endpoint-access",
        &format!("{}\n", transcript_lines.join("\n")),
    );
}

#[test]
fn the_dev_server_listens_on_loopback_unless_host_opens_it() {
    let dir = TempDir::new();
    copy_directory(&fixture("basic"), &dir.path);
    let reachable = |host: &str, port: u16| {
        std::net::TcpStream::connect_timeout(
            &format!("{host}:{port}").parse().unwrap(),
            Duration::from_secs(2),
        )
        .is_ok()
    };
    let address = imp::start::network_addresses().into_iter().next();
    let closed = start_dev(&dir.path, &[]);
    check(
        reachable("127.0.0.1", closed.port),
        "the default server is not on 127.0.0.1",
    );
    if let Some(address) = &address {
        check(
            !reachable(address, closed.port),
            format!("the default server answers on {address}"),
        );
    }
    check(
        !closed.banner.contains("every device"),
        "the default banner warns",
    );
    drop(closed);
    let open = start_dev(&dir.path, &["--host", "0.0.0.0"]);
    check(
        reachable("127.0.0.1", open.port),
        "the open server is not on 127.0.0.1",
    );
    if let Some(address) = &address {
        check(
            reachable(address, open.port),
            format!("the open server is not on {address}"),
        );
        check(
            open.banner
                .contains(&format!("-> http://{address}:{}/", open.port)),
            format!("the banner does not name {address}:\n{}", open.banner),
        );
    }
    drop(open);
    let missing = run_imp(&["start", "--host"], &fixture("basic"));
    check(
        missing.code == 1 && missing.stderr.contains("--host needs an address"),
        missing.stderr,
    );
}

#[test]
fn the_dev_server_answers_a_tunnel_name_that_allow_host_names() {
    let dir = TempDir::new();
    copy_directory(&fixture("start-mocks"), &dir.path);
    write(
        &dir.join("note.preview.js"),
        "import { div } from 'imp/html'\nexport const plain = div('note')\n",
    );
    let allowed = [
        "--allow-host",
        "My-Box.Tunnel.example",
        "--allow-host",
        "95.216.245.98",
    ];
    let servers = [
        ("imp start", start_dev(&dir.path, &allowed)),
        ("imp preview", start_preview(&dir.path, &allowed)),
    ];
    let mut transcript_lines = Vec::new();
    for (label, server) in &servers {
        let port = server.port;
        check(
            server
                .banner
                .contains("answers for My-Box.Tunnel.example, 95.216.245.98"),
            format!(
                "{label} does not warn about the allowed names:\n{}",
                server.banner
            ),
        );
        for host in [
            "my-box.tunnel.example".to_string(),
            "my-box.tunnel.example:443".to_string(),
            "95.216.245.98:8080".to_string(),
            "other.example".to_string(),
        ] {
            let status = raw_status_line(port, "/", "GET", &host, &[]);
            transcript_lines.push(format!("{label} | the host {host}: GET / -> {status}"));
        }
        for origin in [
            "https://my-box.tunnel.example",
            "http://my-box.tunnel.example",
            "https://evil.example",
        ] {
            let origin_header = format!("origin: {origin}");
            let status = raw_status_line(
                port,
                "/@imp/log",
                "POST",
                "my-box.tunnel.example",
                &[
                    &origin_header,
                    "content-type: application/json",
                    "content-length: 2",
                ],
            );
            transcript_lines.push(format!(
                "{label} | the tunnel host, origin {origin}: POST /@imp/log -> {status}"
            ));
        }
    }
    let missing = run_imp(&["start", "--allow-host"], &fixture("basic"));
    transcript_lines.push(format!(
        "--allow-host with no name: exit {} | {}",
        missing.code,
        missing.stderr.trim()
    ));
    assert_snapshot(
        "start-allow-host",
        &format!("{}\n", transcript_lines.join("\n")),
    );
}

#[test]
fn the_dev_server_serves_a_file_and_a_folder_with_a_non_ascii_name() {
    let dir = TempDir::new();
    copy_directory(&fixture("basic"), &dir.path);
    let folder = "zdj\u{119}cia-\u{6587}\u{6863}";
    let file = "\u{17c}\u{f3}\u{142}w-\u{732b}.txt";
    write(&dir.join(&format!("{folder}/{file}")), "turtle\n");
    let server = start_dev(&dir.path, &[]);
    let encode = imp::service_worker::encode_uri_component;
    let folder_path = format!("/{}", encode(folder));
    let file_path = format!("{folder_path}/{}", encode(file));
    let served = get(server.port, &file_path);
    check(
        served.status == 200 && served.text() == "turtle\n",
        format!("the file answered {}", served.status),
    );
    let redirect = get(server.port, &folder_path);
    check(
        redirect.status == 302,
        format!("the folder answered {}", redirect.status),
    );
    let location = redirect.header("location").unwrap_or("");
    check(
        location == format!("{folder_path}/"),
        format!("the folder redirects to {location}"),
    );
}
