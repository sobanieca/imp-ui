mod support;

use imp::dev_log::DevLog;
use std::io::Read;
use std::path::Path;
use std::process::Stdio;
use support::*;

#[test]
fn help() {
    snapshot_command("help", &[], None);
}

#[test]
fn help_command() {
    snapshot_command("help-command", &["help"], None);
}

#[test]
fn unknown_command() {
    snapshot_command("unknown-command", &["bogus"], None);
}

#[test]
fn skill_index() {
    snapshot_command("skill-index", &["skill"], None);
}

#[test]
fn skill_unknown_subject() {
    snapshot_command("skill-unknown-subject", &["skill", "bogus"], None);
}

#[test]
fn skill_std_component() {
    snapshot_command("skill-std-component", &["skill", "std/button"], None);
}

#[test]
fn skill_project_component() {
    snapshot_command(
        "skill-project-component",
        &["skill", "./counter.js"],
        Some(&fixture("skill-project")),
    );
}

#[test]
fn skill_missing_component() {
    snapshot_command(
        "skill-missing-component",
        &["skill", "./widget.js"],
        Some(&fixture("skill-project")),
    );
}

#[test]
fn map_prints_the_tree() {
    snapshot_command("map-prints-the-tree", &["map"], Some(&fixture("map")));
}

#[test]
fn map_prints_a_part() {
    snapshot_command(
        "map-prints-a-part",
        &["map", "src/admin/map.js"],
        Some(&fixture("map")),
    );
}

#[test]
fn map_without_a_map_export() {
    snapshot_command(
        "map-without-a-map-export",
        &["map", "src/no-map.js"],
        Some(&fixture("map")),
    );
}

#[test]
fn map_without_a_config_key() {
    snapshot_command(
        "map-without-a-config-key",
        &["map"],
        Some(&fixture("basic")),
    );
}

#[test]
fn map_missing_file() {
    snapshot_command(
        "map-missing-file",
        &["map", "src/elsewhere.js"],
        Some(&fixture("map")),
    );
}

#[test]
fn lint_clean() {
    snapshot_command(
        "lint-clean",
        &["lint", "app.js"],
        Some(&fixture("with-config")),
    );
}

#[test]
fn lint_vendored_imports() {
    snapshot_command(
        "lint-vendored-imports",
        &["lint", "app.js"],
        Some(&fixture("basic")),
    );
}

#[test]
fn lint_capital_component() {
    snapshot_command(
        "lint-capital-component",
        &["lint", "components.js"],
        Some(&fixture("lint-bad")),
    );
}

#[test]
fn lint_multiple_props_objects() {
    snapshot_command(
        "lint-multiple-props-objects",
        &["lint", "app.js"],
        Some(&fixture("lint-props")),
    );
}

#[test]
fn lint_state_name_namespace() {
    snapshot_command(
        "lint-state-name-namespace",
        &["lint", "app.js"],
        Some(&fixture("lint-state")),
    );
}

#[test]
fn lint_http_client_name_namespace() {
    snapshot_command(
        "lint-http-client-name-namespace",
        &["lint", "app.js"],
        Some(&fixture("lint-http-client")),
    );
}

#[test]
fn lint_analytics_names() {
    snapshot_command(
        "lint-analytics-names",
        &["lint", "src/main.js"],
        Some(&fixture("lint-analytics")),
    );
}

#[test]
fn lint_no_root_query_in_setup() {
    snapshot_command(
        "lint-no-root-query-in-setup",
        &["lint", "app.js"],
        Some(&fixture("lint-root-query")),
    );
}

#[test]
fn lint_watch_with_self() {
    snapshot_command(
        "lint-watch-with-self",
        &["lint", "app.js"],
        Some(&fixture("lint-watch")),
    );
}

#[test]
fn lint_self_first_argument() {
    snapshot_command(
        "lint-self-first-argument",
        &["lint", "app.js"],
        Some(&fixture("lint-self-first")),
    );
}

