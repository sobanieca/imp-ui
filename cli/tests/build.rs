mod support;

use regex::Regex;
use serde_json::{Value, json};
use std::path::Path;
use std::sync::LazyLock;
use support::*;

static HASH: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"-[0-9a-f]{8}(\.[a-z]+)").unwrap());
static SIZE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\(\d+(\.\d+)? k?B\)").unwrap());

fn masked(text: &str, dir: &Path) -> String {
    let dir = posix(dir);
    let text = text.replace(&dir, "<tmp>").replace(&dir[1..], "<tmp>");
    let root = posix(&cli_dir());
    let text = text.replace(&format!("{}/", &root[1..]), "<root>/");
    let text = HASH.replace_all(&text, "-<hash>$1");
    SIZE.replace_all(&text, "(<size>)").into_owned()
}

fn output_tree(dir: &Path, outdir: &str) -> String {
    let files: Vec<String> = list_files(&dir.join(outdir))
        .into_iter()
        .map(|file| format!("{outdir}/{file}"))
        .collect();
    section("output files", &files.join("\n"))
}

fn write_config(dir: &Path, config: &Value) {
    write(
        &dir.join("imp.json"),
        &format!("{}\n", serde_json::to_string_pretty(config).unwrap()),
    );
}

fn build_project() -> TempDir {
    let dir = TempDir::new();
    copy_directory(&fixture("build"), &dir.path);
    dir
}

