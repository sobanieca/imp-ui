mod support;

use imp::review::read_widget_mark;
use imp::start::{Widget, client_script};
use regex::Regex;
use std::time::Duration;
use support::*;

fn settled() {
    std::thread::sleep(Duration::from_millis(300));
}

fn catalog_files(port: u16) -> Vec<String> {
    let bundle = get(port, "/@imp/preview/app.js").text();
    Regex::new(r#""file":\s?"([^"]+\.preview\.js)""#)
        .unwrap()
        .captures_iter(&bundle)
        .map(|caps| caps[1].to_string())
        .collect()
}

#[test]
fn preview_no_reload_keeps_the_page_and_still_reads_the_catalog_again() {
    let dir = TempDir::new();
    copy_directory(&fixture("preview"), &dir.path);
    let server = start_preview(&dir.path, &["--no-reload"]);
    let port = server.port;
    let banner = normalize(&server.banner).replace(&format!(":{port}"), ":<port>");
    assert_snapshot(
        "preview-no-reload-banner",
        &banner
            .replace(&dir.text(), "<tmp>")
            .replace(&dir.text()[1..], "<tmp>"),
    );

    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = sender.send(first_reload_event(port, Duration::from_millis(1500)));
    });
    settled();
    touch(&dir.join("components/counter.js"));
    let result = receiver.recv().unwrap();
    check(
        result.is_none(),
        format!("no reload arrives with --no-reload, got {result:?}"),
    );

    let added = "components/extra.preview.js";
    let before = catalog_files(port);
    check(
        before
            .iter()
            .any(|file| file == "components/counter.preview.js"),
        "the catalog lists the fixture",
    );
    check(
        !before.iter().any(|file| file == added),
        "the catalog starts without the new preview",
    );
    let source = read(&dir.join("components/counter.preview.js"));
    write(
        &dir.join(added),
        &source.replace(
            "export const name = 'Counter'",
            "export const name = 'Extra'",
        ),
    );
    let mut after = catalog_files(port);
    for _ in 0..20 {
        if after.iter().any(|file| file == added) {
            break;
        }
        settled();
        after = catalog_files(port);
    }
    check(
        after.iter().any(|file| file == added),
        "the catalog lists the new preview after the save",
    );
    assert_snapshot(
        "preview-no-reload-catalog",
        &format!(
            "{}\n\n{}\n",
            section("before the save", &before.join("\n")),
            section("after the save", &after.join("\n"))
        ),
    );
    drop(server);

    let one = start_preview(
        &fixture("preview"),
        &["components/counter.preview.js", "--no-reload"],
    );
    assert_snapshot(
        "preview-no-reload-path",
        &normalize(&one.banner).replace(&format!(":{}", one.port), ":<port>"),
    );
    drop(one);

    let mocked = start_preview(&fixture("preview"), &["--mock", "--no-reload"]);
    check(
        mocked.banner.contains("serving 2 previews"),
        "both previews are still found",
    );
    check(
        mocked.banner.contains("no reload"),
        "the banner says no reload",
    );
}

