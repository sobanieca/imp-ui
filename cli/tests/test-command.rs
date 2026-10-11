mod support;

use support::*;

#[test]
fn test_command_transcripts() {
    let cases: [(&str, &[&str], &str); 26] = [
        ("test-unit-pass", &["test", "counter.test.js"], "test-unit"),
        ("test-fake-timers", &["test"], "test-fake-timers"),
        ("test-mock", &["test", "profile.test.js"], "test-mock"),
        ("test-unit-fail", &["test"], "test-fail"),
        (
            "test-unit-filter",
            &["test", "lib.test.js", "--filter", "adds"],
            "test-unit",
        ),
        ("test-choose-level", &["test"], "test-list"),
        ("test-unit-level", &["test", "--unit"], "test-unit"),
        (
            "test-unit-level-jobs",
            &["test", "--unit", "--jobs", "1"],
            "test-unit",
        ),
        ("test-unit-level-fail", &["test", "--unit"], "test-fail"),
        (
            "test-bad-jobs",
            &["test", "--unit", "--jobs", "0"],
            "test-unit",
        ),
        ("test-list-flag", &["test", "--list"], "test-list"),
        (
            "test-list-flag-e2e-only",
            &["test", "--e2e", "--list"],
            "test-list",
        ),
        ("test-not-a-test-file", &["test", "app.js"], "basic"),
        ("test-no-files", &["test"], "with-config"),
        (
            "test-missing-entry",
            &["test", "login.spec.js"],
            "test-list",
        ),
        ("preview-list", &["preview", "--list"], "preview"),
        (
            "preview-list-json",
            &["preview", "--list", "--json"],
            "preview",
        ),
        (
            "preview-list-inferred-sibling",
            &["preview", "components/counter.js", "--list"],
            "preview",
        ),
        (
            "preview-not-a-preview-file",
            &["preview", "http.js"],
            "preview",
        ),
        (
            "preview-path-not-found",
            &["preview", "missing.preview.js"],
            "preview",
        ),
        ("preview-none-found", &["preview"], "basic"),
        ("preview-theme-not-found", &["preview"], "preview-bad-theme"),
        (
            "preview-translations-not-found",
            &["preview"],
            "preview-bad-translations",
        ),
        (
            "preview-groups-not-found",
            &["preview"],
            "preview-bad-groups",
        ),
        ("preview-entry-not-found", &["preview"], "preview-bad-entry"),
        ("preview-bad-port", &["preview", "--port", "abc"], "preview"),
    ];
    for (name, args, cwd) in cases {
        if !has_browser() && args[0] == "test" && !args.contains(&"--list") {
            continue;
        }
        snapshot_command(name, args, Some(&fixture(cwd)));
    }
}

fn without_telemetry(mut run: Run) -> Run {
    run.stdout = run
        .stdout
        .lines()
        .filter(|line| !line.starts_with("[BROWSER:") && !line.starts_with("[HTTP]"))
        .collect::<Vec<_>>()
        .join("\n");
    run
}