#[test]
fn build_app() {
    let dir = build_project();
    let result = run_imp(&["build"], &dir.path);
    let dist = dir.join("dist");
    let html = read(&dist.join("index.html"));
    let licenses = read(&dist.join("LICENSES.txt"));
    let analytics = read(&dist.join("app-analytics.json"));
    let entry = Regex::new(r#"src="/(chunks/app-[0-9a-f]{8}\.js)""#)
        .unwrap()
        .captures(&html)
        .map(|caps| caps[1].to_string())
        .expect("the page loads the app chunk");
    let usage = run_module_probe(
        &dist,
        &format!(
            "import * as module from '/{entry}'\nglobalThis.__probe = `[bundled module: message='${{module.message}}', impLogLevel=${{module.impLogLevel}}, lazy loadShout()='${{await module.loadShout()}}']`\n"
        ),
    );
    assert_snapshot(
        "build-app",
        &masked(
            &format!(
                "{}\n{}\n\n{}\n\n{}\n\n{}\n\n{usage}\n",
                transcript("imp build  (cwd: <tmp>)", &result),
                output_tree(&dir.path, "dist"),
                section("dist/index.html", &html),
                section("dist/LICENSES.txt", &licenses),
                section("dist/app-analytics.json", &analytics)
            ),
            &dir.path,
        ),
    );
}

#[test]
fn build_js_entry() {
    let dir = build_project();
    let result = run_imp(&["build", "app.js", "--output", "component"], &dir.path);
    let usage = run_module_probe(
        &dir.join("component"),
        "import * as module from './app.js'\nglobalThis.__probe = `[bundled module: message='${module.message}', lazy loadShout()='${await module.loadShout()}']`\n",
    );
    assert_snapshot(
        "build-js-entry",
        &masked(
            &format!(
                "{}\n{}\n\n{usage}\n",
                transcript("imp build app.js --output component  (cwd: <tmp>)", &result),
                output_tree(&dir.path, "component")
            ),
            &dir.path,
        ),
    );
}

#[test]
fn build_unreachable_chunks() {
    let dir = build_project();
    let chunks_of = |entry: &str, source: &str| {
        let skill = entry.replace(".js", ".skill.md");
        write(&dir.join(entry), source);
        write(&dir.join(&skill), "# probe\n");
        let result = run_imp(&["build", entry, "--output", "chunks-probe"], &dir.path);
        let mut files: Vec<String> = std::fs::read_dir(dir.join("chunks-probe/chunks"))
            .map(|entries| {
                entries
                    .flatten()
                    .map(|file| {
                        HASH.replace(&file.file_name().to_string_lossy(), "-<hash>$1")
                            .into_owned()
                    })
                    .collect()
            })
            .unwrap_or_default();
        files.sort();
        let _ = std::fs::remove_file(dir.join(entry));
        let _ = std::fs::remove_file(dir.join(&skill));
        let _ = std::fs::remove_dir_all(dir.join("chunks-probe"));
        let listed = if files.is_empty() {
            "none".to_string()
        } else {
            files.join(", ")
        };
        format!("{entry}: exit {}, chunks: {listed}", result.code)
    };
    let report = [
        chunks_of(
            "list-entry.js",
            "import { list } from 'imp/std/data'\n\nexport const render = () => list({ label: 'Rows' })\n",
        ),
        chunks_of(
            "map-entry.js",
            "import { map } from 'imp/std/data'\n\nexport const render = () => map({ label: 'World' })\n",
        ),
    ];
    assert_snapshot(
        "build-unreachable-chunks",
        &format!("{}\n", report.join("\n")),
    );
}

#[test]
fn build_imp_subpath() {
    let dir = build_project();
    let entry = dir.join("std-entry.js");
    write(&dir.join("std-entry.skill.md"), "# std-entry - a probe\n");
    write(
        &entry,
        "import { mount } from 'imp'\nimport { button } from 'imp/std'\n\nexport const render = () => mount('#app', button('Save'))\n",
    );
    let resolved = run_imp(&["build", "std-entry.js", "--output", "std"], &dir.path);
    let code = read(&dir.join("std/std-entry.js"));
    write(
        &entry,
        "import { barChart } from 'imp/std/charts'\n\nexport const shell = barChart\n",
    );
    let unknown = run_imp(&["build", "std-entry.js", "--output", "std"], &dir.path);
    write(
        &entry,
        "import { expect } from 'imp/test'\n\nexport const check = expect\n",
    );
    let tooling = run_imp(&["build", "std-entry.js", "--output", "std"], &dir.path);
    assert_snapshot(
        "build-imp-subpath",
        &masked(
            &format!(
                "{}\n[bundle defines the element: {}]\n[bundle carries a development check: {}]\n\n{}\n\n{}\n",
                transcript(
                    "imp build std-entry.js --output std  (cwd: <tmp>)",
                    &resolved
                ),
                code.contains("imp-${") && code.contains("variant-"),
                code.contains("__IMP_DEV__"),
                transcript(
                    "imp build std-entry.js --output std  (cwd: <tmp>, unknown subpath)",
                    &unknown
                ),
                transcript(
                    "imp build std-entry.js --output std  (cwd: <tmp>, tooling-only subpath)",
                    &tooling
                )
            ),
            &dir.path,
        ),
    );
}

#[test]
fn build_target_imp_host() {
    let dir = build_project();
    write_config(
        &dir.path,
        &json!({ "dependencies": { "mitt": "npm:mitt@3.0.1" }, "targetImpHost": true }),
    );
    let result = run_imp(&["build", "app.js", "--output", "shared"], &dir.path);
    let code = read(&dir.join("shared/app.js"));
    assert_snapshot(
        "build-target-imp-host",
        &masked(
            &format!(
                "{}\n{}\n\n{}\n",
                transcript("imp build app.js --output shared  (cwd: <tmp>)", &result),
                output_tree(&dir.path, "shared"),
                section("shared/app.js", &code)
            ),
            &dir.path,
        ),
    );
}

#[test]
fn build_component_files() {
    let source = build_project();
    let component = TempDir::new();
    let app = TempDir::new();
    write(&component.join("imp.json"), "{ \"targetImpHost\": true }\n");
    write(
        &component.join("widget.js"),
        "import { track, zone } from 'imp/analytics'\n\nexport const widget = (children) => zone({ name: 'widget.panel' }, children)\nexport const widgetSent = () => track('widget.sent')\n",
    );
    write(
        &component.join("widget.skill.md"),
        "# widget - a panel that sends a message\n",
    );
    let out = component.join("out");
    let built = run_imp(&["build", "widget.js", "--output", "out"], &component.path);
    let component_skill = section("out/imp-skill.md", &read(&out.join("imp-skill.md")));
    for name in ["widget.js", "imp-skill.md"] {
        write(
            &app.join(&format!("dependencies/widget/{name}")),
            &read(&out.join(name)),
        );
    }
    write(
        &app.join("imp.json"),
        "{ \"dependencies\": { \"widget\": \"npm:widget@1.0.0\" }, \"map\": \"app-map.js\" }\n",
    );
    write(&app.join("app-map.js"), &read(&source.join("app-map.js")));
    write(
        &app.join("app.js"),
        "import { track, zone } from 'imp/analytics'\nimport { widget } from 'widget'\n\nexport const page = () => zone({ name: 'shop.page' }, widget())\nexport const bought = () => track('shop.bought')\n",
    );
    write(
        &app.join("index.html"),
        "<!doctype html>\n<script type=\"module\" src=\"app.js\"></script>\n<script type=\"module\">\n  import { track } from 'imp/analytics'\n  globalThis.shopReady = () => track('shop.ready')\n</script>\n",
    );
    let app_built = run_imp(&["build"], &app.path);
    let analytics = section(
        "dist/app-analytics.json",
        &read(&app.join("dist/app-analytics.json")),
    );
    let skill = run_imp(&["skill", "widget"], &app.path);
    let text = format!(
        "{}\n{component_skill}\n\n{}\n{analytics}\n\n{}",
        transcript(
            "imp build widget.js --output out  (cwd: <component>)",
            &built
        ),
        transcript("imp build  (cwd: <app>, widget vendored)", &app_built),
        transcript("imp skill widget  (cwd: <app>)", &skill)
    );
    let text = text
        .replace(&component.text(), "<component>")
        .replace(&app.text(), "<app>");
    assert_snapshot("build-component-files", &masked(&text, &source.path));
}

#[test]
fn build_component_without_skill() {
    let project = TempDir::new();
    write(
        &project.join("widget.js"),
        "export const widget = () => 'widget'\n",
    );
    let result = run_imp(&["build", "widget.js"], &project.path);
    assert_snapshot(
        "build-component-without-skill",
        &masked(
            &transcript(
                "imp build widget.js  (cwd: <tmp>, no widget.skill.md)",
                &result,
            ),
            &project.path,
        ),
    );
}

#[test]
fn build_unreadable_analytics_name() {
    let source = build_project();
    let project = TempDir::new();
    write(&project.join("imp.json"), "{ \"map\": \"app-map.js\" }\n");
    write(
        &project.join("app-map.js"),
        &read(&source.join("app-map.js")),
    );
    write(
        &project.join("widget.js"),
        "import { track, zone } from 'imp/analytics'\n\nexport const widget = (name) => zone({ name }, track(`widget.${name}`))\n",
    );
    write(
        &project.join("index.html"),
        "<!doctype html>\n<script type=\"module\" src=\"widget.js\"></script>\n",
    );
    let result = run_imp(&["build"], &project.path);
    assert_snapshot(
        "build-unreadable-analytics-name",
        &masked(
            &transcript("imp build  (cwd: <tmp>)", &result),
            &project.path,
        ),
    );
}

#[test]
fn build_html_entry_ignores_target_imp_host() {
    let dir = build_project();
    write_config(
        &dir.path,
        &json!({ "dependencies": { "mitt": "npm:mitt@3.0.1" }, "targetImpHost": true }),
    );
    let result = run_imp(&["build"], &dir.path);
    assert_snapshot(
        "build-html-entry-ignores-target-imp-host",
        &masked(&transcript("imp build  (cwd: <tmp>)", &result), &dir.path),
    );
}

#[test]
fn build_invalid_target_imp_host() {
    let dir = build_project();
    write_config(
        &dir.path,
        &json!({ "dependencies": { "mitt": "npm:mitt@3.0.1" }, "targetImpHost": "yes" }),
    );
    let result = run_imp(&["build", "app.js"], &dir.path);
    assert_snapshot(
        "build-invalid-target-imp-host",
        &masked(
            &transcript("imp build app.js  (cwd: <tmp>)", &result),
            &dir.path,
        ),
    );
}

#[test]
fn build_missing_entry() {
    let dir = build_project();
    let result = run_imp(&["build", "missing.html"], &dir.path);
    assert_snapshot(
        "build-missing-entry",
        &masked(
            &transcript("imp build missing.html  (cwd: <tmp>)", &result),
            &dir.path,
        ),
    );
}

#[test]
fn build_entry_only_in_public() {
    let dir = build_project();
    std::fs::rename(dir.join("index.html"), dir.join("public/index.html")).unwrap();
    let result = run_imp(&["build"], &dir.path);
    assert_snapshot(
        "build-entry-only-in-public",
        &masked(&transcript("imp build  (cwd: <tmp>)", &result), &dir.path),
    );
}

#[test]
fn build_output_contains_project() {
    let dir = build_project();
    let result = run_imp(&["build", "--output", "."], &dir.path);
    assert_snapshot(
        "build-output-contains-project",
        &masked(
            &transcript("imp build --output .  (cwd: <tmp>)", &result),
            &dir.path,
        ),
    );
}

#[test]
fn build_not_vendored() {
    let dir = build_project();
    let result = run_imp(&["build"], &fixture("with-config"));
    assert_snapshot(
        "build-not-vendored",
        &masked(
            &transcript("imp build  (cwd: /tests/fixtures/with-config)", &result),
            &dir.path,
        ),
    );
}

#[test]
fn build_base_path() {
    let dir = build_project();
    write(
        &dir.join("env/prod.json"),
        &format!(
            "{}\n",
            serde_json::to_string_pretty(&json!({ "IMP_BASEPATH": "/my-imp-app" })).unwrap()
        ),
    );
    write_config(
        &dir.path,
        &json!({ "dependencies": { "mitt": "npm:mitt@3.0.1" }, "environments": { "default": "env/prod.json" } }),
    );
    let result = run_imp(&["build"], &dir.path);
    let html = read(&dir.join("dist/index.html"));
    assert_snapshot(
        "build-base-path",
        &masked(
            &format!(
                "{}\n{}\n\n{}\n",
                transcript("imp build  (cwd: <tmp>)", &result),
                output_tree(&dir.path, "dist"),
                section("dist/index.html", &html)
            ),
            &dir.path,
        ),
    );
}

#[test]
fn build_over_budget() {
    let dir = build_project();
    write_config(
        &dir.path,
        &json!({ "dependencies": { "mitt": "npm:mitt@3.0.1" }, "build": { "maxSize": 2048 } }),
    );
    let result = run_imp(&["build"], &dir.path);
    let dist = dir.join("dist").exists();
    let text = masked(
        &transcript("imp build  (cwd: <tmp>, build.maxSize 2048)", &result),
        &dir.path,
    );
    let text = Regex::new(r"the build is [\d.]+ k?B")
        .unwrap()
        .replace(&text, "the build is <size>")
        .into_owned();
    assert_snapshot(
        "build-over-budget",
        &format!("{text}\n[dist left behind: {dist}]\n"),
    );
}

#[test]
fn build_public_hashed_folder() {
    let dir = build_project();
    write(
        &dir.join("public/chunks/old.js"),
        "export const old = true\n",
    );
    let result = run_imp(&["build"], &dir.path);
    assert_snapshot(
        "build-public-hashed-folder",
        &masked(
            &transcript("imp build  (cwd: <tmp>, with public/chunks/)", &result),
            &dir.path,
        ),
    );
}

#[test]
fn build_public_collision() {
    let dir = build_project();
    write(&dir.join("public/LICENSES.txt"), "a file of the app\n");
    let result = run_imp(&["build"], &dir.path);
    assert_snapshot(
        "build-public-collision",
        &masked(&transcript("imp build  (cwd: <tmp>)", &result), &dir.path),
    );
}

#[test]
fn build_carries_the_qr_notice_only_where_qr_code_is_bundled() {
    let project = TempDir::new();
    write(
        &project.join("index.html"),
        "<!doctype html>\n<script type=\"module\" src=\"app.js\"></script>\n",
    );
    let build_with = |name: &str, from: &str, call: &str, output: &str| {
        write(
            &project.join("app.js"),
            &format!(
                "import {{ mount }} from 'imp'\nimport {{ {name} }} from '{from}'\n\nmount(document.body, {call})\n"
            ),
        );
        let result = run_imp(&["build", "--output", output], &project.path);
        check(
            result.code == 0,
            format!("imp build failed:\n{}\n{}", result.stdout, result.stderr),
        );
        read(&project.join(output).join("LICENSES.txt"))
    };
    let drawing = build_with(
        "qrCode",
        "imp/std/display",
        "qrCode({ value: 'https://imp.dev' })",
        "drawing",
    );
    let plain = build_with("button", "imp/std", "button('Save')", "plain");
    check(
        drawing.contains("Copyright (c) Project Nayuki. (MIT License)")
            && drawing.contains(
                "The above copyright notice and this permission notice shall be included",
            ),
        "an app that draws a qrCode carries the MIT notice of the QR Code generator library",
    );
    check(
        !plain.contains("Project Nayuki"),
        "an app that draws no qrCode carries no notice of the QR Code generator library",
    );
}

#[test]
fn build_reads_adversarial_html_the_way_a_browser_does() {
    let dir = TempDir::new();
    copy_directory(&fixture("build-html-edge"), &dir.path);
    let mask = |text: &str| {
        let text = text.replace(&dir.text(), "<tmp>");
        let text = Regex::new(r"-[0-9a-f]{8}\.(js|svg)")
            .unwrap()
            .replace_all(&text, "-<hash>.$1")
            .into_owned();
        SIZE.replace_all(&text, "(<size>)").into_owned()
    };
    let result = run_imp(&["build"], &dir.path);
    let html =
        std::fs::read_to_string(dir.join("dist/index.html")).unwrap_or_else(|_| "(none)".into());
    let entry = Regex::new(r"SRC=/base/(chunks/app-[0-9a-f]{8}\.js)")
        .unwrap()
        .captures(&html)
        .map(|caps| caps[1].to_string());
    let bundle = entry
        .map(|entry| read(&dir.join("dist").join(entry)))
        .unwrap_or_default();
    let asset = Regex::new(r#"["`][^"`]*logo-[0-9a-f]{8}\.svg["`]"#)
        .unwrap()
        .find(&bundle)
        .map(|found| found.as_str().replace('`', "\""))
        .unwrap_or_else(|| "(none)".into());
    let asset = Regex::new(r"-[0-9a-f]{8}\.svg")
        .unwrap()
        .replace(&asset, "-<hash>.svg")
        .into_owned();
    assert_snapshot(
        "build-html-edge",
        &mask(&format!(
            "{}\n{}\n\n[imported asset url: {asset}]\n",
            transcript("imp build  (cwd: <tmp>)", &result),
            section("dist/index.html", &html)
        )),
    );
    let lint = run_imp(&["lint"], &dir.path);
    assert_snapshot(
        "lint-html-edge",
        &mask(&transcript("imp lint  (cwd: <tmp>)", &lint)),
    );
}

#[test]
fn build_writes_the_same_files_from_any_folder() {
    let shallow = TempDir::new();
    let deep = TempDir::new();
    let mut builds = Vec::new();
    for (cwd, folder) in [(&shallow, "app"), (&deep, "a/longer/path/to/the/app")] {
        let dir = cwd.join(folder);
        copy_directory(&fixture("build"), &dir);
        let index = format!("{folder}/index.html");
        let output = format!("{folder}/dist");
        let result = run_imp(&["build", &index, "--output", &output], &cwd.path);
        check(
            result.code == 0,
            format!("imp build failed in {}: {}", dir.display(), result.stderr),
        );
        let dist = dir.join("dist");
        let files: Vec<String> = list_files(&dist)
            .into_iter()
            .map(|file| {
                format!(
                    "{file}\n{}",
                    String::from_utf8_lossy(&std::fs::read(dist.join(&file)).unwrap())
                )
            })
            .collect();
        builds.push(files);
    }
    check(
        builds[0].len() > 3,
        format!("the build wrote {} files", builds[0].len()),
    );
    check(
        builds[0] == builds[1],
        "the two folders built different files",
    );
}

#[test]
fn build_stops_when_a_script_imports_css() {
    let dir = TempDir::new();
    copy_directory(&fixture("build-page"), &dir.path);
    write(&dir.join("card.css"), ".card { color: red }\n");
    write(
        &dir.join("app.js"),
        "import './card.css'\nexport const card = 1\n",
    );
    let result = run_imp(&["build"], &dir.path);
    check(result.code != 0, "a CSS import fails the build");
    check(
        result
            .stderr
            .contains("app.js imports './card.css' - a script cannot import CSS"),
        format!(
            "the message names the script and the file:\n{}",
            result.stderr
        ),
    );
    check(
        result
            .stderr
            .contains("A component carries its styles in its 'styles'"),
        "the message says where styles go",
    );
    check(
        !dir.join("dist").exists(),
        "a failed build writes no output",
    );
}

#[test]
fn build_rewrites_every_url_of_the_page_and_reports_its_inline_code() {
    let dir = TempDir::new();
    copy_directory(&fixture("build-page"), &dir.path);
    let mut result = run_imp(&["build"], &dir.path);
    result.stdout = SIZE.replace_all(&result.stdout, "(<size>)").into_owned();
    let html =
        std::fs::read_to_string(dir.join("dist/index.html")).unwrap_or_else(|_| "(none)".into());
    let text = format!(
        "{}\n{}\n",
        transcript("imp build  (cwd: <tmp>)", &result),
        section("dist/index.html", &html)
    );
    let text = Regex::new(r"-[0-9a-f]{8}\.(js|css)")
        .unwrap()
        .replace_all(&text, "-<hash>.$1")
        .into_owned();
    assert_snapshot("build-page", &text);
}

fn is_png(path: &Path) -> bool {
    std::fs::read(path)
        .map(|bytes| bytes.starts_with(&[0x89, 0x50, 0x4e, 0x47]))
        .unwrap_or(false)
}

fn precache_of(source: &str) -> Value {
    Regex::new(r"globalThis\.__IMP_PRECACHE__ = ([^\n]*);\n")
        .unwrap()
        .captures(source)
        .and_then(|caps| serde_json::from_str(&caps[1]).ok())
        .unwrap_or(Value::Null)
}

fn worker_listeners(source: &str) -> Vec<String> {
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        let harness = format!(
            "const listeners = []\nconst scope = {{ addEventListener: (type) => listeners.push(type), skipWaiting: () => {{}}, clients: {{ claim: () => {{}} }}, registration: {{ scope: 'http://app.test/' }} }}\nglobalThis.URL = class {{ constructor(url) {{ this.href = url; this.pathname = new RegExp('^[a-z]+://[^/]+(/[^?#]*)').exec(url)?.[1] ?? '/' }} }}\nnew Function('self', 'fetch', 'globalThis', {})(scope, () => {{}}, scope)\nlisteners.sort().join(', ')",
            serde_json::to_string(source).unwrap()
        );
        let joined: String = ctx.eval(harness).unwrap_or_else(|error| format!("(failed: {error}: {:?})", ctx.catch()));
        joined.split(", ").map(str::to_string).collect()
    })
}

