mod support;

use imp::environments::{env_injection_script, resolve_environment_in};
use imp::start::{inject_imp, resolve_within_root};
use regex::Regex;
use serde_json::{Value, json};
use std::collections::HashMap;
use support::*;

#[test]
fn start_warns_about_missing_vendored_dependency() {
    let server = start_dev(&fixture("with-config"), &[]);
    let banner = normalize(&server.banner).replace(&format!(":{}", server.port), ":<port>");
    assert_snapshot("start-missing-dependency-warning", &banner);
}

#[test]
fn start_warns_about_an_entry_copy_in_public() {
    let dir = TempDir::new();
    copy_directory(&fixture("basic"), &dir.path);
    write(&dir.join("public/index.html"), "<h1>public copy</h1>\n");
    let server = start_dev(&dir.path, &[]);
    let banner = normalize(&server.banner)
        .replace(&format!(":{}", server.port), ":<port>")
        .replace(&dir.text(), "<tmp>");
    let served = get(server.port, "/").text();
    let source = if served.contains("public copy") { "public/index.html" } else { "index.html" };
    assert_snapshot("start-public-entry-warning", &format!("{banner}\nGET / serves {source}\n"));
}

#[test]
fn an_injected_value_cannot_end_its_script() {
    let mut values = serde_json::Map::new();
    values.insert("NOTE".into(), Value::from("a </script><script>alert(1)</script> <!-- b"));
    let tag = env_injection_script(&values);
    let inner = &tag["<script>".len()..tag.len() - "</script>".len()];
    let lower = inner.to_ascii_lowercase();
    check(!lower.contains("</script") && !lower.contains("<!--"), format!("the value escaped its script: {tag}"));
    let json_text = inner.split_once(" = ").map(|(_, value)| value).unwrap_or("");
    let parsed: Value = serde_json::from_str(json_text.trim_end_matches(';')).unwrap();
    check(parsed["NOTE"] == "a </script><script>alert(1)</script> <!-- b", "the value changed");
}

#[test]
fn inject_imp_into_documents() {
    let head = "<script>imp-injection</script>";
    let cases = [
        ("document with head", "<html>\n<head>\n<title>x</title>\n</head>\n<body></body>\n</html>"),
        ("document without head", "<html>\n<body>no head here</body>\n</html>"),
        ("bare fragment", "<h1>fragment</h1>"),
        (
            "already injected",
            "<html>\n<head><script type=\"importmap\">{\"imports\":{\"imp\":\"/@imp/imp.js\"}}</script></head>\n<body></body>\n</html>",
        ),
    ];
    let transcript: Vec<String> = cases
        .iter()
        .map(|(label, html)| {
            format!("=== {label} ===\n{}\n{}\n", section("input", html), section("output", &inject_imp(html, head)))
        })
        .collect();
    assert_snapshot("inject-imp", &transcript.join("\n"));
}

#[test]
fn resolve_within_root_keeps_requests_inside() {
    let dir = TempDir::new();
    let root = dir.join("app");
    let requests = [
        "/index.html",
        "/sub/page.js",
        "/",
        "/sub/",
        "/.git/config",
        "/.git/HEAD",
        "/node_modules/pkg/index.js",
        "/dist/app.js",
        "/.imp/dev.log",
        "/sub/.git/config",
        "/dependencies/lodash/lodash.js",
        "/.well-known/assetlinks.json",
        "/../outside.txt",
        "/%2e%2e%2fapp-secrets/keys.env",
        "/%2e%2e%2f%2e%2e%2fetc/passwd",
        "/..%2f..%2fetc/passwd",
        "/sub/%2e%2e%2f%2e%2e%2foutside.txt",
        "/%",
    ];
    let lines: Vec<String> = requests
        .iter()
        .map(|request| {
            let pathname = if *request == "/../outside.txt" { "/outside.txt" } else { request };
            let where_ = match resolve_within_root(&root, pathname) {
                Some((_, fs_path)) => posix(fs_path.strip_prefix(&root).unwrap_or(&fs_path)),
                None => "forbidden".into(),
            };
            format!("{request:<36} {where_}")
        })
        .collect();
    assert_snapshot("resolve-within-root", &format!("{}\n", lines.join("\n")));
}

