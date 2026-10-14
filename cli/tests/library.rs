mod support;

use imp::bundler::{Assets, Format, ImpLibrary, Options, VirtualModule, bundle};
use imp::library_exports::imp_module_exports;
use imp::specifiers::{IMP_MODULES, IMP_TOOLING_MODULES, default_alias, parse_specifier};
use regex::Regex;
use serde_json::{Value, json};
use std::collections::BTreeSet;
use std::path::PathBuf;
use support::*;

fn repo_root() -> PathBuf {
    cli_dir().parent().unwrap().to_path_buf()
}

fn library_src() -> PathBuf {
    repo_root().join("lib/src")
}

fn run_library(code: &str) -> String {
    let root = library_src();
    let mut options = Options::new(&root);
    options.virtual_modules.insert(
        "imp-library-probe".into(),
        VirtualModule {
            code: code.to_string(),
            resolve_dir: root.clone(),
        },
    );
    options.entries.push((None, "imp-library-probe".into()));
    options.imp = ImpLibrary::Tooling;
    options.format = Format::Iife;
    options.assets = Assets::DataUrl;
    let bundled = bundle(options).unwrap_or_else(|error| panic!("{error}"));
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        if let Err(error) = ctx.eval::<(), _>(bundled.entry_code()) {
            panic!("the probe failed: {error}: {:?}", ctx.catch());
        }
        ctx.globals().get::<_, String>("__probe").unwrap()
    })
}

fn failures_of(code: &str) -> Vec<String> {
    let probe = format!(
        "const failures = []\nconst check = (condition, message) => {{ if (!condition) failures.push(message) }}\n{code}\nglobalThis.__probe = JSON.stringify(failures)\n"
    );
    serde_json::from_str(&run_library(&probe)).unwrap()
}

#[test]
fn a_derived_primary_reads_as_text_on_the_surface_and_carries_readable_text() {
    let failures = failures_of(
        r#"
import { buildTokens, THEME_DEFAULTS } from './theme.js'
import { contrastProblems } from './theme-contrast.js'
const derived = (primary, mode) => buildTokens({ ...THEME_DEFAULTS, primary, mode })
const deep = derived('#b91c1c', 'light')
check(deep['color-primary'] === '#b91c1c', 'a deep red that reads on the surface stays as given')
check(deep['color-on-primary'] === '#ffffff', 'a deep red gets white text')
const pale = derived('#f59e0b', 'light')
check(pale['color-primary'] !== '#f59e0b', 'a pale amber is too light for text in a light theme')
check(pale['color-on-primary'] === '#ffffff', 'the darker amber carries white text')
check(contrastProblems(pale).length === 0, 'every pair of the pale amber theme reads at 4.5:1')
const night = derived('#f59e0b', 'dark')
check(night['color-primary'] === '#f59e0b', 'a pale amber reads on a dark surface as given')
check(night['color-on-primary'] !== '#ffffff', 'a pale amber gets dark text')
const dim = derived('#1e3a8a', 'dark')
check(dim['color-primary'] !== '#1e3a8a', 'a deep blue is too dark for text in a dark theme')
check(contrastProblems(dim).length === 0, 'every pair of the deep blue dark theme reads at 4.5:1')
"#,
    );
    check(failures.is_empty(), failures.join("\n"));
}

#[test]
fn every_pair_of_a_derived_theme_reaches_4_5_over_a_grid_of_colours() {
    let failures = failures_of(
        r#"
import { buildTokens, THEME_DEFAULTS } from './theme.js'
import { contrastProblems } from './theme-contrast.js'
const steps = [0x00, 0x24, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff]
const channel = (value) => value.toString(16).padStart(2, '0')
const colors = steps.flatMap((red) => steps.flatMap((green) => steps.map((blue) => `#${channel(red)}${channel(green)}${channel(blue)}`)))
for (const mode of ['light', 'dark']) {
  for (const color of colors) {
    for (const knobs of [{ primary: color }, { secondary: color }]) {
      const problems = contrastProblems(buildTokens({ ...THEME_DEFAULTS, ...knobs, mode }))
      if (problems.length) check(false, `${mode} ${JSON.stringify(knobs)} ${JSON.stringify(problems)}`)
    }
  }
}
"#,
    );
    check(
        failures.is_empty(),
        format!(
            "derived themes below 4.5:1:\n{}",
            failures
                .iter()
                .take(10)
                .cloned()
                .collect::<Vec<_>>()
                .join("\n")
        ),
    );
}