fn worker_report(source: &str) -> String {
    let precache = precache_of(source);
    let version = precache["version"].as_str().unwrap_or("");
    let hex = version.len() == 16 && version.chars().all(|char| char.is_ascii_hexdigit());
    [
        format!(
            "precache version: {}",
            if hex { "<16 hex digits>" } else { "(none)" }
        ),
        format!(
            "precache shell: {}",
            precache.get("shell").unwrap_or(&Value::Null)
        ),
        format!(
            "precache hashed: {}",
            precache.get("hashed").unwrap_or(&Value::Null)
        ),
        format!(
            "precache required: {}",
            precache.get("required").unwrap_or(&Value::Null)
        ),
        format!(
            "precache optional: {}",
            precache.get("optional").unwrap_or(&Value::Null)
        ),
        format!("listeners: {}", worker_listeners(source).join(", ")),
    ]
    .join("\n")
}

#[test]
fn build_pwa() {
    let dir = TempDir::new();
    copy_directory(&fixture("build-pwa"), &dir.path);
    let mask = |text: &str| {
        let text = text.replace(&dir.text(), "<tmp>");
        let text = Regex::new(r"-[0-9a-f]{8}\.js")
            .unwrap()
            .replace_all(&text, "-<hash>.js")
            .into_owned();
        SIZE.replace_all(&text, "(<size>)").into_owned()
    };
    let result = run_imp(&["build", "--pwa"], &dir.path);
    let dist = dir.join("dist");
    let icons = [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon.png",
    ];
    let icon_report: Vec<String> = icons
        .iter()
        .map(|icon| {
            format!(
                "{icon}: {}",
                if is_png(&dist.join(icon)) {
                    "PNG"
                } else {
                    "NOT PNG"
                }
            )
        })
        .collect();
    assert_snapshot(
        "build-pwa",
        &mask(&format!(
            "{}\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n",
            transcript("imp build --pwa  (cwd: <tmp>)", &result),
            output_tree(&dir.path, "dist"),
            section(
                "dist/manifest.webmanifest",
                &read(&dist.join("manifest.webmanifest"))
            ),
            section("dist/sw.js", &worker_report(&read(&dist.join("sw.js")))),
            section("dist/index.html", &read(&dist.join("index.html"))),
            section("icon files", &icon_report.join("\n"))
        )),
    );

    std::fs::copy(dist.join("icons/icon-512.png"), dir.join("assets/icon.png")).unwrap();
    write_config(
        &dir.path,
        &json!({ "pwa": { "name": "Fixture PWA", "shortName": "Fixture", "themeColor": "#101828", "backgroundColor": "#ffffff", "display": "standalone", "icon": "assets/icon.png" } }),
    );
    let result = run_imp(&["build", "--pwa"], &dir.path);
    let report = format!(
        "icons/icon-512.png: {}",
        if is_png(&dir.join("dist/icons/icon-512.png")) {
            "PNG"
        } else {
            "NOT PNG"
        }
    );
    assert_snapshot(
        "build-pwa-png-source",
        &mask(&format!(
            "{}\n{}\n",
            transcript("imp build --pwa  (cwd: <tmp>)", &result),
            section("icon from PNG source", &report)
        )),
    );

    std::fs::copy(
        dir.join("dist/icons/icon-192.png"),
        dir.join("assets/icon-small.png"),
    )
    .unwrap();
    write_config(
        &dir.path,
        &json!({ "pwa": { "name": "Fixture PWA", "icon": "assets/icon-small.png" } }),
    );
    let result = run_imp(&["build", "--pwa"], &dir.path);
    assert_snapshot(
        "build-pwa-small-source-warns",
        &mask(&transcript("imp build --pwa  (cwd: <tmp>)", &result)),
    );

    write_config(&dir.path, &json!({}));
    let result = run_imp(&["build", "--pwa"], &dir.path);
    assert_snapshot(
        "build-pwa-no-block",
        &mask(&transcript("imp build --pwa  (cwd: <tmp>)", &result)),
    );

    write_config(
        &dir.path,
        &json!({ "pwa": { "name": "Fixture PWA", "icon": "assets/icon.svg" } }),
    );
    let result = run_imp(&["build", "app.js", "--pwa"], &dir.path);
    assert_snapshot(
        "build-pwa-js-entry",
        &mask(&transcript("imp build app.js --pwa  (cwd: <tmp>)", &result)),
    );
}

