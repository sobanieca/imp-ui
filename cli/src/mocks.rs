use crate::bundler::{Assets, Format, ImpLibrary, Options, VirtualModule, bundle};
use crate::http_server::Response;
use crate::logger;
use crate::paths::posix;
use crate::script_engine::{install_console, message_of, run_jobs};
use crate::service_worker::stamp_of;
use rquickjs::function::Opt;
use rquickjs::{Context, Ctx, Function, Object, Persistent, Runtime, Value};
use serde_json::Value as Json;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const MOCK_ENDPOINT: &str = "/@imp/mock";
const MOCK_VERDICT_HEADER: &str = "x-imp-mock";
const SKIPPED_DIRECTORIES: [&str; 4] = [".git", "node_modules", "dist", ".imp"];
const ENTRY_ID: &str = "imp-mocks-entry";
const MISSING_FOLDER: &str = "missing";
const NO_FILES: &str = "none";

pub struct MockState {
    pub files: Vec<PathBuf>,
    pub entries: Vec<String>,
    pub problems: Vec<String>,
}

#[derive(Clone, Default)]
struct Loaded {
    key: Option<String>,
    inputs: Vec<PathBuf>,
    files: Vec<PathBuf>,
    entries: Vec<String>,
    problems: Vec<String>,
    engine: Option<Arc<Engine>>,
}

pub struct Mocks {
    root: PathBuf,
    directory: PathBuf,
    dependencies: Vec<String>,
    current: Mutex<Loaded>,
    loading: Mutex<()>,
    on_change: Box<dyn Fn(&MockState) + Send + Sync>,
}

fn find_mock_files(directory: &Path) -> std::io::Result<Vec<PathBuf>> {
    fn walk(current: &Path, found: &mut Vec<PathBuf>) -> std::io::Result<()> {
        for entry in std::fs::read_dir(current)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let kind = entry.file_type()?;
            if kind.is_dir() {
                if !SKIPPED_DIRECTORIES.contains(&name.as_str()) {
                    walk(&entry.path(), found)?;
                }
            } else if kind.is_file() && crate::project_files::is_mock_file(&name) {
                found.push(entry.path());
            }
        }
        Ok(())
    }
    let mut found = Vec::new();
    walk(directory, &mut found)?;
    found.sort();
    Ok(found)
}

fn entry_source(files: &[PathBuf]) -> String {
    let mut lines: Vec<String> = files
        .iter()
        .enumerate()
        .map(|(index, file)| {
            format!(
                "import * as mockFile{index} from {}",
                serde_json::to_string(&file.to_string_lossy()).unwrap()
            )
        })
        .collect();
    let names: Vec<String> = (0..files.len())
        .map(|index| format!("mockFile{index}"))
        .collect();
    lines.push(format!(
        "globalThis.__impMockModules = [{}]",
        names.join(", ")
    ));
    lines.join("\n")
}

fn bundle_mock_files(
    root: &Path,
    files: &[PathBuf],
    dependencies: &[String],
) -> Result<(String, Vec<PathBuf>), (String, Vec<PathBuf>)> {
    let mut options = Options::new(root);
    options.virtual_modules.insert(
        ENTRY_ID.into(),
        VirtualModule {
            code: entry_source(files),
            resolve_dir: root.to_path_buf(),
        },
    );
    options.entries.push((None, ENTRY_ID.into()));
    options.dependencies = dependencies.to_vec();
    options.imp = ImpLibrary::Tooling;
    options.format = Format::Iife;
    options.assets = Assets::DataUrl;
    match bundle(options) {
        Ok(bundled) => Ok((bundled.entry_code().to_string(), bundled.file_inputs())),
        Err(error) => {
            let failing = error
                .problems
                .iter()
                .filter_map(|problem| problem.file.as_ref())
                .map(|file| root.join(file.split(':').next().unwrap_or(file)))
                .filter(|path| path.is_file())
                .collect();
            Err((error.describe(), failing))
        }
    }
}

fn verdict_header(verdict: &Json) -> String {
    crate::service_worker::encode_uri_component(&verdict.to_string())
}

fn unanswered() -> Response {
    Response::empty(204).header("cache-control", "no-store")
}