#[test]
fn the_theme_editor_exports_a_theme_file_that_imports_back() {
    let failures = failures_of(
        r#"
import { buildTokens, colorSchemeOf, defaultTokens } from './theme.js'
import { themeFileSource } from './theme-draft.js'
const load = (source) => {
  check(!source.includes("from 'imp"), 'the exported theme file imports nothing from imp')
  return new Function(source.replace('export default theme', 'return theme'))()
}
const tokens = {
  ...buildTokens({
    primary: '#3b6fe0', secondary: '#6b7280', radius: 'large', shadow: 'strong', mode: 'light',
    overrides: { 'font-family': "'Inter', system-ui, sans-serif", 'background-app': 'linear-gradient(#fff, #eee)', 'font-weight-bold': '500' },
  }),
  'color-green': '#12b76a',
}
const theme = load(themeFileSource('acme', { tokens }))
check(theme.name === 'acme', `unexpected theme name ${theme.name}`)
check(colorSchemeOf(theme.tokens) === 'light', 'the theme keeps its light surface')
const missing = Object.keys(defaultTokens()).filter((name) => !(name in theme.tokens))
check(missing.length === 0, `the exported theme omits ${missing.join(', ')}`)
check(theme.tokens['color-primary'] === tokens['color-primary'], 'the theme carries the primary the editor was given')
check(theme.tokens['color-green'] === '#12b76a', 'a palette colour edited by hand is kept')
check(theme.tokens['color-success'] === 'var(--imp-color-green)' && theme.tokens['color-danger'] === 'var(--imp-color-red)', 'a colour role points at the palette')
check(theme.tokens['background-app'] === 'linear-gradient(#fff, #eee)' && theme.tokens['font-weight-bold'] === '500', 'the tokens the editor has no knob for reach the exported theme')
check(theme.tokens['radius-item'] === '10px' && theme.tokens['shadow-md'] !== 'none', 'the radius and shadow steps reach the exported tokens')
check(theme.tokens['font-family'] === "'Inter', system-ui, sans-serif", 'the theme carries the font of the draft')
const odd = {
  'icon-glyph': '"\\e900"',
  'font-family': `'Inter', "Noto Sans", sans-serif`,
  'path-windows': 'C:\\fonts\\',
  'odd-value': 'it\'s a \\ "test"\nnext line',
}
const back = load(themeFileSource("acme's \\ theme", { tokens: odd }))
check(back.name === "acme's \\ theme", `unexpected theme name ${back.name}`)
for (const [name, value] of Object.entries(odd)) {
  check(back.tokens[name] === value, `${name} came back as ${JSON.stringify(back.tokens[name])}`)
}
"#,
    );
    check(failures.is_empty(), failures.join("\n"));
}

fn exports_of(specifier: &str) -> Vec<String> {
    imp_module_exports()
        .get(specifier)
        .map(|names| names.iter().cloned().collect())
        .unwrap_or_default()
}

#[test]
fn the_prose_export_tables_match_what_imp_really_exports() {
    let identifier = Regex::new(r"^[A-Za-z_$][\w$]*$").unwrap();
    let quoted = Regex::new(r"`([^`]+)`").unwrap();
    let skill_subject = Regex::new(r"^(?:imp skill )?std/([A-Za-z_$][\w$]*)$").unwrap();
    let mut problems = Vec::new();
    let mut std_rows = BTreeSet::new();
    for page in ["skills/imports.md", "skills/std.md", "docs/imports.md"] {
        let text = read(&repo_root().join(page));
        for (index, line) in text.lines().enumerate() {
            if !line.starts_with('|') {
                continue;
            }
            let cells: Vec<&str> = line.trim_matches('|').split('|').map(str::trim).collect();
            let Some(specifier) = cells[0]
                .strip_prefix('`')
                .and_then(|cell| cell.strip_suffix('`'))
            else {
                continue;
            };
            if !imp_module_exports().contains_key(specifier) {
                continue;
            }
            let body = cells[1..].join(" ");
            let names: Vec<String> = quoted
                .captures_iter(&body)
                .map(|caps| caps[1].to_string())
                .collect();
            let listed: Vec<&String> = names
                .iter()
                .filter(|name| identifier.is_match(name))
                .collect();
            let subjects: Vec<String> = names
                .iter()
                .filter_map(|name| skill_subject.captures(name).map(|caps| caps[1].to_string()))
                .collect();
            if listed.is_empty() {
                continue;
            }
            if page == "skills/std.md" {
                std_rows.insert(specifier.to_string());
            }
            let exported = exports_of(specifier);
            let at = format!("{page}:{}", index + 1);
            for name in listed
                .iter()
                .map(|name| name.as_str())
                .chain(subjects.iter().map(String::as_str))
            {
                if !exported.iter().any(|export| export == name) {
                    problems.push(format!("{at}: '{specifier}' does not export '{name}'"));
                }
            }
            if body.contains("...") {
                continue;
            }
            for name in &exported {
                if !listed.contains(&name) {
                    problems.push(format!("{at}: '{specifier}' exports '{name}', which the table omits - list it, or mark the list with '...'"));
                }
                if !subjects.is_empty() && !subjects.contains(name) {
                    problems.push(format!(
                        "{at}: '{specifier}' exports '{name}', which the skill column omits"
                    ));
                }
            }
        }
    }
    for group in imp_module_exports()
        .keys()
        .filter(|name| name.starts_with("imp/std"))
    {
        if !std_rows.contains(*group) {
            problems.push(format!(
                "skills/std.md: '{group}' has no row - every std group is listed on this page"
            ));
        }
    }
    check(
        problems.is_empty(),
        format!("prose is out of date:\n  {}", problems.join("\n  ")),
    );
}