#[test]
fn build_pwa_precaches_only_the_files_that_the_app_loads_from_the_host() {
    let dir = TempDir::new();
    copy_directory(&fixture("build-pwa"), &dir.path);
    let public_files = [
        ("robots.txt", "robots"),
        ("docs/guide.txt", "guide"),
        ("a#b.txt", "hash sign"),
        ("100%.txt", "percent sign"),
        ("space name.txt", "space"),
        ("caf\u{e9}.txt", "non-ascii"),
        ("_redirects", "/*  /app/index.html  200"),
        ("_headers", "/app/chunks/*\n  Cache-Control: immutable"),
        ("404.html", "not found"),
        ("CNAME", "app.example.com"),
        ("vercel.json", "{}"),
        (".nojekyll", ""),
        (".well-known/assetlinks.json", "[]"),
    ];
    for (name, text) in public_files {
        write(&dir.join(&format!("public/{name}")), text);
    }
    write(&dir.join("env/prod.json"), r#"{"IMP_BASEPATH":"/app"}"#);
    let mut config: Value = serde_json::from_str(&read(&dir.join("imp.json"))).unwrap();
    config["environments"] = json!({ "default": "env/prod.json" });
    write(&dir.join("imp.json"), &config.to_string());
    let result = run_imp(&["build", "--pwa", "--output", "site/app"], &dir.path);
    check(
        result.code == 0,
        format!("the build failed:\n{}", result.stderr),
    );
    let precache = precache_of(&read(&dir.join("site/app/sw.js")));
    let list = |key: &str| -> Vec<String> {
        let mut urls: Vec<String> = precache[key]
            .as_array()
            .unwrap()
            .iter()
            .map(|url| {
                Regex::new(r"-[0-9a-f]{8}\.js$")
                    .unwrap()
                    .replace(url.as_str().unwrap(), "-<hash>.js")
                    .into_owned()
            })
            .collect();
        urls.sort();
        urls
    };
    check(
        precache["shell"] == "/app/index.html",
        format!("the shell is {}", precache["shell"]),
    );
    check(
        list("hashed")
            == [
                "/app/chunks/app-<hash>.js",
                "/app/chunks/env-<hash>.js",
                "/app/chunks/register-service-worker-<hash>.js",
            ],
        format!("hashed: {:?}", list("hashed")),
    );
    check(
        list("required")
            == [
                "/app/icons/apple-touch-icon.png",
                "/app/icons/icon-192.png",
                "/app/icons/icon-512.png",
                "/app/icons/icon-maskable-512.png",
                "/app/index.html",
                "/app/manifest.webmanifest",
            ],
        format!("required: {:?}", list("required")),
    );
    check(
        list("optional")
            == [
                "/app/100%25.txt",
                "/app/a%23b.txt",
                "/app/caf%C3%A9.txt",
                "/app/docs/guide.txt",
                "/app/robots.txt",
                "/app/space%20name.txt",
            ],
        format!("optional: {:?}", list("optional")),
    );
    let server = serve_folder(&dir.join("site"), &[]);
    let port: u16 = server.base.rsplit(':').next().unwrap().parse().unwrap();
    for key in ["hashed", "required", "optional"] {
        for url in precache[key].as_array().unwrap() {
            let answer = get(port, url.as_str().unwrap());
            check(
                answer.status == 200,
                format!("the host answered {} for {url}", answer.status),
            );
        }
    }
    check(
        get(port, "/app/a%23b.txt").text() == "hash sign",
        "the encoded url served the file",
    );
}

fn spec_project() -> TempDir {
    let project = TempDir::new();
    write(
        &project.join("index.html"),
        "<!doctype html>\n<title>spec host</title>\n",
    );
    project
}

fn run_browser_spec(project: &TempDir, source: &str) {
    let result = run_spec(&project.path, "probe.spec.js", source);
    check(
        result.code == 0,
        format!(
            "the browser spec failed:\n{}\n{}",
            result.stdout, result.stderr
        ),
    );
}

#[test]
fn build_pwa_keeps_the_previous_build_for_a_running_page() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    let html = "<!doctype html><html><head><title>update</title></head><body><script type=\"module\" src=\"/app.js\"></script></body></html>";
    for release in ["one", "two", "three"] {
        write(&dir.join("index.html"), html);
        write(
            &dir.join("imp.json"),
            &json!({ "pwa": { "name": "Update", "icon": "icon.svg" } }).to_string(),
        );
        write(
            &dir.join("icon.svg"),
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 8 8\"><rect width=\"8\" height=\"8\"/></svg>",
        );
        write(
            &dir.join("app.js"),
            &format!(
                "globalThis.release = {}\nglobalThis.loadPanel = () => import('./panel.js').then((module) => module.panel)\n",
                Value::from(release)
            ),
        );
        write(
            &dir.join("panel.js"),
            &format!(
                "export const panel = {}\n",
                Value::from(format!("panel of {release}"))
            ),
        );
        let result = run_imp(
            &["build", "--pwa", "--output", &format!("releases/{release}")],
            &dir.path,
        );
        check(
            result.code == 0,
            format!("build of {release} failed:\n{}", result.stderr),
        );
    }
    let server = serve_folder(&dir.join("releases"), &[]);
    server.serve(&dir.join("releases/one"));
    let project = spec_project();
    run_browser_spec(
        &project,
        &format!(
            r#"import {{ expect, test }} from 'imp/test'

const base = {base}

const deploy = (release) => fetch(`${{base}}/__deploy/${{release}}`, {{ mode: 'no-cors' }})

const updateWorker = (page) =>
  page.evaluate(async () => {{
    const registration = await navigator.serviceWorker.getRegistration()
    const previous = registration.active
    await registration.update()
    await new Promise((resolve) => {{
      const settle = () => {{
        const worker = registration.active
        if (worker !== previous && worker?.state === 'activated') return resolve()
        setTimeout(settle, 50)
      }}
      settle()
    }})
  }})

const buildCaches = (page) =>
  page.evaluate(async () => (await caches.keys()).filter((key) => key.startsWith('imp-pwa / ')).length)

test('the previous build stays for a running page', async ({{ page }}) => {{
  await page.goto(`${{base}}/`)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  expect(await page.evaluate(() => globalThis.release)).toEqual('one')

  await deploy('two')
  await updateWorker(page)
  expect(await page.evaluate(() => globalThis.loadPanel())).toEqual('panel of one')
  expect(await buildCaches(page)).toEqual(2)

  const next = await page.browser().newPage()
  await next.goto(`${{base}}/`)
  expect(await next.evaluate(() => globalThis.release)).toEqual('two')
  expect(await buildCaches(next)).toEqual(2)

  await deploy('three')
  await updateWorker(next)
  expect(await buildCaches(next)).toEqual(2)
  expect(await next.evaluate(() => globalThis.loadPanel())).toEqual('panel of two')
  await next.goto(`${{base}}/`)
  expect(await buildCaches(next)).toEqual(2)
  expect(await next.evaluate(() => globalThis.release)).toEqual('three')
  expect(await next.evaluate(() => globalThis.loadPanel())).toEqual('panel of three')
  await next.close()
}}, {{ timeout: 90000 }})
"#,
            base = Value::from(server.base.clone())
        ),
    );
}

