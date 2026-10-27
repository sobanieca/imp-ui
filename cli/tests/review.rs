mod support;

use imp::review::{format_review, is_local_address, review_file_name};
use regex::Regex;
use serde_json::{Value, json};
use support::*;

#[test]
fn a_review_file_names_itself_by_timestamp_and_records_the_page_it_came_from() {
    let at = "2026-08-25T12:10:36.682Z";
    let local = |address: &str| is_local_address(&address.parse().unwrap());
    let report = [
        format!("file name: {}", review_file_name(at, 0)),
        format!("file name when that one exists: {}", review_file_name(at, 2)),
        format!("from 127.0.0.1: {}", local("127.0.0.1:1")),
        format!("from ::1: {}", local("[::1]:1")),
        format!("from ::ffff:127.0.0.1: {}", local("[::ffff:127.0.0.1]:1")),
        format!("from 192.168.1.20: {}", local("192.168.1.20:1")),
        "with no address at all: false".to_string(),
        String::new(),
        format_review(
            &json!({
                "page": "http://localhost:4401/preview/components/counter.preview.js",
                "title": "imp preview - Widgets / Counter",
                "viewport": "900x700 at 2x",
                "scroll": "0,1240",
                "scheme": "dark",
                "motion": "reduce",
                "lang": "en",
                "dir": "ltr",
                "element": {
                    "path": "body > imp-preview-page >> demo-counter >> span#value",
                    "rect": "10x19 at 371,485",
                    "text": "Total 0",
                    "html": "<span id=\"value\">0</span>",
                },
                "state": [{ "name": "demo.count", "value": 0 }, { "name": "demo.filter", "value": "done" }],
                "controls": [
                    { "name": "input[name=title]", "value": "Buy milk" },
                    { "name": "input[name=done]", "value": "checked", "disabled": true },
                    { "name": "input[name=secret]", "value": null, "length": 8 },
                ],
                "comment": "The count is cut off.\n\nIt needs more room at 320px.",
            }),
            at,
            &["[BROWSER:error] TypeError: todo is undefined".to_string(), "[HTTP] GET /api/todos -> 500 12ms".to_string()],
        ),
        format_review(&json!({ "element": { "path": "body" }, "comment": "a review with no page around it" }), at, &[]),
    ]
    .join("\n");
    assert_snapshot("review-file", &report);
}

#[test]
fn start_saves_a_review_under_imp_reviews() {
    let dir = TempDir::new();
    copy_directory(&fixture("basic"), &dir.path);
    let server = start_dev(&dir.path, &[]);
    let origin = format!("http://127.0.0.1:{}", server.port);
    let post = |body: &str| {
        http(
            server.port,
            "POST",
            "/@imp/review",
            &[
                ("content-type", "application/json"),
                ("origin", &origin),
                ("host", &format!("127.0.0.1:{}", server.port)),
            ],
            Some(body.as_bytes()),
        )
    };
    let saved = post(
        &json!({
            "page": format!("http://localhost:{}/", server.port),
            "title": "basic app",
            "viewport": "900x700",
            "element": { "path": "body > div#app > h1", "text": "hello", "html": "<h1>hello</h1>" },
            "comment": "the heading should be quieter",
        })
        .to_string(),
    );
    let path = serde_json::from_slice::<Value>(&saved.body).unwrap()["path"]
        .as_str()
        .unwrap()
        .to_string();
    let written = read(&dir.join(&path));
    let blank = post(&json!({ "element": { "path": "body" }, "comment": "   " }).to_string());
    let malformed = post("not json at all");
    post(&json!({ "element": { "path": "body > footer" }, "comment": "the year in the footer is stale" }).to_string());
    let listed = run_imp(&["review"], &dir.path);
    let from_subdirectory = run_imp(&["review"], &dir.join("public"));
    let cleared = run_imp(&["review", "clear"], &dir.path);
    let after_clearing = run_imp(&["review"], &dir.path);
    let cleared_again = run_imp(&["review", "clear"], &dir.path);
    let timestamp = Regex::new(r"[\d-]+T[\d:.-]+Z").unwrap();
    let mask = |text: &str| {
        timestamp
            .replace_all(&normalize(text), "<timestamp>")
            .replace(&format!(":{}", server.port), ":<port>")
            .replace(&dir.text(), "<tmp>")
    };
    let json_of = |answer: &Answer| {
        serde_json::from_slice::<Value>(&answer.body)
            .unwrap()
            .to_string()
    };
    let report = [
        format!(
            "POST /@imp/review: {} {}",
            saved.status,
            saved.header("content-type").unwrap_or("")
        ),
        format!(
            "path: {}",
            Regex::new(r"[\d-]+T[\d-]+Z")
                .unwrap()
                .replace(&path, "<timestamp>")
        ),
        format!("on a blank comment: {} {}", blank.status, json_of(&blank)),
        format!(
            "on a malformed body: {} {}",
            malformed.status,
            json_of(&malformed)
        ),
        String::new(),
        mask(&written),
        section("imp review", &mask(&listed.stdout)),
        section(
            "imp review (cwd: public/)",
            mask(&from_subdirectory.stdout)
                .trim_end()
                .lines()
                .last()
                .unwrap_or(""),
        ),
        section("imp review clear", &normalize(&cleared.stdout)),
        section(
            "imp review after clearing",
            &normalize(&after_clearing.stdout),
        ),
        section("imp review clear again", &normalize(&cleared_again.stdout)),
        format!(
            "reviews folder left behind: {}",
            dir.join(".imp/reviews").exists()
        ),
    ]
    .join("\n");
    assert_snapshot("start-review-saved", &format!("{report}\n"));
}