#[test]
fn the_prose_token_tables_match_the_built_in_themes() {
    let names: Vec<String> = serde_json::from_str(&run_library(
        "import { defaultTokens } from './theme.js'\nglobalThis.__probe = JSON.stringify(Object.keys(defaultTokens()))\n",
    ))
    .unwrap();
    let quoted = Regex::new(r"`([^`]+)`").unwrap();
    let mut problems = Vec::new();
    for page in ["skills/theming.md", "docs/theming.md"] {
        let text = read(&repo_root().join(page));
        let lines: Vec<&str> = text.lines().collect();
        let Some(header) = lines.iter().position(|line| {
            line.starts_with('|') && line.split('|').nth(2).map(str::trim) == Some("Tokens")
        }) else {
            problems.push(format!(
                "{page}: no token table (a row with a 'Tokens' column)"
            ));
            continue;
        };
        let mut listed = BTreeSet::new();
        for line in &lines[header + 2..] {
            if !line.starts_with('|') {
                break;
            }
            for caps in quoted.captures_iter(line) {
                listed.insert(caps[1].to_string());
            }
        }
        for name in &listed {
            if !names.contains(name) {
                problems.push(format!(
                    "{page}: lists '{name}', which no built-in theme defines"
                ));
            }
        }
        for name in &names {
            if !listed.contains(name) {
                problems.push(format!("{page}: omits the '{name}' token"));
            }
        }
    }
    check(
        problems.is_empty(),
        format!("token tables are out of date:\n  {}", problems.join("\n  ")),
    );
}

#[test]
fn the_lint_prose_documents_exactly_the_rules_that_run() {
    let rules: Vec<String> = imp::lint::rule_names();
    let not_a_rule: BTreeSet<&str> = IMP_MODULES
        .iter()
        .map(|(specifier, _)| *specifier)
        .chain(
            IMP_TOOLING_MODULES
                .iter()
                .map(|(specifier, _, _)| *specifier),
        )
        .collect();
    let rule = Regex::new(r"`(imp/[a-z-]+)`").unwrap();
    let mut problems = Vec::new();
    for page in ["skills/lint.md", "docs/lint.md"] {
        let text = read(&repo_root().join(page));
        let documented: BTreeSet<String> = rule
            .captures_iter(&text)
            .map(|caps| caps[1].to_string())
            .filter(|name| !not_a_rule.contains(name.as_str()))
            .collect();
        for name in &rules {
            if !documented.contains(name) {
                problems.push(format!("{page}: does not document '{name}'"));
            }
        }
        for name in &documented {
            if !rules.contains(name) {
                problems.push(format!(
                    "{page}: documents '{name}', which is not a rule imp runs"
                ));
            }
        }
    }
    check(
        problems.is_empty(),
        format!("lint prose is out of date:\n  {}", problems.join("\n  ")),
    );
}

#[test]
fn third_party_licenses_list_the_vendored_browser_code() {
    let licenses = read(&repo_root().join("THIRD-PARTY-LICENSES.md"));
    let mut problems = Vec::new();
    for file in list_files(&cli_dir().join("vendor/puppeteer")) {
        if !file.ends_with(".js") {
            continue;
        }
        let text = read(&cli_dir().join("vendor/puppeteer").join(&file));
        let Some(tool) = text
            .lines()
            .next()
            .and_then(|line| line.strip_prefix("// "))
        else {
            continue;
        };
        if !licenses.contains(tool.split('@').next().unwrap_or(tool)) {
            problems.push(format!(
                "{file}: THIRD-PARTY-LICENSES.md does not name {tool}"
            ));
        }
    }
    check(problems.is_empty(), problems.join("\n"));
}