#[test]
fn precache_build_in_a_project_worker_serves_the_app_offline() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    write(
        &dir.join("index.html"),
        "<!doctype html><html><head><title>offline</title></head><body><script type=\"module\" src=\"/app.js\"></script></body></html>",
    );
    write(&dir.join("app.js"), "globalThis.started = 'yes'\n");
    write(
        &dir.join("src/sw.js"),
        "import { precacheBuild } from 'imp/service-worker'\n\nprecacheBuild()\n",
    );
    write(
        &dir.join("icon.svg"),
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 8 8\"><rect width=\"8\" height=\"8\"/></svg>",
    );
    write(
        &dir.join("imp.json"),
        &json!({ "serviceWorker": "src/sw.js", "pwa": { "name": "Offline", "icon": "icon.svg" } })
            .to_string(),
    );
    let result = run_imp(&["build", "--pwa"], &dir.path);
    check(
        result.code == 0,
        format!("the build failed:\n{}", result.stderr),
    );
    let server = serve_folder(&dir.join("dist"), &[]);
    let project = spec_project();
    run_browser_spec(
        &project,
        &format!(
            r#"import {{ expect, test }} from 'imp/test'

const base = {base}

test('the app starts offline', async ({{ page }}) => {{
  await page.goto(`${{base}}/`)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await fetch(`${{base}}/__stop`, {{ mode: 'no-cors' }})
  await page.goto(`${{base}}/invoices/7`)
  expect(await page.evaluate(() => globalThis.started)).toEqual('yes')
  expect(await page.title()).toEqual('offline')
}})
"#,
            base = Value::from(server.base.clone())
        ),
    );
}