impl Mocks {
    pub fn new(
        root: &Path,
        directory: &Path,
        dependencies: Vec<String>,
        on_change: impl Fn(&MockState) + Send + Sync + 'static,
    ) -> Mocks {
        Mocks {
            root: root.to_path_buf(),
            directory: directory.to_path_buf(),
            dependencies,
            current: Mutex::new(Loaded::default()),
            loading: Mutex::new(()),
            on_change: Box::new(on_change),
        }
    }

    fn settle(&self, next: Loaded) -> Loaded {
        let mut current = self.current.lock().unwrap();
        let changed = current.key != next.key;
        *current = next.clone();
        drop(current);
        if changed {
            (self.on_change)(&MockState {
                files: next.files.clone(),
                entries: next.entries.clone(),
                problems: next.problems.clone(),
            });
        }
        next
    }

    fn snapshot(&self) -> Loaded {
        self.current.lock().unwrap().clone()
    }

    pub fn refresh(&self) {
        self.load();
    }

    fn load(&self) -> Loaded {
        let _loading = self.loading.lock().unwrap();
        let current = self.snapshot();
        let files = match find_mock_files(&self.directory) {
            Ok(files) => files,
            Err(_) => {
                return self.settle(Loaded {
                    key: Some(MISSING_FOLDER.into()),
                    problems: vec![format!(
                        "{}/ does not exist",
                        posix(
                            self.directory
                                .strip_prefix(&self.root)
                                .unwrap_or(&self.directory)
                        )
                    )],
                    ..Loaded::default()
                });
            }
        };
        if files.is_empty() {
            if current.key.as_deref() == Some(NO_FILES) {
                return current;
            }
            return self.settle(Loaded {
                key: Some(NO_FILES.into()),
                ..Loaded::default()
            });
        }
        let watched = |inputs: &[PathBuf]| {
            let mut all: Vec<PathBuf> = files.iter().chain(inputs).cloned().collect();
            all.sort();
            all.dedup();
            all
        };
        let mut known = current.inputs.clone();
        loop {
            let before = stamp_of(&watched(&known));
            if current.key.as_deref() == Some(before.as_str()) && current.engine_alive() {
                return current;
            }
            let bundled = bundle_mock_files(&self.root, &files, &self.dependencies);
            let inputs = match &bundled {
                Ok((_, inputs)) => inputs.clone(),
                Err((_, failing)) => watched(&[known.clone(), failing.clone()].concat()),
            };
            let after = stamp_of(&watched(&inputs));
            if after != before {
                known = inputs;
                continue;
            }
            let relative: Vec<String> = files
                .iter()
                .map(|file| posix(file.strip_prefix(&self.root).unwrap_or(file)))
                .collect();
            let loaded = match bundled {
                Ok((source, _)) => match Engine::start(source, relative) {
                    Ok((engine, entries, problems)) => Loaded {
                        engine: (!entries.is_empty()).then(|| Arc::new(engine)),
                        entries,
                        problems,
                        ..Loaded::default()
                    },
                    Err(failure) => Loaded {
                        problems: vec![format!("evaluation failed - {failure}")],
                        ..Loaded::default()
                    },
                },
                Err((problem, _)) => Loaded {
                    problems: vec![problem],
                    ..Loaded::default()
                },
            };
            return self.settle(Loaded {
                key: Some(after),
                inputs,
                files: files.clone(),
                ..loaded
            });
        }
    }

    pub fn answer(&self, body: &[u8]) -> Response {
        let Ok(description) = serde_json::from_slice::<Json>(body) else {
            return Response::text(400, "mocks - the request description could not be read");
        };
        let loaded = self.load();
        let Some(engine) = loaded.engine else {
            return unanswered();
        };
        let reply = engine.answer(&description);
        let reply = match reply {
            Err(failure) => {
                let verdict = serde_json::json!({ "source": "mocks", "error": failure });
                return Response::empty(200)
                    .header(MOCK_VERDICT_HEADER, &verdict_header(&verdict))
                    .header("cache-control", "no-store");
            }
            Ok(reply) => reply,
        };
        let Some(verdict) = reply.get("verdict").filter(|verdict| !verdict.is_null()) else {
            return unanswered();
        };
        let bytes: Vec<u8> = match reply.get("body") {
            Some(Json::Object(body)) => match (body.get("text"), body.get("bytes")) {
                (Some(Json::String(text)), _) => text.clone().into_bytes(),
                (_, Some(Json::Array(bytes))) => bytes
                    .iter()
                    .map(|byte| byte.as_u64().unwrap_or(0) as u8)
                    .collect(),
                _ => Vec::new(),
            },
            _ => Vec::new(),
        };
        Response::new(200, "application/octet-stream", bytes)
            .header(MOCK_VERDICT_HEADER, &verdict_header(verdict))
            .header("cache-control", "no-store")
    }
}

