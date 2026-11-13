use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

pub struct Request {
    pub method: String,
    pub target: String,
    pub path: String,
    pub query: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub peer: SocketAddr,
    pub local: SocketAddr,
}

impl Request {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.as_str())
    }

    pub fn json(&self) -> Option<serde_json::Value> {
        serde_json::from_slice(&self.body).ok()
    }

    pub fn host(&self) -> String {
        self.header("host").unwrap_or("").to_string()
    }

    pub fn query_param(&self, name: &str) -> Option<String> {
        self.query.split('&').find_map(|pair| {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            (key == name).then(|| percent_decode(value))
        })
    }
}

pub fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%'
            && index + 2 < bytes.len()
            && let Ok(byte) = u8::from_str_radix(&text[index + 1..index + 3], 16)
        {
            out.push(byte);
            index += 3;
            continue;
        }
        out.push(if bytes[index] == b'+' {
            b' '
        } else {
            bytes[index]
        });
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub type StreamWriter = Box<dyn FnOnce(&mut dyn Write) + Send>;

pub enum Body {
    Bytes(Vec<u8>),
    Stream(StreamWriter),
}

pub struct Response {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Body,
}

impl Response {
    pub fn new(status: u16, content_type: &str, body: impl Into<Vec<u8>>) -> Response {
        Response {
            status,
            headers: vec![("content-type".into(), content_type.into())],
            body: Body::Bytes(body.into()),
        }
    }

    pub fn text(status: u16, body: impl Into<String>) -> Response {
        Response::new(
            status,
            "text/plain; charset=utf-8",
            body.into().into_bytes(),
        )
    }

    pub fn json(status: u16, value: &serde_json::Value) -> Response {
        Response::new(
            status,
            "application/json",
            serde_json::to_vec(value).unwrap(),
        )
        .header("cache-control", "no-store")
    }

    pub fn empty(status: u16) -> Response {
        Response {
            status,
            headers: Vec::new(),
            body: Body::Bytes(Vec::new()),
        }
    }

    pub fn stream(content_type: &str, writer: StreamWriter) -> Response {
        Response {
            status: 200,
            headers: vec![("content-type".into(), content_type.into())],
            body: Body::Stream(writer),
        }
    }

    pub fn header(mut self, name: &str, value: &str) -> Response {
        self.headers
            .retain(|(key, _)| !key.eq_ignore_ascii_case(name));
        self.headers.push((name.to_string(), value.to_string()));
        self
    }

    pub fn get_header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

fn status_text(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        206 => "Partial Content",
        302 => "Found",
        304 => "Not Modified",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        421 => "Misdirected Request",
        500 => "Internal Server Error",
        _ => "OK",
    }
}

pub type Handler = Arc<dyn Fn(Request) -> Response + Send + Sync>;

fn read_request(
    reader: &mut BufReader<TcpStream>,
    peer: SocketAddr,
    local: SocketAddr,
) -> Option<Request> {
    let mut line = String::new();
    loop {
        line.clear();
        if reader.read_line(&mut line).ok()? == 0 {
            return None;
        }
        if !line.trim().is_empty() {
            break;
        }
    }
    let mut parts = line.trim_end().splitn(3, ' ');
    let method = parts.next()?.to_string();
    let target = parts.next()?.to_string();
    let mut headers = Vec::new();
    let mut total = 0;
    loop {
        let mut header = String::new();
        let read = reader.read_line(&mut header).ok()?;
        total += read;
        if read == 0 || total > 64 * 1024 {
            return None;
        }
        let header = header.trim_end();
        if header.is_empty() {
            break;
        }
        if let Some((name, value)) = header.split_once(':') {
            headers.push((name.trim().to_ascii_lowercase(), value.trim().to_string()));
        }
    }
    let length: usize = headers
        .iter()
        .find(|(name, _)| name == "content-length")
        .and_then(|(_, value)| value.parse().ok())
        .unwrap_or(0);
    let mut body = vec![0; length];
    reader.read_exact(&mut body).ok()?;
    let (raw_path, query) = target.split_once('?').unwrap_or((&target, ""));
    let path = if raw_path.starts_with("http://") || raw_path.starts_with("https://") {
        raw_path
            .splitn(4, '/')
            .nth(3)
            .map(|rest| format!("/{rest}"))
            .unwrap_or_else(|| "/".into())
    } else {
        raw_path.to_string()
    };
    Some(Request {
        method,
        path,
        query: query.to_string(),
        target: target.clone(),
        headers,
        body,
        peer,
        local,
    })
}

fn write_response(
    stream: &mut TcpStream,
    response: Response,
    keep_alive: bool,
    head_only: bool,
) -> std::io::Result<bool> {
    let mut head = format!(
        "HTTP/1.1 {} {}\r\n",
        response.status,
        status_text(response.status)
    );
    for (name, value) in &response.headers {
        head.push_str(&format!("{name}: {value}\r\n"));
    }
    match response.body {
        Body::Bytes(bytes) => {
            head.push_str(&format!("content-length: {}\r\n", bytes.len()));
            head.push_str(if keep_alive {
                "connection: keep-alive\r\n\r\n"
            } else {
                "connection: close\r\n\r\n"
            });
            stream.write_all(head.as_bytes())?;
            if !head_only {
                stream.write_all(&bytes)?;
            }
            stream.flush()?;
            Ok(keep_alive)
        }
        Body::Stream(writer) => {
            head.push_str("connection: close\r\n\r\n");
            stream.write_all(head.as_bytes())?;
            stream.flush()?;
            writer(stream);
            Ok(false)
        }
    }
}

fn handle_connection(stream: TcpStream, handler: Handler) {
    let Ok(peer) = stream.peer_addr() else { return };
    let Ok(local) = stream.local_addr() else {
        return;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(120)));
    let _ = stream.set_nodelay(true);
    let Ok(writer) = stream.try_clone() else {
        return;
    };
    let mut writer = writer;
    let mut reader = BufReader::new(stream);
    while let Some(request) = read_request(&mut reader, peer, local) {
        let keep_alive = !request
            .header("connection")
            .is_some_and(|value| value.eq_ignore_ascii_case("close"));
        let head_only = request.method == "HEAD";
        let response = handler(request);
        match write_response(&mut writer, response, keep_alive, head_only) {
            Ok(true) => continue,
            _ => break,
        }
    }
}

pub fn serve(listener: TcpListener, handler: Handler) {
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let handler = handler.clone();
        std::thread::spawn(move || handle_connection(stream, handler));
    }
}

#[must_use]
pub struct Server {
    address: Option<SocketAddr>,
    stopped: Arc<AtomicBool>,
}

impl Drop for Server {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Relaxed);
        if let Some(address) = self.address {
            let _ = TcpStream::connect(address);
        }
    }
}

pub fn spawn(listener: TcpListener, handler: Handler) -> Server {
    let stopped = Arc::new(AtomicBool::new(false));
    let server = Server {
        address: listener.local_addr().ok(),
        stopped: stopped.clone(),
    };
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            if stopped.load(Ordering::Relaxed) {
                return;
            }
            let Ok(stream) = stream else { continue };
            let handler = handler.clone();
            std::thread::spawn(move || handle_connection(stream, handler));
        }
    });
    server
}

pub fn content_type(path: &str) -> &'static str {
    let extension = path
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default();
    match extension.as_str() {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "wasm" => "application/wasm",
        "txt" | "md" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

pub fn percent_decode_strict(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = text.get(index + 1..index + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
            continue;
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(out).ok()
}
