use rquickjs::{Context, Function, Runtime};

const PRELUDE: &str = r#"
const lower = (name) => String(name).toLowerCase()
globalThis.Headers = class Headers {
  constructor(init) {
    this.map = new Map()
    const entries = init instanceof Headers ? [...init.map] : Array.isArray(init) ? init : Object.entries(init || {})
    for (const [name, value] of entries) this.map.set(lower(name), String(value))
  }
  get(name) { return this.map.get(lower(name)) ?? null }
  has(name) { return this.map.has(lower(name)) }
  set(name, value) { this.map.set(lower(name), String(value)) }
  entries() { return this.map.entries() }
  [Symbol.iterator]() { return this.map[Symbol.iterator]() }
}
globalThis.URLSearchParams = class URLSearchParams {
  constructor(search = '') {
    this.list = String(search).replace(/^\?/, '').split('&').filter(Boolean).map((pair) => {
      const [name, value = ''] = pair.split('=')
      return [decodeURIComponent(name), decodeURIComponent(value)]
    })
  }
  entries() { return this.list[Symbol.iterator]() }
  [Symbol.iterator]() { return this.list[Symbol.iterator]() }
}
globalThis.URL = class URL {
  constructor(url, base) {
    const absolute = /^[a-z]+:/.test(url) ? url : `${String(base).replace(/\/$/, '')}${url}`
    const [, origin, path = '/', search = ''] = /^([a-z]+:\/\/[^/?#]+)([^?#]*)(\?[^#]*)?/.exec(absolute)
    this.href = absolute
    this.origin = origin
    this.pathname = path || '/'
    this.search = search
    this.searchParams = new URLSearchParams(search)
  }
}
globalThis.Response = class Response {
  constructor(body = null, init = {}) {
    this.text_ = body === null || body === undefined ? '' : String(body)
    this.body = body
    this.status = init.status ?? 200
    this.statusText = init.statusText ?? ''
    this.headers = new Headers(init.headers)
    this.ok = this.status >= 200 && this.status < 300
    this.type = 'default'
  }
  text() { return Promise.resolve(this.text_) }
  json() { return Promise.resolve(JSON.parse(this.text_)) }
  clone() { return new Response(this.text_, this) }
}
globalThis.Request = class Request {
  constructor(url, init = {}) {
    this.url = url
    this.method = init.method ?? 'GET'
    this.headers = new Headers(init.headers)
    this.body_ = init.body ?? ''
    this.destination = init.destination ?? ''
  }
  clone() { return new Request(this.url, { method: this.method, headers: this.headers, body: this.body_, destination: this.destination }) }
  text() { return Promise.resolve(this.body_) }
}
const timers = []
globalThis.setTimeout = (callback) => { timers.push(callback); return timers.length }
globalThis.clearTimeout = () => {}
globalThis.__runTimers = () => { while (timers.length) timers.shift()() }
globalThis.console = { log() {}, info() {}, warn() {}, error() {}, debug() {} }
globalThis.__telemetry = []
globalThis.__network = (input, init = {}) => {
  const request = typeof input === 'string' ? new Request(input, init) : input
  const url = request.url
  if (url === '/@imp/log') {
    __telemetry.push(...JSON.parse(init.body ?? request.body_))
    return Promise.resolve(new Response('ok'))
  }
  if (url.startsWith('/')) {
    const headers = JSON.stringify([...new Headers(init.headers ?? request.headers)])
    const answer = JSON.parse(__http(request.method ?? init.method ?? 'GET', url, headers, init.body ?? request.body_ ?? ''))
    return Promise.resolve(new Response(answer.body, { status: answer.status, headers: answer.headers }))
  }
  return Promise.resolve(new Response('from the network', { headers: { 'content-type': 'text/plain' } }))
}
globalThis.__listeners = {}
globalThis.__scope = {
  addEventListener: (type, handler) => { __listeners[type] = handler },
  skipWaiting: () => {},
  clients: { claim: () => {}, get: () => Promise.resolve(null) },
  registration: { scope: 'http://app.test/' },
  location: new URL('http://app.test/sw.js'),
}
globalThis.__send = (path, method, body, contentType) => {
  globalThis.__answer = null
  let answered
  const headers = contentType ? { 'content-type': contentType } : {}
  __listeners.fetch({
    request: new Request(`http://app.test${path}`, { method, body: body || undefined, headers }),
    respondWith: (value) => answered = value,
  })
  Promise.resolve(answered).then(async (response) => {
    const type = response.headers.get('content-type') ?? '(none)'
    globalThis.__answer = `${response.status} ${type} ${await response.text()}`
  }, (error) => {
    globalThis.__answer = `rejected: ${error.message}`
  })
}
"#;

pub struct Worker {
    runtime: Runtime,
    context: Context,
}

fn http_call(port: u16, method: &str, url: &str, headers: &str, body: &str) -> String {
    let headers: Vec<(String, String)> = serde_json::from_str(headers).unwrap_or_default();
    let mut all: Vec<(&str, &str)> = headers
        .iter()
        .map(|(name, value)| (name.as_str(), value.as_str()))
        .collect();
    let origin = format!("http://localhost:{port}");
    all.push(("origin", &origin));
    let answer = super::http(port, method, url, &all, Some(body.as_bytes()));
    serde_json::json!({
        "status": answer.status,
        "headers": answer.headers,
        "body": answer.text(),
    })
    .to_string()
}

impl Worker {
    pub fn new(source: &str, port: Option<u16>) -> Worker {
        let runtime = Runtime::new().unwrap();
        let context = Context::full(&runtime).unwrap();
        context.with(|ctx| {
            let http = Function::new(ctx.clone(), move |method: String, url: String, headers: String, body: String| {
                match port {
                    Some(port) => http_call(port, &method, &url, &headers, &body),
                    None => serde_json::json!({ "status": 599, "headers": [], "body": "no server" }).to_string(),
                }
            })
            .unwrap();
            ctx.globals().set("__http", http).unwrap();
            ctx.eval::<(), _>(PRELUDE).unwrap();
            let run: Function = ctx
                .eval("(source) => new Function('self', 'fetch', 'globalThis', source)(__scope, __network, __scope)")
                .unwrap();
            if let Err(error) = run.call::<_, ()>((source,)) {
                panic!("the worker did not start: {error}: {:?}", ctx.catch());
            }
        });
        let worker = Worker { runtime, context };
        worker.pump();
        worker
    }

    fn pump(&self) {
        while self.runtime.execute_pending_job().unwrap_or(false) {}
    }

    fn eval(&self, code: &str) -> String {
        self.context.with(|ctx| {
            ctx.eval::<String, _>(code)
                .unwrap_or_else(|error| format!("({error})"))
        })
    }

    pub fn mock_endpoint(&self) -> String {
        self.eval("String(__scope.__IMP_MOCK_ENDPOINT__ ?? '(none)')")
    }

    pub fn listeners(&self) -> String {
        self.eval("Object.keys(__listeners).sort().join(', ')")
    }

    pub fn fixture(&self) -> String {
        self.eval("JSON.stringify(__scope.__fixture) ?? 'undefined'")
    }

    pub fn global(&self, name: &str) -> String {
        self.eval(&format!(
            "JSON.stringify(__scope[{}]) ?? 'undefined'",
            serde_json::to_string(name).unwrap()
        ))
    }

    pub fn send(
        &self,
        path: &str,
        method: &str,
        body: Option<&str>,
        content_type: Option<&str>,
    ) -> String {
        let started = std::time::Instant::now();
        self.context.with(|ctx| {
            let send: Function = ctx.globals().get("__send").unwrap();
            send.call::<_, ()>((path, method, body.unwrap_or(""), content_type.unwrap_or("")))
                .unwrap();
        });
        self.pump();
        let answer = self.eval("String(__answer)");
        let slow = if started.elapsed().as_millis() >= super::DECLARED_MOCK_DELAY {
            " after the declared delay"
        } else {
            ""
        };
        format!("{method} {path} -> {answer}{slow}")
    }

    pub fn telemetry(&self) -> Vec<String> {
        self.context.with(|ctx| {
            let _ = ctx.eval::<(), _>("__runTimers()");
        });
        self.pump();
        let lines = self.eval(
            "__telemetry.map((entry) => `${entry.type} ${entry.method} ${new URL(entry.url).pathname} -> ${entry.error ?? entry.status}${entry.mock ? ` (mock: ${entry.mock})` : ''}`).join('\\n')",
        );
        lines.lines().map(str::to_string).collect()
    }
}