impl Loaded {
    fn engine_alive(&self) -> bool {
        self.engine
            .as_ref()
            .is_none_or(|engine| !engine.stopped.load(Ordering::SeqCst))
    }
}

type Reply = Result<Json, String>;

struct Request {
    description: String,
    reply: mpsc::Sender<Reply>,
}

struct Engine {
    sender: Mutex<mpsc::Sender<Request>>,
    stopped: Arc<AtomicBool>,
}

#[derive(Default)]
struct Timers {
    next_id: u32,
    due: BTreeMap<(Instant, u32), Persistent<Function<'static>>>,
}

#[derive(Default)]
struct Shared {
    timers: Timers,
    replies: HashMap<u32, mpsc::Sender<Reply>>,
    problems: Vec<String>,
}

fn install_globals(ctx: &Ctx<'_>, shared: &Rc<RefCell<Shared>>) -> rquickjs::Result<()> {
    let globals = ctx.globals();
    let timers = shared.clone();
    globals.set(
        "setTimeout",
        Function::new(
            ctx.clone(),
            move |callback: Function<'_>, delay: Opt<f64>| {
                let ctx = callback.ctx().clone();
                let mut shared = timers.borrow_mut();
                shared.timers.next_id += 1;
                let id = shared.timers.next_id;
                let wait = delay.0.unwrap_or(0.0).max(0.0);
                let at = Instant::now() + Duration::from_secs_f64(wait / 1000.0);
                shared
                    .timers
                    .due
                    .insert((at, id), Persistent::save(&ctx, callback));
                id
            },
        )?,
    )?;
    let timers = shared.clone();
    globals.set(
        "clearTimeout",
        Function::new(ctx.clone(), move |id: Opt<u32>| {
            if let Some(id) = id.0 {
                timers
                    .borrow_mut()
                    .timers
                    .due
                    .retain(|(_, timer), _| *timer != id);
            }
        })?,
    )?;
    install_console(ctx, "mocks - ")?;
    Ok(())
}

