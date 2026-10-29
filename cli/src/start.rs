use crate::colors::{dim, green, red};
use crate::config::{Config, load_imp_config, mocks_setting, public_directory};
use crate::dev_log::{DEFAULT_MAX_LOG_ENTRIES, DevLog};
use crate::environments::{Env, env_injection_script, resolve_environment};
use crate::flags::{Flags, flags_injection_script, split_env_and_flags};
use crate::html_document::{apply_edits, head_edit, read_html};
use crate::http_server::{Request, Response, content_type};
use crate::logger;
use crate::mocks::{MOCK_ENDPOINT, MockState, Mocks};
use crate::paths::posix;
use crate::pwa::{APPLE_TOUCH_ICON, Icon, build_manifest, pwa_head_tags, render_icon_set};
use crate::review::{REVIEW_ENDPOINT, REVIEW_LOG_LINES, TELEMETRY_ENTRIES};
use crate::service_worker::{
    SERVICE_WORKER_PATH, WorkerBundler, WorkerState, assemble_service_worker,
    assert_service_worker_source,
};
use crate::specifiers::IMP_MODULES;
use anyhow::Result;
use serde_json::{Map, Value, json};
use std::io::Write;
use std::net::{IpAddr, TcpListener};
use std::path::{Component, Path, PathBuf};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

const DEFAULT_DEV_SERVER_PORT: u16 = 4400;
pub const DEFAULT_DEV_HOST: &str = "127.0.0.1";
pub const DEV_WORKER_PATH: &str = "/@imp/sw.js";
pub const EVENTS_ENDPOINT: &str = "/@imp/events";
pub const LOG_ENDPOINT: &str = "/@imp/log";
const THEME_DRAFT_MODULE: &str = "/@imp/theme-draft.js";
const THEME_DRAFT_PREFIX: &str = "imp.theme-draft.";
const DEV_MANIFEST_PATH: &str = "/@imp/manifest.webmanifest";
const DEV_ICON_PREFIX: &str = "/@imp/pwa/";
const WELL_KNOWN_FOLDER: &str = ".well-known";
const CHANGE_SETTLE_DELAY: Duration = Duration::from_millis(80);
const EVENT_KEEP_ALIVE: Duration = Duration::from_secs(15);

pub struct StartOptions {
    pub entry: String,
    pub port: Option<u16>,
    pub host: Option<String>,
    pub allowed_hosts: Vec<String>,
    pub env: Option<String>,
    pub mocks: Option<bool>,
    pub reload: bool,
}

pub struct App {
    pub root: PathBuf,
    pub entry_name: String,
    pub head_injection: String,
    pub missing_dependencies: Vec<String>,
    pub pwa: Option<Map<String, Value>>,
    pub max_log_entries: usize,
    pub dev_server_port: Option<u16>,
    pub mocks: Option<Arc<Mocks>>,
    pub service_worker: Option<String>,
    pub worker: Arc<WorkerBundler>,
    pub env: Env,
    pub flags: Flags,
    pub public_dir: PathBuf,
}

#[derive(Clone, Copy, Default, PartialEq)]
pub enum Widget {
    #[default]
    None,
    Review,
    ReviewAndThemeEditor,
}

#[derive(Default)]
pub struct AppOptions {
    pub env_alias: Option<String>,
    pub mocks: Option<bool>,
    pub widget: Widget,
}

fn imp_module_path(module: &str) -> String {
    format!("/@imp/{module}")
}

fn injection_marker() -> String {
    imp_module_path("imp.js")
}

pub fn development_checks_script() -> String {
    "<script>globalThis.__IMP_DEV__ = true</script>".into()
}