#[test]
fn the_dev_server_serves_every_bundled_asset_type_with_a_content_type() {
    for extension in imp::bundler::BINARY_ASSET_EXTENSIONS {
        check(
            imp::http_server::content_type(&format!("file.{extension}"))
                != "application/octet-stream",
            format!(
                "'{extension}' is bundled as an asset but imp start has no content type for it"
            ),
        );
    }
}

#[test]
fn every_imp_specifier_is_linted_against_its_real_exports() {
    let linted: BTreeSet<&str> = imp_module_exports().keys().copied().collect();
    for (specifier, _) in IMP_MODULES {
        check(
            linted.contains(specifier),
            format!("'{specifier}' resolves but has no export list for import-source"),
        );
    }
    for specifier in &linted {
        check(
            IMP_MODULES.iter().any(|(name, _)| name == specifier),
            format!("the export lists name '{specifier}', which imp does not resolve"),
        );
    }
}

fn library_modules(previews: bool) -> Vec<(String, String)> {
    list_files(&library_src())
        .into_iter()
        .filter(|path| path.ends_with(".js") && path.ends_with(".preview.js") == previews)
        .map(|path| {
            let source = read(&library_src().join(&path));
            (path, source)
        })
        .collect()
}

#[test]
fn nothing_in_the_library_runs_work_when_it_is_imported() {
    let call = Regex::new(r"^(?:export )?(?:const|let|var) [\w$]+ = (?:new )?([\w$.]+)\(").unwrap();
    let template = Regex::new(r"^(?:export )?(?:const|let|var) ([\w$]+) = `").unwrap();
    let allowed = [
        "Symbol",
        "Set",
        "Map",
        "WeakMap",
        "WeakSet",
        "Object.freeze",
    ];
    let mut problems = Vec::new();
    for (path, source) in library_modules(false) {
        if path.starts_with("public/") {
            continue;
        }
        let lines: Vec<&str> = source.lines().collect();
        for (index, line) in lines.iter().enumerate() {
            let at = format!("lib/src/{path}:{}", index + 1);
            if let Some(called) = call.captures(line).map(|caps| caps[1].to_string())
                && !allowed.contains(&called.as_str())
            {
                problems.push(format!(
                        "{at}: calls '{called}' at module scope, so a bundler must keep the statement - build the value on first use instead"
                    ));
            }
            let Some(name) = template.captures(line).map(|caps| caps[1].to_string()) else {
                continue;
            };
            let body: Vec<&str> = lines[index + 1..]
                .iter()
                .take_while(|next| !next.starts_with('`'))
                .copied()
                .collect();
            if body.join("\n").contains("token(") {
                problems.push(format!(
                    "{at}: '{name}' builds CSS from tokens at module scope - make it a function"
                ));
            }
        }
    }
    check(
        problems.is_empty(),
        format!(
            "the library is not tree-shakeable:\n  {}",
            problems.join("\n  ")
        ),
    );
}

#[test]
fn a_bundle_of_code_block_alone_carries_no_editor() {
    let dir = TempDir::new();
    copy_directory(&fixture("build"), &dir.path);
    let build = |entry: &str, source: &str| {
        write(&dir.join(entry), source);
        write(&dir.join(&entry.replace(".js", ".skill.md")), "# probe\n");
        let result = run_imp(&["build", entry, "--output", "code"], &dir.path);
        check(
            result.code == 0,
            format!("imp build {entry} failed:\n{}", result.stderr),
        );
        read(&dir.join("code").join(entry))
    };
    let listing = build(
        "block-only.js",
        "import { codeBlock } from 'imp/std/display'\n\nexport const show = codeBlock\n",
    );
    let editor = build(
        "editor-only.js",
        "import { codeEditor } from 'imp/std/inputs'\n\nexport const edit = codeEditor\n",
    );
    let mut problems = Vec::new();
    if !listing.contains("imp.code.copy") {
        problems.push("block-only.js carries no code view".to_string());
    }
    for (marker, what) in [
        ("insertText", "the key handler of the textarea"),
        ("imp.codeEditor.keys", "the editor"),
    ] {
        if listing.contains(marker) {
            problems.push(format!("block-only.js carries {what}"));
        }
        if !editor.contains(marker) {
            problems.push(format!("editor-only.js carries no {what}"));
        }
    }
    if !editor.contains("imp.code.copy") {
        problems.push("editor-only.js carries no code view".to_string());
    }
    check(
        problems.is_empty(),
        format!(
            "the code components are not split at the import:\n  {}",
            problems.join("\n  ")
        ),
    );
}

