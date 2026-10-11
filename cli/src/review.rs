use crate::browser_script::browser_script;
use crate::colors::{bold, dim};
use crate::embedded;
use crate::logger;
use anyhow::{Result, bail};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

pub const REVIEW_ENDPOINT: &str = "/@imp/review";
const REVIEWS_FOLDER: &str = "reviews";
pub const REVIEW_LOG_LINES: usize = 20;
pub const TELEMETRY_ENTRIES: usize = 2000;
const BLOCK_LINE: usize = 600;
const MAX_COMMENT: usize = 20000;
pub const REPORT_MODULE: &str = "/@imp/report.js";
pub const THEME_EDITOR_MODULE: &str = "/@imp/theme-editor.js";
const WIDGET_SIZE: u32 = 40;
const WIDGET_MARGIN: u32 = 16;
const WIDGET_POSITION_KEY: &str = "imp-review-position";

pub fn imp_mark_svg(scheme: &str) -> String {
    let source = embedded::library_file("std/shared/imp-mark.js").expect("imp-mark.js is embedded");
    let start = source.find('`').expect("the mark literal") + 1;
    let end = start + source[start..].find('`').expect("the end of the mark literal");
    let ink = if scheme == "light" { "#101010" } else { "#ffffff" };
    source[start..end].replace("currentColor", ink)
}

pub fn read_widget_mark() -> String {
    imp_mark_svg("dark").replacen("<svg ", "<svg aria-hidden=\"true\" ", 1)
}

pub fn reviews_directory(root: &Path) -> PathBuf {
    root.join(".imp").join(REVIEWS_FOLDER)
}

pub fn review_display_path(name: &str) -> String {
    format!(".imp/{REVIEWS_FOLDER}/{name}")
}

pub fn review_file_name(iso: &str, attempt: usize) -> String {
    let base = iso.replace(':', "-").replacen('.', "-", 1);
    if attempt == 0 { format!("{base}.txt") } else { format!("{base}-{attempt}.txt") }
}

pub fn is_local_address(address: &std::net::SocketAddr) -> bool {
    match address.ip() {
        std::net::IpAddr::V4(ip) => ip.is_loopback(),
        std::net::IpAddr::V6(ip) => {
            ip.is_loopback() || ip.to_ipv4_mapped().is_some_and(|mapped| mapped.octets()[0] == 127)
        }
    }
}

fn strip_control(text: &str, keep_lines: bool) -> String {
    text.chars()
        .filter(|character| {
            let code = *character as u32;
            (code > 31 && code != 127) || (keep_lines && (*character == '\n' || *character == '\t'))
        })
        .collect()
}

fn js_string(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(items)) => items.iter().map(|item| js_string(Some(item))).collect::<Vec<_>>().join(","),
        Some(Value::Object(_)) => "[object Object]".to_string(),
        Some(other) => other.to_string(),
    }
}

fn utf16_prefix(text: &str, limit: usize) -> String {
    let mut count = 0;
    let mut out = String::new();
    for character in text.chars() {
        count += character.len_utf16();
        if count > limit {
            break;
        }
        out.push(character);
    }
    out
}

fn one_line(value: Option<&Value>, limit: usize) -> String {
    let stripped = strip_control(&js_string(value), false);
    let collapsed = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
    utf16_prefix(collapsed.trim(), limit)
}

fn comment_text(value: Option<&Value>) -> String {
    let text = js_string(value).replace("\r\n", "\n");
    utf16_prefix(strip_control(&text, true).trim(), MAX_COMMENT)
}

fn as_json(value: Option<&Value>) -> String {
    match value {
        None => "undefined".to_string(),
        Some(value) => serde_json::to_string(value).unwrap(),
    }
}

fn state_line(entry: &Value) -> String {
    if !entry.is_object() {
        return String::new();
    }
    format!("{} = {}", js_string(entry.get("name")), as_json(entry.get("value")))
}