pub fn client_script(mocks: bool, own_worker: bool, mark: &str, widget: Widget) -> String {
    let theme_editor = widget == Widget::ReviewAndThemeEditor;
    let input = json!({
        "eventsEndpoint": EVENTS_ENDPOINT,
        "logEndpoint": LOG_ENDPOINT,
        "workerPath": if own_worker { Value::Null } else { Value::from(DEV_WORKER_PATH) },
        "telemetryEntries": TELEMETRY_ENTRIES,
        "mocks": mocks,
        "themeEditor": theme_editor,
        "themeDraftPrefix": THEME_DRAFT_PREFIX,
        "themeDraftModule": THEME_DRAFT_MODULE,
        "previewFrameNamePrefix": crate::preview::PREVIEW_FRAME_NAME_PREFIX,
    });
    let client = crate::browser_script::browser_script("dev-client.js", &input);
    if widget == Widget::None {
        return client;
    }
    format!(
        "{client};{}",
        crate::review::review_widget_script(mark, theme_editor)
    )
}

pub fn import_map(dependencies: &[String]) -> Value {
    let mut imports = Map::new();
    for (specifier, module) in IMP_MODULES {
        imports.insert((*specifier).into(), Value::from(imp_module_path(module)));
    }
    for alias in dependencies {
        imports.insert(
            alias.clone(),
            Value::from(format!("/dependencies/{alias}/{alias}.js")),
        );
    }
    json!({ "imports": imports })
}

pub struct HeadParts<'a> {
    pub dependencies: &'a [String],
    pub pwa: Option<&'a Map<String, Value>>,
    pub env: &'a Env,
    pub flags: &'a Flags,
    pub mocks: bool,
    pub own_worker: bool,
    pub mark: &'a str,
    pub widget: Widget,
}

pub fn build_head_injection(parts: HeadParts) -> String {
    let pwa_tags = parts
        .pwa
        .map(|pwa| {
            format!(
                "\n{}",
                pwa_head_tags(
                    DEV_MANIFEST_PATH,
                    pwa.get("themeColor").and_then(Value::as_str),
                    &format!("{DEV_ICON_PREFIX}{APPLE_TOUCH_ICON}"),
                )
            )
        })
        .unwrap_or_default();
    let value_tags: String = [
        development_checks_script(),
        env_injection_script(parts.env),
        flags_injection_script(parts.flags),
    ]
    .into_iter()
    .filter(|tag| !tag.is_empty())
    .map(|tag| format!("{tag}\n"))
    .collect();
    format!(
        "<script>{}</script>\n{value_tags}<script type=\"importmap\">{}</script>{pwa_tags}",
        client_script(parts.mocks, parts.own_worker, parts.mark, parts.widget),
        import_map(parts.dependencies)
    )
}

pub fn inject_imp(html: &str, head_injection: &str) -> String {
    if html.contains(&injection_marker()) {
        return html.to_string();
    }
    apply_edits(html, &mut [head_edit(&read_html(html), head_injection)])
}

fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other),
        }
    }
    out
}

pub fn resolve_within_root(dir: &Path, relative_path: &str) -> Option<(String, PathBuf)> {
    let mut path = crate::http_server::percent_decode_strict(relative_path)?;
    if path.ends_with('/') {
        path.push_str("index.html");
    }
    let base = normalize(&crate::paths::absolute(dir));
    let fs_path = normalize(&base.join(path.trim_start_matches('/')));
    if fs_path != base && !fs_path.starts_with(&base) {
        return None;
    }
    let relative = posix(fs_path.strip_prefix(&base).ok()?);
    if crate::walk::is_skipped_path(&relative) {
        return None;
    }
    Some((path, fs_path))
}

pub fn has_hidden_segment(relative_path: &str) -> bool {
    relative_path
        .split(['/', '\\'])
        .any(|segment| segment.starts_with('.') && segment != WELL_KNOWN_FOLDER)
}

fn not_found(path: &str) -> Response {
    Response::text(404, format!("not found: {path}"))
}

pub fn serve_from_dir(dir: &Path, relative_path: &str, head_injection: Option<&str>) -> Response {
    let Some((path, fs_path)) = resolve_within_root(dir, relative_path) else {
        return Response::text(403, "forbidden");
    };
    let base = normalize(&crate::paths::absolute(dir));
    if has_hidden_segment(&posix(fs_path.strip_prefix(&base).unwrap_or(&fs_path))) {
        return not_found(&path);
    }
    let Ok(meta) = std::fs::metadata(&fs_path) else {
        return not_found(&path);
    };
    if meta.is_dir() {
        return Response::empty(302).header("location", &format!("{relative_path}/"));
    }
    let Ok(bytes) = std::fs::read(&fs_path) else {
        return not_found(&path);
    };
    let name = fs_path.to_string_lossy();
    let kind = content_type(&name);
    if let Some(injection) = head_injection
        && name.to_ascii_lowercase().ends_with(".html")
    {
        return Response::new(
            200,
            kind,
            inject_imp(&String::from_utf8_lossy(&bytes), injection),
        );
    }
    Response::new(200, kind, bytes)
}

