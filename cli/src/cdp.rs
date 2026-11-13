use anyhow::{Result, anyhow, bail};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{Sender, channel};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const HANDSHAKE_KEY: &str = "aW1wIHRlc3QgcnVubmVyIQ==";
const REPLY_TIMEOUT: Duration = Duration::from_secs(30);
const MASK: [u8; 4] = [0; 4];
const OPCODE_CONTINUATION: u8 = 0x0;
const OPCODE_TEXT: u8 = 0x1;
const OPCODE_CLOSE: u8 = 0x8;
const OPCODE_PING: u8 = 0x9;
const OPCODE_PONG: u8 = 0xA;

type Pending = Arc<Mutex<HashMap<u64, Sender<Value>>>>;

pub struct Cdp {
    writer: Arc<Mutex<TcpStream>>,
    next_id: AtomicU64,
    pending: Pending,
    crashed: Arc<Mutex<HashSet<String>>>,
    closed: Arc<AtomicBool>,
}

fn write_frame(stream: &Mutex<TcpStream>, opcode: u8, payload: &[u8]) -> Result<()> {
    let mut frame = vec![0x80 | opcode];
    match payload.len() {
        length if length < 126 => frame.push(0x80 | length as u8),
        length if length <= usize::from(u16::MAX) => {
            frame.push(0x80 | 126);
            frame.extend((length as u16).to_be_bytes());
        }
        length => {
            frame.push(0x80 | 127);
            frame.extend((length as u64).to_be_bytes());
        }
    }
    frame.extend(MASK);
    frame.extend(payload);
    stream.lock().unwrap().write_all(&frame)?;
    Ok(())
}

fn read_frame(reader: &mut impl Read) -> Result<(bool, u8, Vec<u8>)> {
    let mut head = [0u8; 2];
    reader.read_exact(&mut head)?;
    let length = match head[1] & 0x7F {
        126 => {
            let mut bytes = [0u8; 2];
            reader.read_exact(&mut bytes)?;
            u64::from(u16::from_be_bytes(bytes))
        }
        127 => {
            let mut bytes = [0u8; 8];
            reader.read_exact(&mut bytes)?;
            u64::from_be_bytes(bytes)
        }
        short => u64::from(short),
    };
    let mut payload = vec![0u8; usize::try_from(length)?];
    reader.read_exact(&mut payload)?;
    Ok((head[0] & 0x80 != 0, head[0] & 0x0F, payload))
}

fn read_message(reader: &mut impl Read, writer: &Mutex<TcpStream>) -> Result<Option<Value>> {
    let mut message = Vec::new();
    loop {
        let (last, opcode, payload) = read_frame(reader)?;
        match opcode {
            OPCODE_CLOSE => return Ok(None),
            OPCODE_PING => write_frame(writer, OPCODE_PONG, &payload)?,
            OPCODE_TEXT | OPCODE_CONTINUATION => {
                message.extend(payload);
                if last {
                    return Ok(Some(serde_json::from_slice(&message)?));
                }
            }
            _ => {}
        }
    }
}

fn open_socket(endpoint: &str) -> Result<(TcpStream, BufReader<TcpStream>)> {
    let address = endpoint
        .strip_prefix("ws://")
        .ok_or_else(|| anyhow!("the browser gave an unknown DevTools address: {endpoint}"))?;
    let (host, path) = address.split_once('/').unwrap_or((address, ""));
    let mut stream = TcpStream::connect(host)?;
    stream.set_nodelay(true)?;
    write!(
        stream,
        "GET /{path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {HANDSHAKE_KEY}\r\nSec-WebSocket-Version: 13\r\n\r\n"
    )?;
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut status = String::new();
    reader.read_line(&mut status)?;
    if !status.starts_with("HTTP/1.1 101") {
        bail!(
            "the browser refused the DevTools connection: {}",
            status.trim()
        );
    }
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header)? == 0 || header == "\r\n" {
            return Ok((stream, reader));
        }
    }
}

fn dispatch(message: Value, pending: &Pending, crashed: &Mutex<HashSet<String>>) {
    if let Some(id) = message.get("id").and_then(Value::as_u64) {
        if let Some(reply) = pending.lock().unwrap().remove(&id) {
            let _ = reply.send(message);
        }
        return;
    }
    if message.get("method").and_then(Value::as_str) == Some("Target.targetCrashed")
        && let Some(target) = message.pointer("/params/targetId").and_then(Value::as_str)
    {
        crashed.lock().unwrap().insert(target.to_string());
    }
}

impl Cdp {
    pub fn connect(endpoint: &str) -> Result<Cdp> {
        let (stream, mut reader) = open_socket(endpoint)?;
        let writer = Arc::new(Mutex::new(stream));
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let crashed = Arc::new(Mutex::new(HashSet::new()));
        let closed = Arc::new(AtomicBool::new(false));
        let (reader_writer, reader_pending, reader_crashed, reader_closed) = (
            writer.clone(),
            pending.clone(),
            crashed.clone(),
            closed.clone(),
        );
        std::thread::spawn(move || {
            while let Ok(Some(message)) = read_message(&mut reader, &reader_writer) {
                dispatch(message, &reader_pending, &reader_crashed);
            }
            reader_closed.store(true, Ordering::Relaxed);
            reader_pending.lock().unwrap().clear();
        });
        let cdp = Cdp {
            writer,
            next_id: AtomicU64::new(1),
            pending,
            crashed,
            closed,
        };
        cdp.call(
            None,
            "Target.setDiscoverTargets",
            json!({ "discover": true }),
        )?;
        Ok(cdp)
    }

    pub fn call(&self, session: Option<&str>, method: &str, params: Value) -> Result<Value> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let mut message = json!({ "id": id, "method": method, "params": params });
        if let Some(session) = session {
            message["sessionId"] = json!(session);
        }
        let (reply, replies) = channel();
        self.pending.lock().unwrap().insert(id, reply);
        if self.closed.load(Ordering::Relaxed) {
            self.pending.lock().unwrap().remove(&id);
            bail!("the browser closed the DevTools connection");
        }
        write_frame(&self.writer, OPCODE_TEXT, message.to_string().as_bytes())?;
        let answer = replies
            .recv_timeout(REPLY_TIMEOUT)
            .map_err(|_| anyhow!("the browser did not answer {method}"))?;
        if let Some(error) = answer.get("error") {
            bail!(
                "the browser rejected {method}: {}",
                error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown error")
            );
        }
        Ok(answer.get("result").cloned().unwrap_or(Value::Null))
    }

    pub fn crashed(&self, target: &str) -> bool {
        self.crashed.lock().unwrap().contains(target)
    }
}