#[test]
fn preview_serves_the_catalog() {
    let server = start_preview(&fixture("preview"), &[]);
    let port = server.port;
    assert_snapshot(
        "preview-banner",
        &normalize(&server.banner).replace(&format!(":{port}"), ":<port>"),
    );
    let preview_client = client_script(false, false, &read_widget_mark(), Widget::Review);
    let page = |name: &str, path: &str| {
        let answer = get(port, path);
        let body = normalize(
            &answer
                .text()
                .replace(&preview_client, "\n[imp client script]\n"),
        );
        assert_snapshot(name, &response_transcript(path, &answer, &body));
    };
    page("preview-index", "/");
    page("preview-page", "/widgets/counter");
    let path = "/@imp/preview/components/missing.preview.js";
    let answer = get(port, path);
    assert_snapshot(
        "preview-unknown-page",
        &response_transcript(path, &answer, &normalize(&answer.text())),
    );

    let shared = Regex::new(r#"from\s*["'](\.\.?/)+chunks/"#).unwrap();
    let path = "/@imp/preview/app.js";
    let answer = get(port, path);
    let body = answer.text();
    let report = [
        format!(
            "starts the preview chrome: {}",
            body.contains("startPreview(")
        ),
        format!(
            "catalog embedded: {}",
            body.contains("\"components/counter.preview.js\"")
        ),
        format!(
            "loads a group on demand: {}",
            Regex::new(r#"import\(["'`]\./groups/widgets\.js["'`]\)"#)
                .unwrap()
                .is_match(&body)
        ),
        format!("library shared through a chunk: {}", shared.is_match(&body)),
    ];
    assert_snapshot(
        "preview-app",
        &response_transcript(path, &answer, &report.join("\n")),
    );

    let path = "/@imp/preview/groups/components.js";
    let answer = get(port, path);
    let body = answer.text();
    let report = [
        format!(
            "defines the component: {}",
            Regex::new(r#"component\(["']demo-todos["']"#)
                .unwrap()
                .is_match(&body)
        ),
        format!("mocked fixture inlined: {}", body.contains("Buy milk")),
        format!(
            "real http.js excluded: {}",
            !body.contains("fetch('/api/todos')")
        ),
        format!("library shared through a chunk: {}", shared.is_match(&body)),
    ];
    assert_snapshot(
        "preview-bundle",
        &response_transcript(path, &answer, &report.join("\n")),
    );
}

#[test]
fn preview_renders_scenarios_in_a_browser() {
    if !has_browser() {
        return;
    }
    let server = start_preview(&fixture("preview"), &[]);
    let project = TempDir::new();
    let report = spec_report(
        &project.path,
        &fixture("preview-specs/preview-browser.spec.js"),
        &format!("http://127.0.0.1:{}", server.port),
    );
    assert_snapshot("preview-browser", &format!("{report}\n"));
}

#[test]
fn preview_output_writes_the_element_script_and_the_group_bundles() {
    let outdir = TempDir::new();
    let output = outdir.join("gallery");
    let result = run_imp(
        &["preview", "--output", &output.to_string_lossy()],
        &fixture("preview"),
    );
    let files = list_files(&output);
    let read_or_empty = |name: &str| std::fs::read_to_string(output.join(name)).unwrap_or_default();
    let script = read_or_empty("imp-preview.js");
    let app = read_or_empty("app.js");
    let chunk = files
        .iter()
        .find(|name| name.starts_with("chunks/"))
        .cloned();
    let widgets = read_or_empty("groups/widgets.js");
    let licenses = read_or_empty("LICENSES.txt");
    let chunk_text = chunk
        .as_ref()
        .map(|name| read_or_empty(name))
        .unwrap_or_default();
    let page = Regex::new(r#"\(\{"page":("(?:[^"\\]|\\.)*")"#)
        .unwrap()
        .captures(&script)
        .and_then(|caps| serde_json::from_str::<String>(&caps[1]).ok())
        .unwrap_or_default();
    let relative = posix(
        outdir
            .path
            .strip_prefix(fixture("preview"))
            .unwrap_or(&outdir.path),
    );
    let shown_out = imp::paths::relative_posix(&fixture("preview"), &outdir.path);
    let size = Regex::new(r"\(\d+(\.\d+)? [kM]?B\)").unwrap();
    let chunk_name = Regex::new(r"chunks/[\w-]+\.js").unwrap();
    let mut stdout = result
        .stdout
        .replace(&shown_out, "<out>")
        .replace(&relative, "<out>");
    stdout = size.replace_all(&stdout, "(<size>)").into_owned();
    stdout = chunk_name
        .replace_all(&stdout, "chunks/<name>-<hash>.js")
        .into_owned();
    let mut listed: Vec<String> = files
        .iter()
        .map(|name| {
            if name.starts_with("chunks/") {
                "chunks/<name>-<hash>.js".to_string()
            } else {
                name.clone()
            }
        })
        .collect();
    listed.sort();
    let report = [
        transcript(
            "imp preview --output <out>/gallery  (cwd: /tests/fixtures/preview)",
            &Run {
                code: result.code,
                stdout,
                stderr: result.stderr.clone(),
            },
        ),
        section("files", &listed.join("\n")),
        section(
            "imp-preview.js",
            &[
                format!(
                    "defines the element: {}",
                    script.contains("customElements.define(element, ImpPreview)")
                ),
                format!(
                    "element name: {}",
                    Regex::new(r#""element":"([^"]+)""#)
                        .unwrap()
                        .captures(&script)
                        .map(|caps| caps[1].to_string())
                        .unwrap_or_default()
                ),
                format!(
                    "finds the app next to itself: {}",
                    script.contains("const APP = new URL('./app.js', import.meta.url).href")
                ),
                format!(
                    "shows the page in a blob url frame: {}",
                    script.contains("URL.createObjectURL(new Blob([pageSource()]")
                ),
                format!(
                    "mirrors the route to the address of the page: {}",
                    script.contains("history.replaceState(")
                ),
                format!(
                    "follows the address of the page: {}",
                    script.contains("addEventListener('hashchange'")
                ),
                format!(
                    "entry page kept: {}",
                    page.contains("font-family: 'Fixture Sans'")
                ),
                format!(
                    "title: {}",
                    Regex::new(r"<title>([^<]*)</title>")
                        .unwrap()
                        .captures(&page)
                        .map(|caps| caps[1].to_string())
                        .unwrap_or_default()
                ),
                format!(
                    "hash routing: {}",
                    page.contains("globalThis.__IMP_ENV__ = {\"IMP_ROUTING\":\"hash\"}")
                ),
                format!(
                    "loads the app by its address: {}",
                    page.contains("<script type=\"module\" src=\"imp-preview:app\">")
                ),
                format!("no dev server client: {}", !page.contains("/@imp/client")),
            ]
            .join("\n"),
        ),
        section(
            "app.js",
            &[
                format!(
                    "starts the chrome embedded: {}",
                    app.contains("embedded:!0")
                ),
                format!(
                    "catalog embedded: {}",
                    app.contains("components/counter.preview.js")
                ),
                format!(
                    "loads a group on demand: {}",
                    Regex::new(r#"import\(["'`]\./groups/widgets\.js["'`]\)"#)
                        .unwrap()
                        .is_match(&app)
                ),
                format!(
                    "library shared through a chunk: {}",
                    chunk
                        .as_ref()
                        .is_some_and(|chunk| app.contains(&format!("./{chunk}")))
                ),
                format!("route bridge: {}", app.contains("imp-preview-route")),
                format!("no dev server address: {}", !app.contains("/@imp/preview/")),
            ]
            .join("\n"),
        ),
        section(
            "groups/widgets.js",
            &[
                format!("holds the counter: {}", widgets.contains("demo-counter")),
                format!("not the todos: {}", !widgets.contains("demo-todos")),
            ]
            .join("\n"),
        ),
        section(
            "LICENSES.txt",
            &[
                format!(
                    "carries the notice of imp: {}",
                    licenses.contains("imp@") && licenses.contains("MIT")
                ),
                format!(
                    "app.js points at it: {}",
                    app.starts_with("/*! Third-party license notices: LICENSES.txt */")
                ),
                format!(
                    "a chunk points one folder up: {}",
                    chunk_text.starts_with("/*! Third-party license notices: ../LICENSES.txt */")
                ),
            ]
            .join("\n"),
        ),
    ]
    .join("\n\n");
    assert_snapshot("preview-output", &format!("{report}\n"));
}

#[test]
fn preview_output_refuses_a_folder_that_holds_files_imp_did_not_write() {
    let outdir = TempDir::new();
    let folder = outdir.join("mine");
    write(&folder.join("notes.md"), "# notes\n");
    let refused = run_imp(
        &["preview", "--output", &folder.to_string_lossy()],
        &fixture("preview"),
    );
    check(
        refused.code == 1,
        "the export into a folder of other files did not fail",
    );
    check(
        refused
            .stderr
            .contains("holds files that imp did not write"),
        format!("unexpected error: {}", refused.stderr),
    );
    check(
        read(&folder.join("notes.md")) == "# notes\n",
        "the refused export deleted a file",
    );
    let components = run_imp(&["preview", "--output", "components"], &fixture("preview"));
    check(
        components.code == 1,
        "the export into the folder of the previews did not fail",
    );
    check(
        components
            .stderr
            .contains("must not contain a source of the project"),
        format!("unexpected error: {}", components.stderr),
    );
    let gallery = outdir.join("gallery");
    for round in [1, 2] {
        let result = run_imp(
            &["preview", "--output", &gallery.to_string_lossy()],
            &fixture("preview"),
        );
        check(
            result.code == 0,
            format!("export {round} failed: {}", result.stderr),
        );
    }
    check(
        gallery.join(".imp-output").is_file(),
        "the export wrote no marker",
    );
}

#[test]
fn the_exported_preview_embeds_in_a_page_and_shares_its_address() {
    if !has_browser() {
        return;
    }
    let site = TempDir::new();
    let exported = run_imp(
        &[
            "preview",
            "--output",
            &site.join("components").to_string_lossy(),
        ],
        &fixture("preview"),
    );
    check(
        exported.code == 0,
        format!("export failed: {}", exported.stderr),
    );
    let host = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>\n<h1>Host page</h1>\n<script type=\"module\" src=\"/components/imp-preview.js\"></script>\n<imp-preview style=\"block-size: 600px\"></imp-preview>\n</body></html>";
    let root = site.path.clone();
    let (base, _running) = serve_fn(move |path| {
        if path.ends_with(".js") {
            let bytes = std::fs::read(root.join(path.trim_start_matches('/'))).unwrap_or_default();
            (200, "text/javascript", bytes)
        } else {
            (200, "text/html", host.as_bytes().to_vec())
        }
    });
    let project = TempDir::new();
    let report = spec_report(
        &project.path,
        &fixture("preview-specs/preview-output-browser.spec.js"),
        &base,
    );
    assert_snapshot("preview-output-browser", &format!("{report}\n"));
}