fn serve_library(path: &str) -> Response {
    let Some(decoded) = crate::http_server::percent_decode_strict(path) else {
        return Response::text(403, "forbidden");
    };
    let clean = posix(normalize(Path::new(decoded.trim_start_matches('/'))));
    match crate::embedded::file(&format!("lib/src/{clean}")) {
        Some(bytes) => Response::new(200, content_type(&clean), bytes.to_vec()),
        None => not_found(path),
    }
}

pub fn load_app(entry_path: &Path, options: AppOptions) -> Result<App> {
    let root = entry_path.parent().unwrap_or(Path::new("/")).to_path_buf();
    let entry_name = crate::paths::file_name(entry_path);
    let config = load_imp_config(&root)?;
    load_app_with(&root, &entry_name, &config, options)
}

fn load_app_with(
    root: &Path,
    entry_name: &str,
    config: &Config,
    options: AppOptions,
) -> Result<App> {
    let dependencies: Vec<String> = crate::config::dependencies(config)
        .into_iter()
        .map(|(alias, _)| alias)
        .collect();
    let pwa = config.get("pwa").and_then(Value::as_object).cloned();
    let selected = resolve_environment(root, config, options.env_alias.as_deref())?;
    let (env, flags) = split_env_and_flags(config, &selected)?;
    let declared = mocks_setting(config);
    let mocking = declared
        .as_ref()
        .is_some_and(|declared| options.mocks.unwrap_or(declared.enabled));
    let service_worker_entry = crate::config::get_str(config, &["serviceWorker"])
        .map(|declared| (declared.to_string(), root.join(declared)));
    if let Some((declared, path)) = &service_worker_entry {
        assert_service_worker_source(path, declared)?;
    }
    let mark = crate::review::read_widget_mark();
    let head_injection = build_head_injection(HeadParts {
        dependencies: &dependencies,
        pwa: pwa.as_ref(),
        env: &env,
        flags: &flags,
        mocks: mocking,
        own_worker: service_worker_entry.is_some(),
        mark: &mark,
        widget: options.widget,
    });
    let mocks = match (&declared, mocking) {
        (Some(declared), true) => {
            let directory = root.join(&declared.folder);
            let report_root = root.to_path_buf();
            let report_directory = directory.clone();
            Some(Arc::new(Mocks::new(
                root,
                &directory,
                dependencies.clone(),
                move |state| report_mocks(state, &report_root, &report_directory),
            )))
        }
        _ => None,
    };
    if let (Some(declared), false) = (&declared, mocking) {
        logger::info(&format!(
            "mocks - {}/ is declared but off for this run; pass --mock to serve it",
            declared.folder
        ));
    }
    let worker = Arc::new(WorkerBundler::new(
        root,
        service_worker_entry.as_ref().map(|(_, path)| path.clone()),
        dependencies.clone(),
    ));
    let missing_dependencies = dependencies
        .iter()
        .filter(|alias| {
            !root
                .join("dependencies")
                .join(alias)
                .join(format!("{alias}.js"))
                .is_file()
        })
        .cloned()
        .collect();
    Ok(App {
        root: root.to_path_buf(),
        entry_name: entry_name.to_string(),
        head_injection,
        missing_dependencies,
        pwa,
        max_log_entries: config
            .get("maxLogEntries")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(DEFAULT_MAX_LOG_ENTRIES),
        dev_server_port: config
            .get("devServerPort")
            .and_then(Value::as_u64)
            .map(|port| port as u16),
        mocks,
        service_worker: service_worker_entry.map(|(declared, _)| declared.replace('\\', "/")),
        worker,
        env,
        flags,
        public_dir: public_directory(root),
    })
}