#[test]
fn lint_no_self_in_loading() {
    snapshot_command(
        "lint-no-self-in-loading",
        &["lint", "app.js"],
        Some(&fixture("lint-loading-self")),
    );
}

#[test]
fn lint_loading_with_async_setup() {
    snapshot_command(
        "lint-loading-with-async-setup",
        &["lint", "app.js"],
        Some(&fixture("lint-loading-sync")),
    );
}

#[test]
fn lint_on_remove_through_self() {
    snapshot_command(
        "lint-on-remove-through-self",
        &["lint", "app.js"],
        Some(&fixture("lint-on-remove")),
    );
}

#[test]
fn lint_no_self_at_module_scope() {
    snapshot_command(
        "lint-no-self-at-module-scope",
        &["lint", "app.js"],
        Some(&fixture("lint-module-scope")),
    );
}

#[test]
fn lint_abort_check_after_await() {
    snapshot_command(
        "lint-abort-check-after-await",
        &["lint", "app.js"],
        Some(&fixture("lint-abort-check")),
    );
}

#[test]
fn lint_no_state_as_child() {
    snapshot_command(
        "lint-no-state-as-child",
        &["lint", "app.js"],
        Some(&fixture("lint-state-child")),
    );
}

#[test]
fn lint_no_get_in_binding() {
    snapshot_command(
        "lint-no-get-in-binding",
        &["lint", "app.js"],
        Some(&fixture("lint-get-binding")),
    );
}

#[test]
fn lint_component_name() {
    snapshot_command(
        "lint-component-name",
        &["lint", "app.js"],
        Some(&fixture("lint-component")),
    );
}

#[test]
fn lint_import_source() {
    snapshot_command(
        "lint-import-source",
        &["lint", "app.js"],
        Some(&fixture("lint-import-source")),
    );
}

#[test]
fn lint_app_map_unique_params() {
    snapshot_command(
        "lint-app-map-unique-params",
        &["lint", "app-map.js"],
        Some(&fixture("lint-app-map")),
    );
}

#[test]
fn lint_icons_by_name() {
    snapshot_command(
        "lint-icons-by-name",
        &["lint", "app.js"],
        Some(&fixture("lint-icons")),
    );
}

#[test]
fn lint_accessible_names() {
    snapshot_command(
        "lint-accessible-names",
        &["lint", "app.js"],
        Some(&fixture("lint-accessible-names")),
    );
}

#[test]
fn lint_html_embedded_script() {
    snapshot_command(
        "lint-html-embedded-script",
        &["lint", "index.html"],
        Some(&fixture("lint-html")),
    );
}

#[test]
fn lint_dependency_errors() {
    snapshot_command(
        "lint-dependency-errors",
        &["lint", "app.js"],
        Some(&fixture("lint-unpinned")),
    );
}

#[test]
fn lint_ignore_directive() {
    snapshot_command(
        "lint-ignore-directive",
        &["lint", "app.js"],
        Some(&fixture("lint-ignore")),
    );
}

#[test]
fn lint_dead_code() {
    snapshot_command(
        "lint-dead-code",
        &["lint"],
        Some(&fixture("lint-dead-code")),
    );
}

#[test]
fn lint_path_not_found() {
    snapshot_command(
        "lint-path-not-found",
        &["lint", "missing.js"],
        Some(&fixture("basic")),
    );
}

#[test]
fn lint_invalid_imp_json() {
    snapshot_command(
        "lint-invalid-imp-json",
        &["lint", "app.js"],
        Some(&fixture("broken-config")),
    );
}

#[test]
fn fmt_check_clean() {
    snapshot_command(
        "fmt-check-clean",
        &["fmt", "--check", "app.js"],
        Some(&fixture("basic")),
    );
}

#[test]
fn fmt_check_dirty() {
    snapshot_command(
        "fmt-check-dirty",
        &["fmt", "--check", "messy.js"],
        Some(&fixture("fmt-dirty")),
    );
}