fn truthy(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::Bool(flag)) => *flag,
        Some(Value::Number(number)) => number.as_f64().is_some_and(|number| number != 0.0),
        Some(Value::String(text)) => !text.is_empty(),
        Some(_) => true,
    }
}

fn control_line(entry: &Value) -> String {
    if !entry.is_object() {
        return String::new();
    }
    let shown = match entry.get("value") {
        None | Some(Value::Null) => format!("<{} characters, not recorded>", js_string(entry.get("length"))),
        Some(value) => serde_json::to_string(&Value::String(js_string(Some(value)))).unwrap(),
    };
    let flags: Vec<&str> = [
        truthy(entry.get("disabled")).then_some("disabled"),
        truthy(entry.get("readOnly")).then_some("read-only"),
    ]
    .into_iter()
    .flatten()
    .collect();
    let suffix = if flags.is_empty() { String::new() } else { format!(" ({})", flags.join(", ")) };
    format!("{} = {shown}{suffix}", js_string(entry.get("name")))
}

fn block_lines(value: Option<&Value>, most: usize, describe: impl Fn(&Value) -> String) -> Vec<String> {
    let items = value.and_then(Value::as_array).cloned().unwrap_or_default();
    items
        .iter()
        .take(most)
        .map(|entry| one_line(Some(&Value::String(describe(entry))), BLOCK_LINE))
        .filter(|line| !line.is_empty())
        .collect()
}

pub fn format_review(payload: &Value, at: &str, log: &[String]) -> String {
    let empty = json!({});
    let element = payload.get("element").filter(|value| value.is_object()).unwrap_or(&empty);
    let field = |label: &str, value: String| if value.is_empty() { String::new() } else { format!("{label}: {value}\n") };
    let block = |label: &str, lines: Vec<String>| {
        if lines.is_empty() {
            String::new()
        } else {
            format!("\n{label}:\n{}\n", lines.iter().map(|line| format!("  {line}")).collect::<Vec<_>>().join("\n"))
        }
    };
    let log_values: Vec<Value> = log.iter().map(|line| Value::String(line.clone())).collect();
    [
        field("time", at.to_string()),
        field("page", one_line(payload.get("page"), 2000)),
        field("title", one_line(payload.get("title"), 300)),
        field("viewport", one_line(payload.get("viewport"), 40)),
        field("scroll", one_line(payload.get("scroll"), 40)),
        field("scheme", one_line(payload.get("scheme"), 20)),
        field("motion", one_line(payload.get("motion"), 20)),
        field("lang", one_line(payload.get("lang"), 40)),
        field("dir", one_line(payload.get("dir"), 20)),
        field("element", one_line(element.get("path"), 500)),
        field("rect", one_line(element.get("rect"), 60)),
        field("text", one_line(element.get("text"), 500)),
        field("html", one_line(element.get("html"), 2000)),
        block("state", block_lines(payload.get("state"), 60, state_line)),
        block("controls", block_lines(payload.get("controls"), 60, control_line)),
        block("log", block_lines(Some(&Value::Array(log_values)), REVIEW_LOG_LINES, |line| js_string(Some(line)))),
        "\ncomment:\n".to_string(),
        comment_text(payload.get("comment")),
        "\n".to_string(),
    ]
    .concat()
}