pub fn report_service_worker(state: &WorkerState, service_worker: &str) {
    if !state.changed {
        return;
    }
    match &state.problem {
        Some(problem) => logger::error(&format!("service worker - {problem}")),
        None => logger::info(&format!(
            "service worker - {service_worker} serving at {SERVICE_WORKER_PATH}; dev mode runs when it calls startDevMode()"
        )),
    }
}

pub fn report_mocks(state: &MockState, root: &Path, directory: &Path) {
    let where_ = posix(directory.strip_prefix(root).unwrap_or(directory));
    for problem in &state.problems {
        logger::error(&format!("mocks - {problem}"));
    }
    if !state.files.is_empty() {
        let answering = if state.entries.is_empty() {
            "answering nothing"
        } else {
            "answering requests"
        };
        logger::info(&format!(
            "mocks - {} file(s) from {where_}/ {answering}",
            state.files.len()
        ));
    } else if state.problems.is_empty() {
        logger::warn(&format!("mocks - no *.mock.js files under {where_}/"));
    }
}

fn print_entry(entry: &Value) {
    let text = |key: &str| {
        entry
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    };
    match entry.get("type").and_then(Value::as_str) {
        Some("console") => logger::browser(&text("level"), &text("text")),
        Some("page") => logger::browser("uncaught", &text("text")),
        Some("net") => {
            let status = match (
                entry.get("error"),
                entry.get("status").and_then(Value::as_u64),
            ) {
                (Some(Value::String(error)), _) => red(error),
                (_, Some(status)) if status >= 400 => red(status.to_string()),
                (_, Some(status)) => green(status.to_string()),
                _ => red("?"),
            };
            let from = entry
                .get("mock")
                .and_then(Value::as_str)
                .map(|mock| dim(format!(" (mock: {mock})")))
                .unwrap_or_default();
            let ms = entry.get("ms").map(|ms| ms.to_string()).unwrap_or_default();
            logger::http(&format!(
                "{} {} -> {status} {}{from}",
                text("method"),
                text("url"),
                dim(format!("{ms}ms"))
            ));
        }
        _ => {}
    }
}

#[derive(Clone, Default)]
pub struct Clients(Arc<Mutex<Vec<mpsc::Sender<String>>>>);

impl Clients {
    pub fn broadcast(&self, message: &str) {
        self.0
            .lock()
            .unwrap()
            .retain(|client| client.send(message.to_string()).is_ok());
    }

    fn subscribe(&self) -> mpsc::Receiver<String> {
        let (sender, receiver) = mpsc::channel();
        self.0.lock().unwrap().push(sender);
        receiver
    }
}

fn event_stream(clients: &Clients) -> Response {
    let receiver = clients.subscribe();
    Response::stream(
        "text/event-stream",
        Box::new(move |out: &mut dyn Write| {
            if out
                .write_all(b": connected\n\n")
                .and_then(|_| out.flush())
                .is_err()
            {
                return;
            }
            loop {
                let chunk = match receiver.recv_timeout(EVENT_KEEP_ALIVE) {
                    Ok(message) => format!("data: {message}\n\n"),
                    Err(mpsc::RecvTimeoutError::Timeout) => ": keep-alive\n\n".into(),
                    Err(mpsc::RecvTimeoutError::Disconnected) => return,
                };
                if out
                    .write_all(chunk.as_bytes())
                    .and_then(|_| out.flush())
                    .is_err()
                {
                    return;
                }
            }
        }),
    )
    .header("cache-control", "no-store")
}

fn json_response(body: Value, status: u16) -> Response {
    Response::json(status, &body).header("cache-control", "no-store")
}

