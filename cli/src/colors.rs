use std::io::IsTerminal;
use std::sync::OnceLock;

fn enabled() -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    *ENABLED.get_or_init(|| {
        std::env::var_os("NO_COLOR").is_none_or(|value| value.is_empty())
            && std::io::stdout().is_terminal()
    })
}

fn wrap(code: u8, text: impl std::fmt::Display) -> String {
    if enabled() {
        format!("\x1b[{code}m{text}\x1b[0m")
    } else {
        text.to_string()
    }
}

pub fn red(text: impl std::fmt::Display) -> String {
    wrap(31, text)
}
pub fn green(text: impl std::fmt::Display) -> String {
    wrap(32, text)
}
pub fn yellow(text: impl std::fmt::Display) -> String {
    wrap(33, text)
}
pub fn blue(text: impl std::fmt::Display) -> String {
    wrap(34, text)
}
pub fn magenta(text: impl std::fmt::Display) -> String {
    wrap(35, text)
}
pub fn cyan(text: impl std::fmt::Display) -> String {
    wrap(36, text)
}
pub fn bold(text: impl std::fmt::Display) -> String {
    wrap(1, text)
}
pub fn dim(text: impl std::fmt::Display) -> String {
    wrap(2, text)
}

pub fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(char) = chars.next() {
        if char == '\x1b' && chars.peek() == Some(&'[') {
            chars.next();
            for next in chars.by_ref() {
                if next.is_ascii_alphabetic() {
                    break;
                }
            }
            continue;
        }
        out.push(char);
    }
    out
}