const STRICT_POLICY: &str = "script-src 'self'; style-src 'self'";

#[test]
fn a_built_app_runs_under_a_strict_content_security_policy() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    write(
        &dir.join("index.html"),
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>csp</title><link rel=\"stylesheet\" href=\"/styles.css\"></head><body><div id=\"app\"></div><script type=\"module\" src=\"/src/main.js\"></script><script type=\"module\">globalThis.inlineRan = 'yes'</script></body></html>",
    );
    write(&dir.join("public/styles.css"), "body { margin: 0; }\n");
    write(
        &dir.join("src/main.js"),
        &[
            "import { env, mount } from 'imp'",
            "import { div } from 'imp/html'",
            "import { button } from 'imp/std'",
            "import { breadcrumbs } from 'imp/std/shell'",
            "",
            "mount('#app', () =>",
            "  div(",
            "    div({ id: 'greeting' }, env.GREETING),",
            "    div({ id: 'styled', style: 'color: rgb(1, 2, 3)' }, 'styled'),",
            "    button({ variant: 'primary' }, 'Save'),",
            "    breadcrumbs({",
            "      items: [",
            "        { id: 'home', label: 'Home', href: '/' },",
            "        { id: 'repo', label: 'imp', href: '/imp', options: [{ id: 'a', label: 'a', href: '/a' }] },",
            "      ],",
            "    }),",
            "  ))",
            "",
        ]
        .join("\n"),
    );
    write(
        &dir.join("env/prod.json"),
        &json!({ "GREETING": "hello </script> <!-- world" }).to_string(),
    );
    write(
        &dir.join("icon.svg"),
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 8 8\"><rect width=\"8\" height=\"8\"/></svg>",
    );
    write(
        &dir.join("imp.json"),
        &json!({ "environments": { "default": "env/prod.json" }, "pwa": { "name": "Strict", "icon": "icon.svg" } }).to_string(),
    );
    let result = run_imp(&["build", "--pwa"], &dir.path);
    check(
        result.code == 0,
        format!("the build failed:\n{}", result.stderr),
    );
    let html = read(&dir.join("dist/index.html"));
    check(
        imp::html_document::read_html(&html)
            .scripts
            .iter()
            .all(|script| script.src.is_some() && script.text.is_empty()),
        format!("the built page still has an inline script:\n{html}"),
    );
    let csp = STRICT_POLICY.to_string();
    let server = serve_folder(&dir.join("dist"), &[("content-security-policy", &csp)]);
    let project = spec_project();
    run_browser_spec(
        &project,
        &format!(
            r#"import {{ expect, test }} from 'imp/test'

const base = {base}

test('a strict policy blocks nothing that the app needs', async ({{ page }}) => {{
  const reports = []
  page.on('console', (message) => {{
    if (/content security policy/i.test(message.text())) reports.push(message.text())
  }})
  await page.evaluateOnNewDocument(() => {{
    globalThis.impViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {{
      globalThis.impViolations.push(`${{event.violatedDirective}} ${{event.blockedURI}}`)
    }}, true)
  }})
  await page.goto(`${{base}}/`)
  await page.waitForFunction(() => document.querySelector('imp-breadcrumbs')?.shadowRoot)
  const state = await page.evaluate(async () => {{
    await navigator.serviceWorker.ready
    const crumbs = document.querySelector('imp-breadcrumbs').shadowRoot
    return {{
      inline: globalThis.inlineRan,
      greeting: document.querySelector('#greeting').textContent,
      styled: getComputedStyle(document.querySelector('#styled')).color,
      anchor: getComputedStyle(crumbs.querySelector('.picker')).anchorName,
      violations: [...globalThis.impViolations],
    }}
  }})
  expect(state.inline).toEqual('yes')
  expect(state.greeting).toEqual('hello </script> <!-- world')
  expect(state.styled).toEqual('rgb(1, 2, 3)')
  expect(state.anchor).toEqual('--imp-crumb-1')
  expect([...state.violations, ...reports]).toEqual([])
  const probe = await page.evaluate(async () => {{
    document.body.setAttribute('style', 'color: red')
    await new Promise((resolve) => setTimeout(resolve, 100))
    return globalThis.impViolations.length
  }})
  expect(probe).toEqual(1)
}})
"#,
            base = Value::from(server.base.clone())
        ),
    );
}