#[test]
fn resolve_environment_from_files() {
    let dir = TempDir::new();
    write(&dir.join("dev.json"), r#"{"API_URL":"https://dev.example.com","FEATURE":false}"#);
    write(
        &dir.join("prod.json"),
        r#"{"API_URL":"https://api.example.com","TOKEN":"$env.IMP_TEST_TOKEN","COUNT":3}"#,
    );
    write(&dir.join("nested.json"), r#"{"obj":{"a":1}}"#);
    write(&dir.join("array.json"), "[1,2]");
    write(&dir.join("broken.json"), "{ not json");
    write(
        &dir.join("prod.env"),
        &[
            "# production values",
            "API_URL=https://api.example.com  # inline comment",
            "export TOKEN=$env.IMP_TEST_TOKEN",
            "GREETING=\"hello world\"",
            "RAW='keep $env.NOT_EXPANDED literal'",
            "FEATURE=true",
            "",
        ]
        .join("\n"),
    );
    let config = json!({ "environments": {
        "dev": "dev.json", "prod": "prod.json", "default": "dev.json", "nested": "nested.json",
        "array": "array.json", "broken": "broken.json", "missingFile": "nope.json", "dotenv": "prod.env",
    }});
    let run = |label: &str, config: &Value, requested: Option<&str>, imp_env: Option<&str>, token: Option<&str>| {
        let mut shell = HashMap::new();
        if let Some(value) = imp_env {
            shell.insert("IMP_ENV".to_string(), value.to_string());
        }
        if let Some(value) = token {
            shell.insert("IMP_TEST_TOKEN".to_string(), value.to_string());
        }
        let lookup = move |name: &str| shell.get(name).cloned();
        let outcome = match resolve_environment_in(&dir.path, config.as_object().unwrap(), requested, &lookup) {
            Ok(resolved) => format!("ok: {}", Value::Object(resolved)),
            Err(error) => format!("error: {error}"),
        };
        format!("=== {label} ===\n{outcome}\n")
    };
    let empty = json!({});
    let without_default = json!({ "environments": { "dev": "dev.json" } });
    let mut values = serde_json::Map::new();
    values.insert("API_URL".into(), "x".into());
    values.insert("N".into(), 1.into());
    let transcript = [
        run("no selection uses default alias", &config, None, None, None),
        run("explicit dev alias", &config, Some("dev"), None, None),
        run("explicit prod with token set", &config, Some("prod"), None, Some("sekret")),
        run("prod with unset shell variable", &config, Some("prod"), None, None),
        run("IMP_ENV selects the alias", &config, None, Some("prod"), Some("ci-token")),
        run("flag overrides IMP_ENV", &config, Some("dev"), Some("prod"), None),
        run("unknown alias", &config, Some("staging"), None, None),
        run("referenced file missing", &config, Some("missingFile"), None, None),
        run("array file rejected", &config, Some("array"), None, None),
        run("nested value rejected", &config, Some("nested"), None, None),
        run("malformed json rejected", &config, Some("broken"), None, None),
        run("dotenv file parsed", &config, Some("dotenv"), None, Some("env-token")),
        run("no environments block returns empty", &empty, None, None, None),
        run("environments without default and no selection", &without_default, None, None, None),
        format!(
            "=== envInjectionScript empty ===\n{}\n",
            Value::from(env_injection_script(&serde_json::Map::new()))
        ),
        format!("=== envInjectionScript with values ===\n{}\n", env_injection_script(&values)),
    ];
    assert_snapshot("resolve-environment", &transcript.join("\n"));
}

fn env_line(html: &str) -> String {
    Regex::new(r"globalThis\.__IMP_ENV__ = [^<\n]*")
        .unwrap()
        .find(html)
        .map(|found| found.as_str().to_string())
        .unwrap_or_else(|| "(none injected)".into())
}

fn write_config(dir: &TempDir, config: &Value) {
    write(&dir.join("imp.json"), &format!("{}\n", serde_json::to_string_pretty(config).unwrap()));
}

fn built_html(dir: &TempDir) -> String {
    let dist = dir.join("dist");
    std::fs::read_to_string(dist.join("index.html"))
        .map(|html| with_built_scripts(&dist, &html))
        .unwrap_or_default()
}

#[test]
fn build_and_start_with_environments() {
    let dir = TempDir::new();
    write(
        &dir.join("index.html"),
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<title>env app</title>\n</head>\n<body>\n<div id=\"app\"></div>\n<script type=\"module\" src=\"/app.js\"></script>\n</body>\n</html>\n",
    );
    write(&dir.join("app.js"), "import { env } from 'imp'\nexport const apiUrl = env.API_URL\n");
    write(
        &dir.join("env/dev.json"),
        &serde_json::to_string_pretty(&json!({ "API_URL": "https://dev.example.com", "FEATURE_ANALYTICS": false })).unwrap(),
    );
    write(
        &dir.join("env/prod.json"),
        &serde_json::to_string_pretty(&json!({ "API_URL": "https://api.example.com", "TOKEN": "$env.IMP_DEMO_TOKEN" })).unwrap(),
    );
    let environments = json!({ "environments": { "dev": "env/dev.json", "prod": "env/prod.json", "default": "env/dev.json" } });
    write_config(&dir, &environments);
    let build = |args: &[&str], env: &[(&str, &str)]| {
        let mut command = imp_command(&dir.path);
        command.args(args).env_remove("IMP_ENV").envs(env.iter().copied());
        let output = command.output().unwrap();
        Run {
            code: output.status.code().unwrap_or(-1),
            stdout: normalize(&String::from_utf8_lossy(&output.stdout)),
            stderr: normalize(&String::from_utf8_lossy(&output.stderr)),
        }
    };

    let result = build(&["build"], &[]);
    let html = built_html(&dir);
    let copied = dir.join("dist/env/dev.json").exists();
    assert_snapshot(
        "env-build-default",
        &format!(
            "{}\n{}\n\n[env file copied into dist: {copied}]\n",
            mask(&transcript("imp build  (cwd: <tmp>)", &result), &dir),
            section("injected env", &env_line(&html))
        ),
    );

    let result = build(&["build", "--env", "prod"], &[("IMP_DEMO_TOKEN", "prod-secret")]);
    let html = built_html(&dir);
    assert_snapshot(
        "env-build-selected",
        &format!(
            "{}\n{}\n",
            mask(&transcript("imp build --env prod  (cwd: <tmp>)", &result), &dir),
            section("injected env", &env_line(&html))
        ),
    );

    let result = build(&["build", "--env", "prod"], &[]);
    assert_snapshot("env-build-missing-variable", &mask(&transcript("imp build --env prod  (cwd: <tmp>)", &result), &dir));

    let result = build(&["build", "--env", "staging"], &[]);
    assert_snapshot("env-build-unknown-alias", &mask(&transcript("imp build --env staging  (cwd: <tmp>)", &result), &dir));

    write_config(&dir, &json!({ "environments": 5 }));
    let result = build(&["build"], &[]);
    write_config(&dir, &environments);
    assert_snapshot("env-build-invalid-config", &mask(&transcript("imp build  (cwd: <tmp>)", &result), &dir));

    let server = start_dev(&dir.path, &["--env", "dev"]);
    let html = get(server.port, "/").text();
    assert_snapshot("env-start-injected", &format!("{}\n", section("injected env", &env_line(&html))));
}

fn globals_in(html: &str) -> String {
    Regex::new(r"globalThis\.__IMP_[A-Z_]+ = [^<\n]*")
        .unwrap()
        .find_iter(html)
        .map(|found| found.as_str().to_string())
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn build_and_start_with_build_flags() {
    let dir = TempDir::new();
    write(
        &dir.join("index.html"),
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<title>flag app</title>\n</head>\n<body>\n<div id=\"app\"></div>\n<script type=\"module\" src=\"/app.js\"></script>\n</body>\n</html>\n",
    );
    write(&dir.join("checkout.js"), "export const newCheckout = () => 'NEW-CHECKOUT-CODE'\n");
    let app_source = [
        "import { env, flag } from 'imp'",
        "",
        "if (flag('CHECKOUT_V2')) {",
        "  const { newCheckout } = await import('./checkout.js')",
        "  console.log(newCheckout())",
        "}",
        "export const nav = flag('NEW_NAV') ? 'NAV-NEXT' : 'NAV-CLASSIC'",
        "export const apiUrl = env.API_URL",
        "",
    ]
    .join("\n");
    write(&dir.join("app.js"), &app_source);
    write(&dir.join("env/dev.json"), r#"{"API_URL":"https://dev.example.com","CHECKOUT_V2":true,"NEW_NAV":true}"#);
    write(&dir.join("env/prod.json"), r#"{"API_URL":"https://api.example.com","CHECKOUT_V2":false}"#);
    write(&dir.join("env/stage.env"), "CHECKOUT_V2=false\nNEW_NAV=true\n");
    write(&dir.join("env/broken.json"), r#"{"NEW_NAV":"maybe"}"#);
    let environments = json!({ "dev": "env/dev.json", "prod": "env/prod.json", "stage": "env/stage.env", "broken": "env/broken.json" });
    let with_flags = |flags: Value| write_config(&dir, &json!({ "flags": flags, "environments": environments }));
    with_flags(json!(["CHECKOUT_V2", "NEW_NAV"]));
    let build = |alias: &str| {
        let output = imp_command(&dir.path).args(["build", "--env", alias]).env_remove("IMP_ENV").output().unwrap();
        Run {
            code: output.status.code().unwrap_or(-1),
            stdout: normalize(&String::from_utf8_lossy(&output.stdout)),
            stderr: normalize(&String::from_utf8_lossy(&output.stderr)),
        }
    };
    let report = |alias: &str| {
        let result = build(alias);
        let chunks_dir = dir.join("dist/chunks");
        let names: Vec<String> = std::fs::read_dir(&chunks_dir)
            .map(|entries| entries.flatten().map(|entry| entry.file_name().to_string_lossy().into_owned()).collect())
            .unwrap_or_default();
        let output: String = names.iter().map(|name| read(&chunks_dir.join(name))).collect::<Vec<_>>().join("\n");
        let split = names.iter().any(|name| !name.starts_with("app-") && !name.starts_with("env-"));
        let html = built_html(&dir);
        format!(
            "{}\n{}\n\n{}\n",
            mask(&transcript(&format!("imp build --env {alias}  (cwd: <tmp>)"), &result), &dir),
            section(
                "folded bundle",
                &[
                    format!("gated checkout code shipped: {}", output.contains("NEW-CHECKOUT-CODE")),
                    format!("split chunk emitted: {split}"),
                    format!("nav label: {}", if output.contains("NAV-NEXT") { "NAV-NEXT" } else { "NAV-CLASSIC" }),
                    format!("flag() call left in the output: {}", output.contains("__IMP_FLAGS__")),
                ]
                .join("\n")
            ),
            section("injected globals", &globals_in(&html))
        )
    };
    assert_snapshot("flags-build-off", &report("prod"));
    assert_snapshot("flags-build-on", &report("dev"));
    assert_snapshot("flags-build-dotenv", &report("stage"));

    let failing = |name: &str, source: &str, alias: &str| {
        write(&dir.join("app.js"), source);
        let result = build(alias);
        assert_snapshot(name, &mask(&transcript(&format!("imp build --env {alias}  (cwd: <tmp>)"), &result), &dir));
    };
    failing("flags-build-undeclared", "import { flag } from 'imp'\nexport const on = flag('CHEKOUT_V2')\n", "prod");
    failing(
        "flags-build-computed-name",
        "import { flag } from 'imp'\nconst name = 'NEW_NAV'\nexport const on = flag(name)\n",
        "prod",
    );
    failing(
        "flags-build-unfolded",
        "const ready = true; import{flag}from\"imp\";\nexport const on = ready && flag(\"NEW_NAV\")\n",
        "prod",
    );
    failing("flags-build-non-boolean", &app_source, "broken");

    with_flags(json!("CHECKOUT_V2"));
    let list_only = build("prod");
    with_flags(json!(["IMP_BASEPATH"]));
    let reserved = build("prod");
    with_flags(json!(["CHECKOUT_V2", "NEW_NAV"]));
    assert_snapshot(
        "flags-invalid-config",
        &format!(
            "{}\n{}",
            mask(&transcript("imp build --env prod  (flags: \"CHECKOUT_V2\")", &list_only), &dir),
            mask(&transcript("imp build --env prod  (flags: [\"IMP_BASEPATH\"])", &reserved), &dir)
        ),
    );

    let server = start_dev(&dir.path, &["--env", "dev"]);
    let html = get(server.port, "/").text();
    assert_snapshot("flags-start-injected", &format!("{}\n", section("injected globals", &globals_in(&html))));
}

#[test]
fn bundle_dependency_keeps_bare_imp_imports_external() {
    let dir = TempDir::new();
    let entry = dir.join("component.js");
    write(&entry, "import { div } from 'imp/html'\nexport const box = (text) => div(text)\n");
    let bundled = imp::deps::bundle_dependency(&dir.path, &entry.to_string_lossy(), "component").unwrap();
    let names: Vec<&str> = bundled.files.iter().map(|(name, _)| name.as_str()).collect();
    let packages: Vec<String> = bundled.packages.iter().map(|package| package.id()).collect();
    let code = String::from_utf8_lossy(&bundled.files[0].1).into_owned();
    assert_snapshot(
        "bundle-dependency-imp-external",
        &format!(
            "{}\n\n{}\n\n{}\n\n{}\n",
            section("files", &names.join("\n")),
            section("bundled packages", &packages.join("\n")),
            section("imp imports kept bare", &bundled.imp_imports.join("\n")),
            section("component.js", &code)
        ),
    );
}