#[test]
fn fmt_check_multi_language() {
    snapshot_command(
        "fmt-check-multi-language",
        &["fmt", "--check"],
        Some(&fixture("fmt-multi")),
    );
}

#[test]
fn fmt_ignore_directive() {
    snapshot_command(
        "fmt-ignore-directive",
        &["fmt", "--check", "app.js"],
        Some(&fixture("fmt-ignore")),
    );
}

#[test]
fn fmt_path_not_found() {
    snapshot_command(
        "fmt-path-not-found",
        &["fmt", "missing.js"],
        Some(&fixture("basic")),
    );
}

#[test]
fn fmt_invalid_imp_json() {
    snapshot_command(
        "fmt-invalid-imp-json",
        &["fmt", "--check", "app.js"],
        Some(&fixture("broken-config")),
    );
}

#[test]
fn review_empty() {
    snapshot_command("review-empty", &["review"], Some(&fixture("basic")));
}

#[test]
fn review_unknown_argument() {
    snapshot_command(
        "review-unknown-argument",
        &["review", "bogus"],
        Some(&fixture("basic")),
    );
}

#[test]
fn logs_unknown_argument() {
    snapshot_command(
        "logs-unknown-argument",
        &["logs", "bogus"],
        Some(&fixture("basic")),
    );
}

#[test]
fn logs_bad_count() {
    snapshot_command(
        "logs-bad-count",
        &["logs", "-n", "abc"],
        Some(&fixture("basic")),
    );
}

#[test]
fn resize_guidance() {
    snapshot_command(
        "resize-guidance",
        &["resize", "logo.png"],
        Some(&fixture("resize")),
    );
}

#[test]
fn resize_usage() {
    snapshot_command("resize-usage", &["resize"], Some(&fixture("resize")));
}

#[test]
fn resize_unsupported_format() {
    snapshot_command(
        "resize-unsupported-format",
        &["resize", "photo.bmp", "-w", "100"],
        Some(&fixture("resize")),
    );
}

#[test]
fn resize_webp_deferred() {
    snapshot_command(
        "resize-webp-deferred",
        &["resize", "hero.webp", "-w", "100"],
        Some(&fixture("resize")),
    );
}

#[test]
fn resize_missing_file() {
    snapshot_command(
        "resize-missing-file",
        &["resize", "missing.png", "-w", "100"],
        Some(&fixture("resize")),
    );
}

#[test]
fn resize_bad_dimension() {
    snapshot_command(
        "resize-bad-dimension",
        &["resize", "logo.png", "-w", "abc"],
        Some(&fixture("resize")),
    );
}

#[test]
fn resize_upscale_clamped() {
    snapshot_command(
        "resize-upscale-clamped",
        &["resize", "logo.png", "-w", "9000"],
        Some(&fixture("resize")),
    );
}

#[test]
fn resize_stretch_requires_both() {
    snapshot_command(
        "resize-stretch-requires-both",
        &["resize", "logo.png", "-w", "100", "--stretch"],
        Some(&fixture("resize")),
    );
}