pub fn write_review(root: &Path, payload: &Value, log: &[String]) -> Result<String> {
    if !payload.is_object() || comment_text(payload.get("comment")).is_empty() {
        bail!("a review needs a comment");
    }
    let directory = reviews_directory(root);
    std::fs::create_dir_all(&directory)?;
    let now = crate::time::iso_string(crate::time::now_millis());
    let contents = format_review(payload, &now, log);
    for attempt in 0..100 {
        let name = review_file_name(&now, attempt);
        match std::fs::OpenOptions::new().write(true).create_new(true).open(directory.join(&name)) {
            Ok(mut file) => {
                use std::io::Write;
                file.write_all(contents.as_bytes())?;
                return Ok(review_display_path(&name));
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    bail!("too many reviews written in the same millisecond")
}

struct Parsed {
    fields: Vec<(String, String)>,
    blocks: Vec<(String, Vec<String>)>,
    comment: String,
}

impl Parsed {
    fn field(&self, name: &str) -> Option<&str> {
        self.fields.iter().find(|(key, _)| key == name).map(|(_, value)| value.as_str())
    }
}

fn parse_review(contents: &str) -> Parsed {
    let separator = "\ncomment:\n";
    let (header, comment) = match contents.find(separator) {
        Some(index) => (&contents[..index], contents[index + separator.len()..].trim().to_string()),
        None => (contents, String::new()),
    };
    let mut fields: Vec<(String, String)> = Vec::new();
    let mut blocks: Vec<(String, Vec<String>)> = Vec::new();
    let mut open: Option<usize> = None;
    let is_word = |text: &str| !text.is_empty() && text.chars().all(|char| char.is_ascii_lowercase());
    for line in header.split('\n') {
        if let (Some(index), Some(rest)) = (open, line.strip_prefix("  ")) {
            blocks[index].1.push(rest.to_string());
            continue;
        }
        if let Some((key, value)) = line.split_once(": ") {
            if is_word(key) && !value.is_empty() {
                fields.retain(|(existing, _)| existing != key);
                fields.push((key.to_string(), value.to_string()));
                open = None;
                continue;
            }
        }
        if let Some(key) = line.strip_suffix(':') {
            if is_word(key) {
                blocks.retain(|(existing, _)| existing != key);
                blocks.push((key.to_string(), Vec::new()));
                open = Some(blocks.len() - 1);
                continue;
            }
        }
        open = None;
    }
    Parsed { fields, blocks, comment }
}

fn review_file_names(directory: &Path) -> Result<Vec<String>> {
    let entries = match std::fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.into()),
    };
    let mut names: Vec<String> = entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name.ends_with(".txt"))
        .collect();
    names.sort();
    Ok(names)
}

const NOTHING_YET: &str = "no reviews yet - serve the app with imp start or imp preview, press the imp mark on the page, press Add review, and pick the element you want to comment on";

fn count(total: usize) -> String {
    format!("{total} review{}", if total == 1 { "" } else { "s" })
}

pub fn review(root: &Path, args: &[String]) -> Result<()> {
    let subcommand = args.first();
    if let Some(subcommand) = subcommand {
        if subcommand != "clear" {
            bail!("unknown argument '{subcommand}' - imp review takes 'clear' or nothing");
        }
    }
    if let Some(extra) = args.get(1) {
        bail!("unexpected argument '{extra}' - imp review takes 'clear' or nothing");
    }
    let directory = reviews_directory(root);
    if subcommand.is_some() {
        let names = review_file_names(&directory)?;
        for name in &names {
            std::fs::remove_file(directory.join(name))?;
        }
        let _ = std::fs::remove_dir(&directory);
        if names.is_empty() {
            logger::info("no reviews to clear");
        } else {
            logger::info(&format!("cleared {} from .imp/reviews", count(names.len())));
        }
        return Ok(());
    }
    let names = review_file_names(&directory)?;
    if names.is_empty() {
        logger::info(NOTHING_YET);
        return Ok(());
    }
    for name in &names {
        let entry = parse_review(&std::fs::read_to_string(directory.join(name))?);
        println!("{}", bold(review_display_path(name)));
        let when: Vec<&str> = [entry.field("time"), entry.field("page")].into_iter().flatten().collect();
        println!("{}", dim(format!("  {}", when.join("  "))));
        if let Some(element) = entry.field("element") {
            println!("{}", dim(format!("  {element}")));
        }
        for line in entry.comment.split('\n') {
            println!("  {line}");
        }
        let recorded: Vec<String> = entry
            .blocks
            .iter()
            .filter(|(_, lines)| !lines.is_empty())
            .map(|(label, lines)| format!("{label} ({})", lines.len()))
            .collect();
        if !recorded.is_empty() {
            println!("{}", dim(format!("  also recorded: {}", recorded.join(", "))));
        }
        println!();
    }
    logger::info(&format!("{} in .imp/reviews - 'imp review clear' deletes them all", count(names.len())));
    Ok(())
}