fn save_review(request: &Request, root: &Path, recent_log: Option<&DevLog>) -> Response {
    if !crate::review::is_local_address(&request.peer) {
        return json_response(
            json!({ "error": "reviews are only accepted from this machine" }),
            403,
        );
    }
    let Some(payload) = request.json() else {
        return json_response(json!({ "error": "the review could not be read" }), 400);
    };
    let log = recent_log
        .map(|log| log.recent(REVIEW_LOG_LINES))
        .unwrap_or_default();
    match crate::review::write_review(root, &payload, &log) {
        Ok(path) => {
            logger::info(&format!("review - {path}"));
            json_response(json!({ "path": path }), 200)
        }
        Err(error) => {
            logger::error(&format!("review - {error}"));
            json_response(json!({ "error": error.to_string() }), 400)
        }
    }
}

fn unbracketed(host: &str) -> &str {
    host.strip_prefix('[')
        .and_then(|rest| rest.strip_suffix(']'))
        .unwrap_or(host)
}

fn url_hostname(host: &str) -> String {
    let bare = unbracketed(host);
    if bare.contains(':') {
        format!("[{bare}]")
    } else {
        bare.to_ascii_lowercase()
    }
}

pub fn is_loopback_host(host: &str) -> bool {
    let bare = unbracketed(host).to_ascii_lowercase();
    if bare == "localhost" || bare.ends_with(".localhost") || bare == "::1" {
        return true;
    }
    let parts: Vec<&str> = bare.split('.').collect();
    parts.len() == 4
        && parts[0] == "127"
        && parts[1..].iter().all(|part| part.parse::<u8>().is_ok())
}

pub fn is_wildcard_host(host: &str) -> bool {
    matches!(host, "0.0.0.0" | "::" | "[::]")
}

pub fn listen_hostname(host: Option<&str>) -> String {
    unbracketed(host.unwrap_or(DEFAULT_DEV_HOST)).to_string()
}

fn interface_addresses() -> Vec<IpAddr> {
    if_addrs::get_if_addrs()
        .map(|interfaces| {
            interfaces
                .into_iter()
                .map(|interface| interface.ip())
                .collect()
        })
        .unwrap_or_default()
}

pub fn network_addresses() -> Vec<String> {
    interface_addresses()
        .into_iter()
        .filter(|address| address.is_ipv4())
        .map(|address| address.to_string())
        .filter(|address| !is_loopback_host(address))
        .collect()
}

pub fn served_hostnames(host: Option<&str>, allowed_hosts: &[String]) -> Vec<String> {
    let listened = match host {
        None => Vec::new(),
        Some(host) if is_loopback_host(host) => Vec::new(),
        Some(host) if is_wildcard_host(host) => interface_addresses()
            .iter()
            .map(|address| url_hostname(&address.to_string()))
            .collect(),
        Some(host) => vec![url_hostname(host)],
    };
    listened
        .into_iter()
        .chain(allowed_hosts.iter().map(|name| authority_hostname(name)))
        .collect()
}

pub fn server_urls(host: Option<&str>, port: u16, path: &str) -> Vec<String> {
    let local = format!("http://localhost:{port}{path}");
    match host {
        None => vec![local],
        Some(host) if host == DEFAULT_DEV_HOST || host == "localhost" => vec![local],
        Some(host) if is_wildcard_host(host) => std::iter::once(local)
            .chain(
                network_addresses()
                    .into_iter()
                    .map(|address| format!("http://{address}:{port}{path}")),
            )
            .collect(),
        Some(host) => vec![format!("http://{}:{port}{path}", url_hostname(host))],
    }
}

pub fn exposed_host_warning(host: &str) -> String {
    format!(
        "the dev server listens on {host} - every device on that network can read the files of this project. Use --host only on a network that you trust, and stop the server when you are done"
    )
}

pub fn allowed_hosts_warning(allowed_hosts: &[String]) -> String {
    format!(
        "the dev server answers for {} - everyone who reaches it through that name can read the files of this project. Use --allow-host only for a tunnel that you control, and stop the server when you are done",
        allowed_hosts.join(", ")
    )
}