impl Engine {
    fn start(
        source: String,
        files: Vec<String>,
    ) -> Result<(Engine, Vec<String>, Vec<String>), String> {
        let (sender, receiver) = mpsc::channel::<Request>();
        let (ready_sender, ready) = mpsc::channel();
        let stopped = Arc::new(AtomicBool::new(false));
        let stopped_flag = stopped.clone();
        std::thread::spawn(move || {
            let shared = Rc::new(RefCell::new(Shared::default()));
            let started =
                (|| -> Result<(Runtime, Context, Persistent<Function<'static>>), String> {
                    let runtime = Runtime::new().map_err(|error| error.to_string())?;
                    let context = Context::full(&runtime).map_err(|error| error.to_string())?;
                    let answer = context.with(|ctx| -> Result<_, String> {
                        install_globals(&ctx, &shared).map_err(|error| message_of(&ctx, error))?;
                        ctx.eval::<(), _>(source.as_str())
                            .map_err(|error| message_of(&ctx, error))?;
                        let input =
                            Object::new(ctx.clone()).map_err(|error| message_of(&ctx, error))?;
                        let modules: Value = ctx
                            .globals()
                            .get("__impMockModules")
                            .map_err(|error| message_of(&ctx, error))?;
                        input
                            .set("modules", modules)
                            .map_err(|error| message_of(&ctx, error))?;
                        input
                            .set("files", files.clone())
                            .map_err(|error| message_of(&ctx, error))?;
                        let replies = shared.clone();
                        input
                            .set(
                                "reply",
                                Function::new(ctx.clone(), move |id: u32, text: String| {
                                    if let Some(reply) = replies.borrow_mut().replies.remove(&id) {
                                        let parsed = serde_json::from_str(&text)
                                            .map_err(|error| error.to_string());
                                        let _ = reply.send(parsed);
                                    }
                                }),
                            )
                            .map_err(|error| message_of(&ctx, error))?;
                        let problems = shared.clone();
                        input
                            .set(
                                "report",
                                Function::new(ctx.clone(), move |text: String| {
                                    problems.borrow_mut().problems.push(text);
                                }),
                            )
                            .map_err(|error| message_of(&ctx, error))?;
                        let runtime_source = format!(
                            "({})",
                            crate::browser_script::function_source("mock-runtime.js")
                        );
                        let create: Function = ctx
                            .eval(runtime_source.as_str())
                            .map_err(|error| message_of(&ctx, error))?;
                        let created: Object = create
                            .call((input,))
                            .map_err(|error| message_of(&ctx, error))?;
                        let sources: Vec<String> = created
                            .get("sources")
                            .map_err(|error| message_of(&ctx, error))?;
                        let problems: Vec<String> = created
                            .get("problems")
                            .map_err(|error| message_of(&ctx, error))?;
                        let answer: Function = created
                            .get("answer")
                            .map_err(|error| message_of(&ctx, error))?;
                        Ok((sources, problems, Persistent::save(&ctx, answer)))
                    });
                    let (sources, problems, answer) = answer?;
                    run_jobs(&runtime)?;
                    let _ = ready_sender.send(Ok((sources, problems)));
                    Ok((runtime, context, answer))
                })();
            let (runtime, context, answer) = match started {
                Ok(started) => started,
                Err(failure) => {
                    let _ = ready_sender.send(Err(failure));
                    return;
                }
            };
            let mut next_request = 0u32;
            let stop = |failure: String| {
                logger::error(&format!("mocks - {failure}"));
                stopped_flag.store(true, Ordering::SeqCst);
                for (_, reply) in shared.borrow_mut().replies.drain() {
                    let _ = reply.send(Err(failure.clone()));
                }
            };
            loop {
                for problem in std::mem::take(&mut shared.borrow_mut().problems) {
                    logger::error(&format!("mocks - {problem}"));
                }
                let deadline = shared.borrow().timers.due.keys().next().map(|(at, _)| *at);
                let received = match deadline {
                    Some(at) => receiver.recv_timeout(at.saturating_duration_since(Instant::now())),
                    None => receiver.recv().map_err(|_| RecvTimeoutError::Disconnected),
                };
                let outcome = match received {
                    Ok(request) => {
                        next_request += 1;
                        let id = next_request;
                        shared.borrow_mut().replies.insert(id, request.reply);
                        context.with(|ctx| {
                            let answer = answer
                                .clone()
                                .restore(&ctx)
                                .map_err(|error| error.to_string())?;
                            answer
                                .call::<_, Value>((id, request.description))
                                .map(|_| ())
                                .map_err(|error| message_of(&ctx, error))
                        })
                    }
                    Err(RecvTimeoutError::Timeout) => {
                        let now = Instant::now();
                        let due: Vec<_> = {
                            let mut shared = shared.borrow_mut();
                            let ready: Vec<(Instant, u32)> = shared
                                .timers
                                .due
                                .keys()
                                .filter(|(at, _)| *at <= now)
                                .cloned()
                                .collect();
                            ready
                                .into_iter()
                                .filter_map(|key| shared.timers.due.remove(&key))
                                .collect()
                        };
                        context.with(|ctx| {
                            for callback in due {
                                let callback =
                                    callback.restore(&ctx).map_err(|error| error.to_string())?;
                                callback
                                    .call::<_, Value>(())
                                    .map_err(|error| message_of(&ctx, error))?;
                            }
                            Ok(())
                        })
                    }
                    Err(RecvTimeoutError::Disconnected) => return,
                };
                if let Err(failure) = outcome.and_then(|_| run_jobs(&runtime)) {
                    stop(failure);
                    return;
                }
            }
        });
        match ready.recv() {
            Ok(Ok((sources, problems))) => Ok((
                Engine {
                    sender: Mutex::new(sender),
                    stopped,
                },
                sources,
                problems,
            )),
            Ok(Err(failure)) => Err(failure),
            Err(_) => Err("the mocks stopped".into()),
        }
    }

    fn answer(&self, description: &Json) -> Reply {
        if self.stopped.load(Ordering::SeqCst) {
            return Err("the mocks stopped".into());
        }
        let (reply, receiver) = mpsc::channel();
        let request = Request {
            description: description.to_string(),
            reply,
        };
        if self.sender.lock().unwrap().send(request).is_err() {
            return Err("the mocks stopped".into());
        }
        receiver
            .recv()
            .unwrap_or_else(|_| Err("the mocks stopped".into()))
    }
}