#[test]
fn build_refuses_an_output_folder_that_it_must_not_delete() {
    let dir = TempDir::new();
    write(
        &dir.join("index.html"),
        "<!doctype html><script type=\"module\" src=\"/src/main.js\"></script>\n",
    );
    write(&dir.join("src/main.js"), "console.log('hello')\n");
    write(&dir.join("public/robots.txt"), "User-agent: *\n");
    write(&dir.join("notes/plan.md"), "# plan\n");
    write(&dir.join("file.txt"), "a file\n");
    let mut refused = Vec::new();
    for output in [
        "src",
        ".",
        "..",
        "public",
        "public/out",
        "notes",
        "file.txt",
    ] {
        let result = run_imp(&["build", "--output", output], &dir.path);
        check(
            result.code == 1,
            format!("imp build --output {output} did not fail"),
        );
        refused.push(transcript(
            &format!("imp build --output {output}  (cwd: <tmp>)"),
            &result,
        ));
    }
    check(
        dir.join("src/main.js").exists(),
        "a refused build deleted src/",
    );
    check(
        dir.join("notes/plan.md").exists(),
        "a refused build deleted notes/",
    );
    check(
        dir.join("public/robots.txt").exists(),
        "a refused build deleted public/",
    );
    std::fs::create_dir_all(dir.join("empty")).unwrap();
    let into_empty = run_imp(&["build", "--output", "empty"], &dir.path);
    check(
        into_empty.code == 0,
        format!("a build into an empty folder failed: {}", into_empty.stderr),
    );
    check(
        dir.join("empty/.imp-output").exists(),
        "the build wrote no marker",
    );
    write(&dir.join("empty/stale.txt"), "stale\n");
    let again = run_imp(&["build", "--output", "empty"], &dir.path);
    check(
        again.code == 0,
        format!("a build over an earlier build failed: {}", again.stderr),
    );
    check(
        !dir.join("empty/stale.txt").exists(),
        "the build kept a file of the earlier build",
    );
    check(
        dir.join("empty/.imp-output").exists(),
        "the second build wrote no marker",
    );
    let parent = posix(dir.path.parent().unwrap());
    assert_snapshot(
        "build-output-guards",
        &refused
            .join("\n\n")
            .replace(&dir.text(), "<tmp>")
            .replace(&parent, "<tmp>/.."),
    );
}

#[test]
fn the_offline_worker_of_build_pwa() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    copy_directory(&fixture("build-pwa"), &dir.path);
    let result = run_imp(&["build", "--pwa"], &dir.path);
    check(
        result.code == 0,
        format!("the build failed:\n{}", result.stderr),
    );
    let source = Regex::new(r"globalThis\.__IMP_PRECACHE__ = [^\n]*;\n")
        .unwrap()
        .replace(&read(&dir.join("dist/sw.js")), "")
        .into_owned();
    let project = TempDir::new();
    copy_directory(&fixture("offline-worker"), &project.path);
    write(
        &project.join("worker-source.js"),
        &format!("export const source = {}\n", Value::from(source)),
    );
    let result = run_imp(&["test", "offline-worker.test.js"], &project.path);
    check(
        result.code == 0,
        format!(
            "the offline worker tests failed:\n{}\n{}",
            result.stdout, result.stderr
        ),
    );
}