fn icon(paths: &str) -> String {
    format!(
        "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">{paths}</svg>"
    )
}

fn widget_markup(mark: &str, theme_editor: bool) -> String {
    let theme_action = format!(
        "\n    <button type=\"button\" class=\"action\" data-action=\"theme\" aria-label=\"Theme editor\"\n      title=\"Theme editor\" aria-pressed=\"false\">{}</button>",
        icon(concat!(
            "<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\"/>",
            "<circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/>",
            "<circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"/>",
            "<circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"/>",
            "<circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>"
        ))
    );
    embedded::expect_text("cli/templates/review-widget.html")
        .replace("{{ICON_CLEAR}}", &icon(concat!(
            "<path d=\"M3 6h18\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/>",
            "<path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>",
            "<line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/>"
        )))
        .replace("{{ICON_REVIEW}}", &icon("<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z\"/>"))
        .replace("{{ICON_CONSOLE}}", &icon("<polyline points=\"4 17 10 11 4 5\"/><line x1=\"12\" y1=\"19\" x2=\"20\" y2=\"19\"/>"))
        .replace(
            "{{ICON_NETWORK}}",
            &icon("<path d=\"M17 3l4 4-4 4\"/><path d=\"M3 7h18\"/><path d=\"M7 21l-4-4 4-4\"/><path d=\"M21 17H3\"/>"),
        )
        .replace("{{THEME_ACTION}}", if theme_editor { &theme_action } else { "" })
        .replace("{{MARK}}", mark)
}

pub fn review_widget_script(mark: &str, theme_editor: bool) -> String {
    let log_views = json!({
        "console": {
            "title": "Console logs",
            "clear": "Clear console logs",
            "empty": "Nothing logged since the page loaded.",
            "cleared": "Cleared. The next line appears as it happens.",
            "filters": [{ "key": "level", "options": ["All", "Log", "Info", "Warn", "Error"], "initial": "All" }],
        },
        "network": {
            "title": "Network logs",
            "clear": "Clear network logs",
            "empty": "No requests since the page loaded.",
            "cleared": "Cleared. The next request appears as it happens.",
            "filters": [
                { "key": "kind", "options": ["Fetch", "Resource", "Any"], "initial": "Fetch" },
                { "key": "outcome", "options": ["All", "OK", "Failed"], "initial": "All" },
            ],
        },
    });
    let chip_colors = json!({
        "All": "var(--muted)",
        "Any": "var(--muted)",
        "Log": "var(--text)",
        "Info": "var(--info)",
        "Warn": "var(--warning)",
        "Error": "var(--danger)",
        "OK": "var(--success)",
        "Failed": "var(--danger)",
        "Fetch": "var(--accent)",
        "Resource": "var(--imp-color-purple, #c084fc)",
    });
    let styles = embedded::expect_text("cli/templates/review-widget.css");
    browser_script(
        "review-widget.js",
        &json!({
            "size": WIDGET_SIZE,
            "margin": WIDGET_MARGIN,
            "logViews": log_views,
            "chipColors": chip_colors,
            "html": format!("<style>{styles}</style>\n{}", widget_markup(mark, theme_editor)),
            "positionKey": WIDGET_POSITION_KEY,
            "reviewEndpoint": REVIEW_ENDPOINT,
            "reportModule": REPORT_MODULE,
            "themeEditorModule": THEME_EDITOR_MODULE,
            "telemetryEntries": TELEMETRY_ENTRIES,
        }),
    )
}