fn authority_hostname(authority: &str) -> String {
    if let Some(rest) = authority.strip_prefix('[')
        && let Some((inside, _)) = rest.split_once(']')
    {
        return format!("[{}]", inside.to_ascii_lowercase());
    }
    if authority.matches(':').count() > 1 {
        return url_hostname(authority);
    }
    authority
        .split(':')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn request_hostname(request: &Request) -> String {
    authority_hostname(&request.host())
}

pub fn is_served_host(request: &Request, hostnames: &[String]) -> bool {
    let hostname = request_hostname(request);
    is_loopback_host(&hostname) || hostnames.contains(&hostname)
}

pub fn unknown_host_response(request: &Request) -> Response {
    Response::text(
        403,
        format!(
            "forbidden - the dev server does not answer for the host name '{}'; open one of the addresses that it printed, or pass that name with --allow-host",
            request_hostname(request)
        ),
    )
}

fn is_origin_of(origin: &str, request: &Request) -> bool {
    let host = request.host();
    ["http://", "https://"]
        .iter()
        .any(|scheme| origin.strip_prefix(scheme) == Some(host.as_str()))
}

pub fn is_own_page_request(request: &Request) -> bool {
    match request.header("origin") {
        Some(origin) => is_origin_of(origin, request),
        None => request.header("sec-fetch-site") == Some("same-origin"),
    }
}

pub fn is_json_request(request: &Request) -> bool {
    request
        .header("content-type")
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .eq_ignore_ascii_case("application/json")
}

fn has_extension(path: &str) -> bool {
    path.rsplit('/')
        .next()
        .is_some_and(|name| name.rfind('.').is_some_and(|index| index > 0))
}

fn is_client_route_request(request: &Request) -> bool {
    request.method == "GET"
        && !has_extension(&request.path)
        && request.header("accept").unwrap_or("").contains("text/html")
}

pub struct Handler {
    pub app: Arc<App>,
    pub clients: Clients,
    pub history_fallback: bool,
    pub recent_log: Option<DevLog>,
    pub hostnames: Vec<String>,
    icons: OnceLock<Result<Vec<Icon>, String>>,
}

impl Handler {
    pub fn new(app: Arc<App>, clients: Clients) -> Handler {
        Handler {
            app,
            clients,
            history_fallback: true,
            recent_log: None,
            hostnames: Vec::new(),
            icons: OnceLock::new(),
        }
    }

    fn refused(&self, request: &Request) -> bool {
        if request.path == EVENTS_ENDPOINT {
            return !is_own_page_request(request);
        }
        let post_endpoints = [REVIEW_ENDPOINT, LOG_ENDPOINT, MOCK_ENDPOINT];
        if request.method != "POST" || !post_endpoints.contains(&request.path.as_str()) {
            return false;
        }
        !is_own_page_request(request) || !is_json_request(request)
    }

    fn serve_asset(&self, path: &str) -> Response {
        let from_public = serve_from_dir(&self.app.public_dir, path, None);
        if from_public.status != 404 {
            return from_public;
        }
        serve_from_dir(&self.app.root, path, Some(&self.app.head_injection))
    }

    fn serve_worker(&self) -> Response {
        let worker = self.app.worker.build();
        if let Some(declared) = &self.app.service_worker {
            report_service_worker(&worker, declared);
        }
        if let Some(problem) = &worker.problem {
            return Response::text(500, format!("service worker - {problem}"))
                .header("cache-control", "no-store");
        }
        let endpoint = self.app.mocks.as_ref().map(|_| MOCK_ENDPOINT);
        Response::new(
            200,
            "text/javascript; charset=utf-8",
            assemble_service_worker(&worker.source, endpoint, &self.app.env, &self.app.flags),
        )
        .header("service-worker-allowed", "/")
        .header("cache-control", "no-store")
    }

    fn serve_icon(&self, path: &str, pwa: &Map<String, Value>) -> Response {
        let file = &path[DEV_ICON_PREFIX.len()..];
        let icons = self.icons.get_or_init(|| {
            render_icon_set(&self.app.root, pwa).map_err(|error| error.to_string())
        });
        match icons {
            Ok(icons) => match icons.iter().find(|icon| icon.file == file) {
                Some(icon) => Response::new(200, "image/png", icon.bytes.clone())
                    .header("cache-control", "no-store"),
                None => not_found(path),
            },
            Err(problem) => Response::text(500, problem.clone()),
        }
    }

    pub fn handle(&self, request: Request) -> Response {
        if !is_served_host(&request, &self.hostnames) {
            return unknown_host_response(&request);
        }
        if self.refused(&request) {
            return Response::text(
                403,
                "forbidden - this endpoint of the dev server answers only a JSON request from its own pages",
            );
        }
        let path = request.path.as_str();
        let app = &self.app;
        if path == REVIEW_ENDPOINT && request.method == "POST" {
            return save_review(&request, &app.root, self.recent_log.as_ref());
        }
        if let Some(pwa) = &app.pwa {
            if path == DEV_MANIFEST_PATH {
                return Response::new(
                    200,
                    "application/manifest+json",
                    build_manifest(pwa, DEV_ICON_PREFIX, "/", "/"),
                )
                .header("cache-control", "no-store");
            }
            if path.starts_with(DEV_ICON_PREFIX) {
                return self.serve_icon(path, pwa);
            }
        }
        if path == EVENTS_ENDPOINT {
            return event_stream(&self.clients);
        }
        if path == LOG_ENDPOINT && request.method == "POST" {
            if let Some(Value::Array(entries)) = request.json() {
                for entry in &entries {
                    print_entry(entry);
                }
            }
            return Response::text(200, "ok");
        }
        let worker_path = if app.service_worker.is_some() {
            SERVICE_WORKER_PATH
        } else {
            DEV_WORKER_PATH
        };
        if path == worker_path {
            return self.serve_worker();
        }
        if let Some(mocks) = &app.mocks
            && path == MOCK_ENDPOINT
            && request.method == "POST"
        {
            return mocks.answer(&request.body);
        }
        if let Some(rest) = path.strip_prefix("/@imp/") {
            return serve_library(rest);
        }
        let entry_path = format!("/{}", app.entry_name);
        if path == "/" || path == entry_path {
            return serve_from_dir(&app.root, &entry_path, Some(&app.head_injection));
        }
        let response = self.serve_asset(path);
        if response.status == 404 && self.history_fallback && is_client_route_request(&request) {
            return serve_from_dir(&app.root, &entry_path, Some(&app.head_injection));
        }
        response
    }
}

pub fn watch_for_changes(
    root: &Path,
    on_change: impl Fn() + Send + 'static,
) -> Result<notify::RecommendedWatcher> {
    use notify::{RecursiveMode, Watcher};
    let (sender, receiver) = mpsc::channel::<()>();
    let watched_root = root.to_path_buf();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };
        if matches!(event.kind, notify::EventKind::Access(_)) {
            return;
        }
        let relevant = event.paths.iter().any(|path| {
            let relative = posix(path.strip_prefix(&watched_root).unwrap_or(path));
            !crate::walk::is_skipped_path(&relative)
        });
        if relevant {
            let _ = sender.send(());
        }
    })?;
    watcher.watch(root, RecursiveMode::Recursive)?;
    std::thread::spawn(move || {
        while receiver.recv().is_ok() {
            while receiver.recv_timeout(CHANGE_SETTLE_DELAY).is_ok() {}
            on_change();
        }
    });
    Ok(watcher)
}