fn transcripts(parts: &[(&str, &Run)]) -> String {
    parts
        .iter()
        .map(|(display, run)| transcript(display, run))
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn logs_no_log() {
    let dir = TempDir::new();
    write(&dir.join("imp.json"), "{}\n");
    std::fs::create_dir_all(dir.join("src")).unwrap();
    let result = run_imp(&["logs"], &dir.join("src"));
    write(&dir.join("lib/src/.imp/dev.log"), "[INFO] preview\n");
    write(&dir.join("node_modules/pkg/.imp/dev.log"), "hidden\n");
    let nested = run_imp(&["logs"], &dir.join("src"));
    let tmp = dir.text();
    let result = result.replace(&tmp, "<tmp>");
    let nested = nested.replace(&tmp, "<tmp>");
    assert_snapshot(
        "logs-no-log",
        &transcripts(&[
            ("imp logs  (cwd: <tmp>/src)", &result),
            ("imp logs  (cwd: <tmp>/src, log in lib/src)", &nested),
        ]),
    );
}

#[test]
fn logs_prints_the_session() {
    let dir = TempDir::new();
    write(&dir.join("imp.json"), "{}\n");
    std::fs::create_dir_all(dir.join("src")).unwrap();
    let entries = [
        "2026-10-27T13:44:23.300Z [INFO] imp start serving index.html",
        "2026-10-27T13:44:24.012Z [BROWSER:log] counter mounted",
        "2026-10-27T13:44:24.105Z [HTTP] GET /api/todos -> 200 12ms",
        "2026-10-27T13:44:25.871Z [BROWSER:error] Uncaught TypeError: x is not a function",
    ];
    write(
        &dir.join(".imp/dev.log"),
        &format!("{}\n", entries.join("\n")),
    );
    let whole = run_imp(&["logs"], &dir.path);
    let last = run_imp(&["logs", "-n", "2"], &dir.join("src"));
    let more = run_imp(&["logs", "-n", "10"], &dir.path);
    assert_snapshot(
        "logs-prints-the-session",
        &transcripts(&[
            ("imp logs  (cwd: <tmp>)", &whole),
            ("imp logs -n 2  (cwd: <tmp>/src)", &last),
            ("imp logs -n 10  (cwd: <tmp>)", &more),
        ]),
    );
}

fn is_utc_timestamp(text: &str) -> bool {
    let pattern = "dddd-dd-ddTdd:dd:dd.dddZ";
    text.len() == pattern.len()
        && text.chars().zip(pattern.chars()).all(|(char, expected)| {
            if expected == 'd' {
                char.is_ascii_digit()
            } else {
                char == expected
            }
        })
}

fn without_timestamps(text: &str) -> String {
    text.lines()
        .map(|line| match line.split_once(' ') {
            Some((stamp, entry)) if is_utc_timestamp(stamp) => format!("{entry}\n"),
            _ => format!("{line} (no timestamp)\n"),
        })
        .collect()
}

#[test]
fn logs_follows_the_session() {
    let dir = TempDir::new();
    write(&dir.join("imp.json"), "{ \"maxLogEntries\": 3 }\n");
    let dev_log = DevLog::create(&dir.path, 3).unwrap();
    dev_log.write("first");
    dev_log.write("second");
    let mut child = imp_command(&dir.path)
        .args(["logs", "-f"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdout = child.stdout.take().unwrap();
    let mut output = String::new();
    let mut read_until = |text: &str, output: &mut String| {
        while !output.contains(text) {
            let mut buffer = [0u8; 256];
            let count = stdout.read(&mut buffer).unwrap_or(0);
            if count == 0 {
                break;
            }
            output.push_str(&String::from_utf8_lossy(&buffer[..count]));
        }
    };
    read_until("second\n", &mut output);
    let later: Vec<String> = (1..=9).map(|index| format!("entry {index}")).collect();
    for entry in &later {
        dev_log.write(entry);
        read_until(&format!("{entry}\n"), &mut output);
    }
    std::process::Command::new("kill")
        .args(["-INT", &child.id().to_string()])
        .status()
        .unwrap();
    let status = child.wait().unwrap();
    dev_log.close();
    let mut stderr = String::new();
    child
        .stderr
        .take()
        .unwrap()
        .read_to_string(&mut stderr)
        .unwrap();
    let final_log = read(&dir.join(".imp/dev.log"));
    let mut expected = vec!["first".to_string(), "second".to_string()];
    expected.extend(later);
    check(
        without_timestamps(&output) == format!("{}\n", expected.join("\n")),
        format!("imp logs -f printed every entry once and in order:\n{output}"),
    );
    check(
        stderr.is_empty(),
        format!("imp logs -f wrote nothing to stderr:\n{stderr}"),
    );
    check(
        status.code() == Some(0),
        format!("imp logs -f exits 0 on Ctrl-C, got {status:?}"),
    );
    check(
        without_timestamps(&final_log) == "entry 5\nentry 6\nentry 7\nentry 8\nentry 9\n",
        format!("the log was rewritten in place while it was followed:\n{final_log}"),
    );
}

#[test]
fn init_scaffold() {
    let dir = TempDir::new();
    let created = run_imp(&["init", "app", "--font", "sora"], &dir.path);
    let project = dir.join("app");
    let files = list_files(&project);
    let mut sources = Vec::new();
    for file in &files {
        if [".svg", ".woff2", ".txt"]
            .iter()
            .any(|extension| file.ends_with(extension))
        {
            continue;
        }
        sources.push(format!(
            "--- {file} ---\n{}",
            read(&project.join(file)).replace(VERSION, "<version>")
        ));
    }
    let again = run_imp(&["init", "--font", "sora"], &project);
    assert_snapshot(
        "init-scaffold",
        &format!(
            "{}\n--- files ---\n{}\n\n{}\n{}",
            transcript("imp init app --font sora  (cwd: <tmp>)", &created),
            files.join("\n"),
            sources.join("\n"),
            transcript("imp init --font sora  (cwd: <tmp>/app)", &again)
        ),
    );
}

#[test]
fn init_merges_existing_gitignore() {
    let dir = TempDir::new();
    let existing = "# my stuff\nnode_modules\n*.log\n.env*\n/dist\n.DS_Store\n";
    write(&dir.join(".gitignore"), existing);
    let merged = run_imp(&["init", "--font", "inter"], &dir.path);
    let after_merge = read(&dir.join(".gitignore"));
    let covered = TempDir::new();
    write(&covered.join(".gitignore"), &after_merge);
    let again = run_imp(&["init", "--font", "inter"], &covered.path);
    let after_second = read(&covered.join(".gitignore"));
    assert_snapshot(
        "init-merges-existing-gitignore",
        &format!(
            "--- existing .gitignore ---\n{existing}\n{}\n--- merged .gitignore ---\n{after_merge}\n{}\n--- .gitignore after the second run (unchanged) ---\n{after_second}",
            transcript("imp init --font inter  (cwd: <tmp>)", &merged),
            transcript(
                "imp init --font inter  (cwd: <tmp2>, already covered)",
                &again
            )
        ),
    );
}

#[test]
fn init_pwa_scaffold() {
    let parent = TempDir::new();
    let dir = parent.join("my-shop");
    std::fs::create_dir_all(&dir).unwrap();
    let created = run_imp(&["init", "--pwa", "--font", "work-sans"], &dir);
    let files = list_files(&dir);
    let config = read(&dir.join("imp.json")).replace(VERSION, "<version>");
    assert_snapshot(
        "init-pwa-scaffold",
        &format!(
            "{}\n--- files ---\n{}\n\n--- imp.json ---\n{config}",
            transcript(
                "imp init --pwa --font work-sans  (cwd: <tmp>/my-shop)",
                &created
            ),
            files.join("\n")
        ),
    );
}

#[test]
fn init_font_flag_errors() {
    let dir = TempDir::new();
    let unknown = run_imp(&["init", "app", "--font", "comic-sans"], &dir.path);
    let missing = run_imp(&["init", "app", "--font"], &dir.path);
    let files = list_files(&dir.path);
    assert_snapshot(
        "init-font-flag-errors",
        &format!(
            "{}\n{}\n--- files ---\n{}\n",
            transcript("imp init app --font comic-sans  (cwd: <tmp>)", &unknown),
            transcript("imp init app --font  (cwd: <tmp>)", &missing),
            if files.is_empty() {
                "(none)".to_string()
            } else {
                files.join("\n")
            }
        ),
    );
}

#[test]
fn init_project_passes_lint_fmt_and_tests() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    run_imp(&["init", "app"], &dir.path);
    let project = dir.join("app");
    let lint = run_imp(&["lint"], &project);
    let fmt = run_imp(&["fmt", "--check"], &project);
    let unit = run_imp(&["test", "--unit"], &project);
    assert_snapshot(
        "init-project-passes-lint-fmt-and-tests",
        &transcripts(&[
            ("imp lint  (cwd: <tmp>/app)", &lint),
            ("imp fmt --check  (cwd: <tmp>/app)", &fmt),
            ("imp test --unit  (cwd: <tmp>/app)", &unit),
        ]),
    );
}

#[test]
fn resize_writes_file() {
    let dir = TempDir::new();
    std::fs::copy(fixture("resize").join("logo.png"), dir.join("logo.png")).unwrap();
    let in_place = run_imp(&["resize", "logo.png", "-w", "150"], &dir.path);
    let copy = run_imp(
        &["resize", "logo.png", "-h", "30", "--output", "small.png"],
        &dir.path,
    );
    let box_fit = run_imp(
        &[
            "resize", "logo.png", "-w", "100", "-h", "100", "--output", "box.png",
        ],
        &dir.path,
    );
    let stretched = run_imp(
        &[
            "resize",
            "logo.png",
            "-w",
            "100",
            "-h",
            "100",
            "--stretch",
            "--output",
            "stretched.png",
        ],
        &dir.path,
    );
    assert_snapshot(
        "resize-writes-file",
        &format!(
            "{}\n--- overwritten source ---\n{}\n\n{}\n--- sibling output ---\n{}\n\n{}\n--- box-fit output ---\n{}\n\n{}\n--- stretched output ---\n{}",
            transcript("imp resize logo.png -w 150  (cwd: <tmp>)", &in_place),
            png_size(&dir.join("logo.png")),
            transcript(
                "imp resize logo.png -h 30 --output small.png  (cwd: <tmp>)",
                &copy
            ),
            png_size(&dir.join("small.png")),
            transcript(
                "imp resize logo.png -w 100 -h 100 --output box.png  (cwd: <tmp>)",
                &box_fit
            ),
            png_size(&dir.join("box.png")),
            transcript(
                "imp resize logo.png -w 100 -h 100 --stretch --output stretched.png  (cwd: <tmp>)",
                &stretched
            ),
            png_size(&dir.join("stretched.png"))
        ),
    );
}

fn lint_fix_twice(name: &str, source: &Path) {
    let dir = TempDir::new();
    let file = dir.join("app.js");
    std::fs::copy(source, &file).unwrap();
    let result = run_imp(&["lint", "--fix", "app.js"], &dir.path);
    let fixed = read(&file);
    let again = run_imp(&["lint", "--fix", "app.js"], &dir.path);
    let after = read(&file);
    assert_snapshot(
        name,
        &format!(
            "{}\n--- fixed file ---\n{fixed}\n--- second run (idempotent) ---\n{}\n--- file after second run ---\n{after}",
            transcript("imp lint --fix app.js  (cwd: <tmp>)", &result),
            transcript("imp lint --fix app.js  (cwd: <tmp>)", &again)
        ),
    );
}

#[test]
fn lint_fix_writes_file() {
    lint_fix_twice("lint-fix-writes-file", &fixture("lint-fix").join("app.js"));
}

#[test]
fn lint_fix_import_source() {
    lint_fix_twice(
        "lint-fix-import-source",
        &fixture("lint-import-source").join("app.js"),
    );
}

#[test]
fn lint_fix_html() {
    let dir = TempDir::new();
    let file = dir.join("index.html");
    std::fs::copy(fixture("lint-fix").join("index.html"), &file).unwrap();
    let result = run_imp(&["lint", "--fix", "index.html"], &dir.path);
    assert_snapshot(
        "lint-fix-html",
        &format!(
            "{}\n--- fixed file ---\n{}",
            transcript("imp lint --fix index.html  (cwd: <tmp>)", &result),
            read(&file)
        ),
    );
}

#[test]
fn lint_file_size_limit() {
    let dir = TempDir::new();
    git(&dir.path, &["init", "-q"]);
    write(&dir.join("app.js"), "console.log('ok')\n");
    write(&dir.join("big.txt"), &"x".repeat(300 * 1024));
    write(&dir.join("huge.bin"), &"y".repeat(300 * 1024));
    git(&dir.path, &["add", "-A"]);
    let oversized = run_imp(&["lint", "app.js"], &dir.path);
    write(
        &dir.join("imp.json"),
        "{ \"maxFileSizeIgnore\": [\"huge.bin\"] }\n",
    );
    let partially = run_imp(&["lint", "app.js"], &dir.path);
    write(&dir.join("imp.json"), "{ \"maxFileSize\": 400000 }\n");
    let raised = run_imp(&["lint", "app.js"], &dir.path);
    assert_snapshot(
        "lint-file-size-limit",
        &format!(
            "--- oversized (default limit) ---\n{}\n--- one path ignored ---\n{}\n--- limit raised ---\n{}",
            transcript("imp lint app.js  (cwd: <tmp>)", &oversized),
            transcript("imp lint app.js  (cwd: <tmp>)", &partially),
            transcript("imp lint app.js  (cwd: <tmp>)", &raised)
        ),
    );
}

#[test]
fn lint_dead_code_escape_hatches() {
    let dir = TempDir::new();
    write(
        &dir.join("index.html"),
        "<!doctype html>\n<script type=\"module\" src=\"/src/app.js\"></script>\n",
    );
    write(
        &dir.join("src/app.js"),
        "import { used } from './lib.js'\n\nconsole.log(used)\n",
    );
    write(
        &dir.join("src/lib.js"),
        "export const used = 1\n\nexport const external = 2\n",
    );
    write(
        &dir.join("src/sdk.js"),
        "export * from './sdk-core.js'\n\nexport const open = () => 'ok'\n",
    );
    write(&dir.join("src/sdk-core.js"), "export const connect = 1\n");
    let reported = run_imp(&["lint"], &dir.path);
    write(
        &dir.join("imp.json"),
        "{ \"lint\": { \"publicExports\": [\"src/sdk.js\", \"src/lib.js#external\"] } }\n",
    );
    let granted = run_imp(&["lint"], &dir.path);
    write(&dir.join("src/never.js"), "export const gone = 3\n");
    write(
        &dir.join("src/app.js"),
        "import { used } from './lib.js'\n\nexport const load = (name) => import(name)\n\nconsole.log(used)\n",
    );
    let computed = run_imp(&["lint"], &dir.path);
    std::fs::create_dir_all(dir.join("src/pages")).unwrap();
    std::fs::rename(dir.join("src/never.js"), dir.join("src/pages/home.js")).unwrap();
    write(
        &dir.join("src/app.js"),
        "import { used } from './lib.js'\n\nexport const load = (name) => import(`./pages/${name}.js`)\n\nconsole.log(used)\n",
    );
    let folder = run_imp(&["lint"], &dir.path);
    assert_snapshot(
        "lint-dead-code-escape-hatches",
        &format!(
            "--- reported ---\n{}\n--- publicExports ---\n{}\n--- computed dynamic import ---\n{}\n--- folder named in a template ---\n{}",
            transcript("imp lint  (cwd: <tmp>)", &reported),
            transcript("imp lint  (cwd: <tmp>)", &granted),
            transcript("imp lint  (cwd: <tmp>)", &computed),
            transcript("imp lint  (cwd: <tmp>)", &folder)
        ),
    );
}

#[test]
fn fmt_writes_file() {
    let dir = TempDir::new();
    let file = dir.join("messy.js");
    write(
        &file,
        "const  a=1;\nconst   double=(x)=>x*2\nexport { a,double }\n",
    );
    let result = run_imp(&["fmt", "messy.js"], &dir.path);
    assert_snapshot(
        "fmt-writes-file",
        &format!(
            "{}\n--- formatted file ---\n{}",
            transcript("imp fmt messy.js  (cwd: <tmp>)", &result),
            read(&file)
        ),
    );
}