#[test]
fn the_review_widget_picks_an_element_in_the_preview_page() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    copy_directory(&fixture("preview"), &dir.path);
    let server = start_preview(&dir.path, &[]);
    let project = TempDir::new();
    let flow: Value = serde_json::from_str(&spec_report(
        &project.path,
        &fixture("preview-specs/review-widget.spec.js"),
        &format!("http://localhost:{}", server.port),
    ))
    .unwrap();
    let field = |key: &str| match &flow[key] {
        Value::String(text) => text.clone(),
        Value::Null => "undefined".into(),
        other => other.to_string(),
    };
    let files = list_files(&dir.join(".imp/reviews"));
    let written = normalize(&read(&dir.join(".imp/reviews").join(&files[0])));
    let written = Regex::new(r"(?m)^ *<timestamp> \[HTTP\] .*\n")
        .unwrap()
        .replace_all(&written, "");
    let written = Regex::new(r"(?m)^time: .*$")
        .unwrap()
        .replace(&written, "time: <timestamp>");
    let written = Regex::new(r"(?m)^element: .*?demo-counter")
        .unwrap()
        .replace(&written, "element: ... demo-counter");
    let written = Regex::new(r"(?m)^rect: \d+x\d+ at \d+,\d+$")
        .unwrap()
        .replace(&written, "rect: <w>x<h> at <x>,<y>");
    let written = written
        .replace(&format!(":{}", server.port), ":<port>")
        .replace(&dir.text(), "<tmp>");
    let report = [
        format!("widget collapsed before the toggle: {}", field("hiddenAtFirst")),
        format!("imp mark on the toggle: {}", field("markShown")),
        format!("actions shown after the toggle: {} (aria-expanded {})", field("actionsShown"), field("expanded")),
        format!("actions: {}", field("actionLabels")),
        format!("panel still hidden: {}", field("panelStillHidden")),
        format!("view after Add review: {}", field("pickingView")),
        format!("element highlighted on hover: {}", field("highlighted")),
        format!("view after clicking the element: {}", field("commentingView")),
        format!("picked element stays outlined while commenting: {}", field("outlineKept")),
        format!("element locator shown to the reviewer: {}", field("locatorShown")),
        format!("view after saving: {}", field("viewAfterSaving")),
        format!("outline cleared after saving: {}", field("outlineGone")),
        format!("status after saving: {}", Regex::new(r"[\d-]+T[\d-]+Z").unwrap().replace(&field("status"), "<timestamp>")),
        format!("console view: {} titled {} (aria-pressed {})", field("consoleView"), field("consoleTitle"), field("consolePressed")),
        format!("console warning listed with tone: {}", field("consoleLine")),
        format!("line that arrived live, with tone: {}", field("liveLine")),
        format!(
            "entry collapsed at first: aria-expanded {}, after a click: {}",
            field("collapsedAtFirst"),
            field("expandedOnClick")
        ),
        format!("console filters: {}", field("consoleChips")),
        format!("filtered to Error (aria-pressed {}): {}", field("pressedChip"), field("filtered")),
        format!("filter with no match: {}", field("noMatch")),
        format!("clear button: {}", field("clearLabel")),
        format!(
            "after clear: {}, console entries left in the page: {}, button disabled: {}, network entries untouched: {}",
            field("afterClear"),
            field("clearedInPage"),
            field("clearDisabled"),
            field("networkUntouched")
        ),
        format!("lines after clear: {}, button enabled again: {}", field("linesAfterClear"), field("clearEnabledAgain")),
        format!("network view: {}, filters: {}", field("networkView"), field("networkChips")),
        format!("moved by a drag: {}, collapsed: {}", field("moved"), field("collapsedByDrag")),
        format!("position remembered: {}", !flow["remembered"].is_null()),
        format!("review files written: {}", files.len()),
        String::new(),
        written,
    ]
    .join("\n");
    assert_snapshot("preview-review-widget", &report);
}

#[test]
fn the_review_widget_edits_the_applied_theme_of_an_app() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    write(&dir.join("imp.json"), "{ \"name\": \"themed\" }\n");
    write(
        &dir.join("index.html"),
        "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>themed</title></head><body><div id=\"app\"></div><script type=\"module\" src=\"/app.js\"></script></body></html>\n",
    );
    write(
        &dir.join("app.js"),
        "import { init, mount } from 'imp'\nimport { button } from 'imp/std'\nawait init({ theme: 'imp-light' })\nmount('#app', () => button('hello'))\n",
    );
    let server = start_dev(&dir.path, &[]);
    let project = TempDir::new();
    let report = spec_report(
        &project.path,
        &fixture("preview-specs/theme-editor.spec.js"),
        &format!("http://localhost:{}", server.port),
    );
    assert_snapshot("start-theme-editor-widget", &format!("{report}\n"));
}