pub fn reload_banner_line(reload: bool) -> String {
    dim(format!(
        "  imp auto-injected | {} | console + network telemetry",
        if reload { "live reload" } else { "no reload" }
    ))
}

pub fn print_server_urls(host: Option<&str>, port: u16, path: &str) {
    for address in server_urls(host, port, path) {
        println!("  -> {address}");
    }
}

pub fn warn_about_exposed_host(host: Option<&str>) {
    if let Some(host) = host.filter(|host| !is_loopback_host(host)) {
        logger::warn(&exposed_host_warning(host));
    }
}

pub fn warn_about_allowed_hosts(allowed_hosts: &[String]) {
    if !allowed_hosts.is_empty() {
        logger::warn(&allowed_hosts_warning(allowed_hosts));
    }
}

pub fn bind(host: Option<&str>, port: u16) -> Result<TcpListener> {
    let hostname = listen_hostname(host);
    let address = if hostname.contains(':') {
        format!("[{hostname}]:{port}")
    } else {
        format!("{hostname}:{port}")
    };
    TcpListener::bind(&address)
        .map_err(|error| anyhow::anyhow!("cannot listen on {address} - {error}"))
}

pub fn warn_missing_dependencies(app: &App) {
    for alias in &app.missing_dependencies {
        logger::warn(&format!(
            "dependency '{alias}' is declared but not vendored - run 'imp install'"
        ));
    }
}