#[test]
fn test_e2e() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    copy_directory(&fixture("test-e2e"), &dir.path);

    let result = run_imp(&["test"], &dir.path);
    let forwarded = result.stdout.contains("[BROWSER:log] counter clicked 2");
    assert_snapshot(
        "test-e2e-pass",
        &format!(
            "{}\n[browser log forwarded: {forwarded}]\n",
            transcript("imp test  (cwd: <tmp>)", &without_telemetry(result))
        ),
    );

    write(
        &dir.join("clock.spec.js"),
        "import { expect, test } from 'imp/test'\n\ntest('fakeTimers unavailable in e2e', ({ page }) => {\n  expect(page).toBeDefined()\n}, { fakeTimers: true })\n",
    );
    let result = run_imp(&["test", "clock.spec.js"], &dir.path);
    std::fs::remove_file(dir.join("clock.spec.js")).unwrap();
    assert_snapshot(
        "test-fake-timers-e2e-rejected",
        &transcript(
            "imp test clock.spec.js  (cwd: <tmp>)",
            &without_telemetry(result),
        ),
    );

    write(
        &dir.join("failing.spec.js"),
        "import { expect, test } from 'imp/test'\n\ntest('shows 999', async ({ page }) => {\n  const text = await page.$eval('#count', (element) => element.textContent)\n  expect(text).toBe('999')\n})\n",
    );
    let result = run_imp(
        &["test", "failing.spec.js", "--screenshots", "shots"],
        &dir.path,
    );
    std::fs::remove_file(dir.join("failing.spec.js")).unwrap();
    let screenshot = dir.join("shots/failing.spec.js-shows-999.png").is_file();
    assert_snapshot(
        "test-e2e-failure-screenshot",
        &format!(
            "{}\n[screenshot written: {screenshot}]\n",
            transcript(
                "imp test failing.spec.js --screenshots shots  (cwd: <tmp>)",
                &without_telemetry(result)
            )
        ),
    );

    write(
        &dir.join("imp.json"),
        "{\"mocks\":{\"folder\":\"mocks\",\"enabled\":false}}",
    );
    write(
        &dir.join("mocks/ping.mock.js"),
        "export const mocks = [{ match: (request) => request.path === '/api/ping', handler: () => ({ body: { pong: true } }) }]\n",
    );
    write(
        &dir.join("ping.spec.js"),
        "import { expect, test } from 'imp/test'\n\ntest('answers from a mocked endpoint', async ({ page }) => {\n  const body = await page.evaluate(() => fetch('/api/ping').then((response) => response.json()))\n  expect(body).toEqual({ pong: true })\n})\n",
    );
    let result = run_imp(
        &["test", "--e2e", "--mock", "--filter", "mocked"],
        &dir.path,
    );
    std::fs::remove_file(dir.join("ping.spec.js")).unwrap();
    std::fs::remove_dir_all(dir.join("mocks")).unwrap();
    std::fs::remove_file(dir.join("imp.json")).unwrap();
    check(
        result.code == 0 && result.stdout.contains("\u{2713} ping.spec.js"),
        format!(
            "the level run must forward --mock to every spec:\n{}\n{}",
            result.stdout, result.stderr
        ),
    );

    let result = run_imp(&["test", "counter.spec.js", "--video", "vids"], &dir.path);
    let bytes = std::fs::read(dir.join("vids/counter.spec.js.gif")).unwrap_or_default();
    let is_gif = bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a");
    assert_snapshot(
        "test-e2e-video",
        &format!(
            "{}\n[animated gif written: {}]\n",
            transcript(
                "imp test counter.spec.js --video vids  (cwd: <tmp>)",
                &without_telemetry(result)
            ),
            is_gif && !bytes.is_empty()
        ),
    );
}

#[test]
fn mock_module_mocks_a_module_with_a_string_export_name() {
    if !has_browser() {
        return;
    }
    let dir = TempDir::new();
    write(
        &dir.join("routes.js"),
        "const getItems = () => 'real items'\nconst internal = () => 'real internal'\nexport { getItems as 'GET /api/items', internal as __exports }\nexport const plain = 1\n",
    );
    write(
        &dir.join("routes.test.js"),
        "import { expect, mockModule, test } from 'imp/test'\nimport { 'GET /api/items' as getItems, __exports, plain } from './routes.js'\n\nmockModule('./routes.js', () => ({\n  'GET /api/items': () => 'mocked items',\n  __exports: () => 'mocked internal',\n  plain: 2,\n}))\n\ntest('the string export is mocked', () => {\n  expect(getItems()).toEqual('mocked items')\n  expect(__exports()).toEqual('mocked internal')\n  expect(plain).toEqual(2)\n})\n",
    );
    let result = run_imp(&["test", "routes.test.js"], &dir.path);
    check(
        result.code == 0,
        format!("imp test failed:\n{}\n{}", result.stdout, result.stderr),
    );
}