#[test]
fn a_library_preview_imports_imp_through_its_entry_points_only() {
    let config: Value = serde_json::from_str(&read(&library_src().join("imp.json"))).unwrap();
    let groups = imp::paths::normalize(std::path::Path::new(
        config["preview"]["groups"].as_str().unwrap(),
    ));
    let relative = Regex::new(r#"^import\b[^'"]*['"](\.{1,2}/[^'"]*)['"]"#).unwrap();
    let mut problems = Vec::new();
    for (path, source) in library_modules(true) {
        let dir = std::path::Path::new(&path)
            .parent()
            .unwrap_or(std::path::Path::new(""));
        for (index, line) in source.lines().enumerate() {
            let Some(target) = relative.captures(line).map(|caps| caps[1].to_string()) else {
                continue;
            };
            if imp::paths::normalize(&dir.join(&target)) == groups {
                continue;
            }
            problems.push(format!(
                "lib/src/{path}:{}: imports '{target}' by path - import from 'imp', 'imp/std', 'imp/state' or another imp entry point instead",
                index + 1
            ));
        }
    }
    check(
        problems.is_empty(),
        format!(
            "a preview bypasses the imp entry points:\n  {}",
            problems.join("\n  ")
        ),
    );
}

#[test]
fn an_app_carries_only_the_parts_of_imp_it_imports() {
    let dir = TempDir::new();
    write(&dir.join("imp.json"), "{\"name\":\"shaking\"}\n");
    let entries = [
        (
            "minimal",
            "import { mount } from 'imp'\nimport { div } from 'imp/html'\nmount(document.body, div('hi'))\n",
        ),
        (
            "tags",
            "import { mount } from 'imp'\nimport * as tags from 'imp/html'\nmount(document.body, tags.div(Object.keys(tags).length))\n",
        ),
        (
            "button",
            "import { mount } from 'imp'\nimport { button } from 'imp/std'\nmount(document.body, button('hi'))\n",
        ),
        (
            "buttonAndLink",
            "import { mount } from 'imp'\nimport { button, link } from 'imp/std'\nmount(document.body, button('hi'), link({ href: '/x' }, 'x'))\n",
        ),
        (
            "oneIcon",
            "import { mount } from 'imp'\nimport { icon } from 'imp/std'\nimport { luHouse } from 'imp/icons'\nmount(document.body, icon(luHouse))\n",
        ),
    ];
    let mut size = std::collections::HashMap::new();
    for (name, source) in entries {
        write(&dir.join(&format!("{name}.js")), source);
        write(&dir.join(&format!("{name}.skill.md")), "# probe\n");
        let result = run_imp(
            &["build", &format!("{name}.js"), "--output", name],
            &dir.path,
        );
        check(
            result.code == 0,
            format!(
                "imp build {name}.js exited {}: {}",
                result.code, result.stderr
            ),
        );
        size.insert(
            name,
            std::fs::metadata(dir.join(name).join(format!("{name}.js")))
                .unwrap()
                .len(),
        );
    }
    let kb = 1024;
    check(
        size["minimal"] < 5 * kb,
        format!(
            "an entry that only mounts an element builds {} B",
            size["minimal"]
        ),
    );
    check(
        size["tags"] - size["minimal"] > 2 * kb,
        format!(
            "all of imp/html costs only {} B over two tags",
            size["tags"] - size["minimal"]
        ),
    );
    check(
        size["buttonAndLink"] - size["button"] > 2 * kb,
        format!(
            "adding link to a button-only entry costs {} B",
            size["buttonAndLink"] - size["button"]
        ),
    );
    check(
        size["oneIcon"] < 25 * kb,
        format!(
            "an entry drawing one Lucide icon builds {} B",
            size["oneIcon"]
        ),
    );
}

#[test]
fn parse_specifiers() {
    let inputs = [
        "mitt",
        "mitt@3.0.1",
        "npm:mitt@3.0.1",
        "npm:@scope/pkg@1.2.3/sub/module.js",
        "jsr:@std/encoding@1.0.10/base64",
        "jsr:@std/encoding",
        "preact@10.19.3/hooks",
        "not@a@version",
        "@lonely-scope",
        "",
    ];
    let lines: Vec<String> = inputs
        .iter()
        .map(|input| match parse_specifier(input) {
            Some(parsed) => format!(
                "'{input}' -> {} alias={}",
                json!({ "scheme": parsed.scheme, "name": parsed.name, "version": parsed.version, "subpath": parsed.subpath }),
                default_alias(&parsed)
            ),
            None => format!("'{input}' -> null"),
        })
        .collect();
    assert_snapshot("parse-specifiers", &format!("{}\n", lines.join("\n")));
}