pub fn start(options: StartOptions) -> Result<()> {
    let entry_path = match crate::entry::resolve_entry_path(&options.entry, "an HTML file") {
        Ok(path) => path,
        Err(error) => {
            logger::error(&error.to_string());
            std::process::exit(1);
        }
    };
    let app = Arc::new(load_app(
        &entry_path,
        AppOptions {
            env_alias: options.env.clone(),
            mocks: options.mocks,
            widget: Widget::ReviewAndThemeEditor,
        },
    )?);
    let port = options
        .port
        .or(app.dev_server_port)
        .unwrap_or(DEFAULT_DEV_SERVER_PORT);
    let dev_log = DevLog::create(&app.root, app.max_log_entries)?;
    let sink_log = dev_log.clone();
    let _sink = logger::add_sink(move |line| sink_log.write(line));
    warn_missing_dependencies(&app);
    if crate::entry::public_copy_of_entry(&app.root, &app.entry_name).is_some() {
        logger::warn(&format!(
            "public/{0} is ignored - {0} is served from the project root, and 'imp build' fails on the collision",
            app.entry_name
        ));
    }
    if let Some(mocks) = &app.mocks {
        mocks.refresh();
    }
    if let Some(declared) = &app.service_worker {
        report_service_worker(&app.worker.build(), declared);
    }
    let clients = Clients::default();
    let reload = options.reload;
    let broadcast = clients.clone();
    let _watcher = watch_for_changes(&app.root, move || {
        if reload {
            logger::debug("change detected -> reload");
            broadcast.broadcast("reload");
        } else {
            logger::debug("change detected -> no reload");
        }
    })?;
    let listener = bind(options.host.as_deref(), port)?;
    let bound = listener.local_addr()?.port();
    let mut handler = Handler::new(app.clone(), clients);
    handler.recent_log = Some(dev_log.clone());
    handler.hostnames = served_hostnames(options.host.as_deref(), &options.allowed_hosts);
    logger::info(&format!(
        "imp start serving {} from {}",
        app.entry_name,
        app.root.display()
    ));
    print_server_urls(options.host.as_deref(), bound, "/");
    warn_about_exposed_host(options.host.as_deref());
    warn_about_allowed_hosts(&options.allowed_hosts);
    println!("{}", dim("  logs -> imp logs (-f follows the session)"));
    println!("{}", reload_banner_line(reload));
    let handler = Arc::new(handler);
    crate::http_server::serve(listener, Arc::new(move |request| handler.handle(request)));
    dev_log.close();
    Ok(())
}

pub fn start_e2e_app(
    root: &Path,
    config: &Config,
    mocks: Option<bool>,
) -> Result<crate::test::E2eApp> {
    let entry = crate::config::get_str(config, &["test", "entry"]).unwrap_or("index.html");
    let entry_path = root.join(entry);
    if !entry_path.is_file() {
        anyhow::bail!(
            "e2e entry not found: {entry} - each *.spec.js runs against your served app; set \"test\": {{ \"entry\": \"<page>.html\" }} in imp.json if it is not index.html"
        );
    }
    let entry_root = entry_path.parent().unwrap_or(root).to_path_buf();
    let app = Arc::new(load_app_with(
        &entry_root,
        &crate::paths::file_name(&entry_path),
        config,
        AppOptions {
            mocks,
            ..AppOptions::default()
        },
    )?);
    warn_missing_dependencies(&app);
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let mock_server = app.mocks.is_some();
    let handler = Arc::new(Handler::new(app, Clients::default()));
    crate::http_server::spawn(listener, Arc::new(move |request| handler.handle(request)));
    Ok(crate::test::E2eApp {
        base_url: format!("http://127.0.0.1:{port}/"),
        mock_server,
        _server: Box::new(()),
    })
}
