use crate::embedded;
use crate::paths::{file_name, relative_posix};
use crate::specifiers::{IMP_MODULES, is_imp_std_specifier, is_valid_alias};
use crate::version::VERSION;
use anyhow::{Result, anyhow};
use regex::Regex;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

pub const SKILL_SUFFIX: &str = ".skill.md";

pub const COMPONENT_SKILL_FILE: &str = "imp-skill.md";

const GROUPS: [(&str, &str); 3] = [
    ("app", "WRITING AN APP"),
    ("toolkit", "WORKING IN AN IMP PROJECT"),
    ("components", "STANDARD COMPONENTS - imported from 'imp/std' | read: imp skill std/button"),
];

const PROJECT_TITLE: &str =
    "THIS PROJECT - components with a skill file | read: imp skill ./path/to/component.js";

const DEPENDENCIES_TITLE: &str =
    "INSTALLED COMPONENTS - imp components in dependencies/ | read: imp skill <alias>";

const NO_PROJECT_SKILLS: &str =
    "  (none yet - write 'counter.skill.md' next to a component and it is listed here)";

pub struct Skill {
    pub name: &'static str,
    pub group: &'static str,
    pub aliases: &'static [&'static str],
    pub summary: &'static str,
}

pub const SKILLS: &[Skill] = &[
    Skill {
        name: "imports",
        group: "app",
        aliases: &["imp", "specifiers"],
        summary: "every bare specifier imp resolves, and what each one exports",
    },
    Skill {
        name: "rendering",
        group: "app",
        aliases: &["html", "imp/html", "elements"],
        summary: "element factories, props objects, children, and mount",
    },
    Skill {
        name: "components",
        group: "app",
        aliases: &["component"],
        summary: "custom elements with a setup lifecycle: instance, styles, cleanup",
    },
    Skill {
        name: "custom-components",
        group: "app",
        aliases: &["custom", "guidelines", "component-guidelines", "own-components"],
        summary: "the theme, direction, wording and accessibility rules a component of yours must follow",
    },
    Skill {
        name: "state",
        group: "app",
        aliases: &["imp/state"],
        summary: "named reactive state shared down the tree and bound straight to the DOM",
    },
    Skill {
        name: "http",
        group: "app",
        aliases: &["imp/http", "fetch", "api", "http-client"],
        summary: "the configured HTTP client a component owns, with retries and request state",
    },
    Skill {
        name: "routing",
        group: "app",
        aliases: &["router", "imp/router", "map", "app-map", "appmap", "app-map.js"],
        summary: "one application map drives the routes, the nav of the shell and the trail",
    },
    Skill {
        name: "std",
        group: "app",
        aliases: &["imp/std", "standard-components", "imp/std/layout", "imp/std/display", "imp/std/inputs", "imp/std/feedback", "imp/std/data", "imp/std/shell"],
        summary: "the built-in component library: text, layout, forms, navigation and empty states",
    },
    Skill {
        name: "accessibility",
        group: "app",
        aliases: &["a11y", "aria", "screen-reader", "wcag", "contrast"],
        summary: "what the standard components guarantee, what the app owes, and the three checks",
    },
    Skill {
        name: "icons",
        group: "app",
        aliases: &["imp/icons", "lucide"],
        summary: "the Lucide icon set as tree-shaken exports, drawn by icon",
    },
    Skill {
        name: "theming",
        group: "app",
        aliases: &["theme", "imp/theme", "tokens"],
        summary: "themes as plain token modules, applied at the entry point and swappable",
    },
    Skill {
        name: "i18n",
        group: "app",
        aliases: &["imp/i18n", "translations"],
        summary: "t() lookups, per-language messages, and the lang attribute that drives them",
    },
    Skill {
        name: "logging",
        group: "app",
        aliases: &["log", "imp/log", "logger"],
        summary: "the built-in logger and the per-environment log level",
    },
    Skill {
        name: "analytics",
        group: "app",
        aliases: &["imp/analytics", "imp/analytics/aly", "alysink", "imp-aly", "zone", "zones", "track", "onanalytics", "tracking", "metrics"],
        summary: "page views, zones, outcomes and errors as counted records, sent to a sink of the app",
    },
    Skill {
        name: "build-flags",
        group: "app",
        aliases: &["flag", "flags", "build-flag", "toggles"],
        summary: "flag() reads a boolean fixed per environment and imp build folds the branch away",
    },
    Skill {
        name: "cli",
        group: "toolkit",
        aliases: &["commands", "help"],
        summary: "every command, and which skill covers it",
    },
    Skill {
        name: "init",
        group: "toolkit",
        aliases: &["scaffold", "new", "create", "starter"],
        summary: "scaffolding a runnable project: what imp init writes, and the look an agent gives a new app",
    },
    Skill {
        name: "config",
        group: "toolkit",
        aliases: &["imp.json", "imp.jsonc", "environments", "env"],
        summary: "the imp.json file key by key, and the --env environment files",
    },
    Skill {
        name: "start",
        group: "toolkit",
        aliases: &["serve", "dev", "dev-server", "logs", "dev.log"],
        summary: "the dev server: injected imports, live reload and the session log of imp logs",
    },
    Skill {
        name: "build",
        group: "toolkit",
        aliases: &["bundle", "pwa", "dist", "targetimphost", "public", "assets"],
        summary: "the production build, JS entries for publishing, and the offline PWA output",
    },
    Skill {
        name: "mocks",
        group: "toolkit",
        aliases: &["mock", "mock.js", "fixtures", "backend"],
        summary: "answering the app's requests from *.mock.js files instead of the network",
    },
    Skill {
        name: "service-worker",
        group: "toolkit",
        aliases: &["imp/service-worker", "sw", "sw.js", "startdevmode", "dev-mode"],
        summary: "a service worker of your own, bundled by imp, with dev mode from startDevMode()",
    },
    Skill {
        name: "preview",
        group: "toolkit",
        aliases: &["previews", "preview.js", "imp/preview", "scenarios"],
        summary: "rendering components in isolation from a *.preview.js file",
    },
    Skill {
        name: "review",
        group: "toolkit",
        aliases: &["reviews", "feedback", "comments"],
        summary: "run it when the person mentions a review, a comment or an element they marked in the browser",
    },
    Skill {
        name: "testing",
        group: "toolkit",
        aliases: &["test", "imp/test"],
        summary: "unit tests in-process and e2e specs against a real browser",
    },
    Skill {
        name: "dependencies",
        group: "toolkit",
        aliases: &["deps", "install", "uninstall"],
        summary: "vendoring packages into dependencies/ and importing them",
    },
    Skill {
        name: "lint",
        group: "toolkit",
        aliases: &["rules"],
        summary: "the imp lint rules, what each one prevents, and how to apply fixes",
    },
    Skill {
        name: "fmt",
        group: "toolkit",
        aliases: &["format", "formatting"],
        summary: "formatting every file type in the project with one command",
    },
    Skill {
        name: "resize",
        group: "toolkit",
        aliases: &["image", "images"],
        summary: "downscaling an oversized PNG or JPEG asset in place",
    },
    Skill {
        name: "skill",
        group: "toolkit",
        aliases: &["skills", "skill.md"],
        summary: "reading these manuals, and writing a *.skill.md for a component",
    },
    Skill {
        name: "update",
        group: "toolkit",
        aliases: &["version", "pin", "prune", "licenses"],
        summary: "pinning the imp version, pruning cached ones, and the license notices",
    },];

#[derive(Clone)]
enum Source {
    Embedded(String),
}

#[derive(Clone)]
struct Subject {
    name: String,
    kind: &'static str,
    group: &'static str,
    aliases: Vec<String>,
    summary: Option<String>,
    source: Source,
}

static BARREL_EXPORT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"export\s*(?:(\*)|\{\s*(\w+)\s*\})\s*from\s*'([^']+)'").unwrap()
});

fn join_module(base: &str, module: &str) -> String {
    let mut parts: Vec<&str> = base.split('/').collect();
    parts.pop();
    for segment in module.split('/') {
        match segment {
            "." | "" => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }
    parts.join("/")
}

fn barrel_components(barrel: &str, into: &mut Vec<(String, String)>) {
    let Some(source) = embedded::text(barrel) else { return };
    for caps in BARREL_EXPORT.captures_iter(source) {
        let module = &caps[3];
        if caps.get(1).is_some() {
            barrel_components(&join_module(barrel, module), into);
        } else {
            let skill = join_module(barrel, &skill_file_for_str(module));
            into.push((caps[2].to_string(), skill));
        }
    }
}

pub fn standard_component_skills() -> Vec<(String, String)> {
    let mut components = Vec::new();
    for (specifier, module) in IMP_MODULES {
        if is_imp_std_specifier(specifier) {
            barrel_components(&format!("lib/src/{module}"), &mut components);
        }
    }
    components
}

fn all_subjects() -> Vec<Subject> {
    let mut subjects: Vec<Subject> = SKILLS
        .iter()
        .map(|skill| Subject {
            name: skill.name.to_string(),
            kind: "subject",
            group: skill.group,
            aliases: skill.aliases.iter().map(|alias| alias.to_string()).collect(),
            summary: Some(skill.summary.to_string()),
            source: Source::Embedded(format!("skills/{}.md", skill.name)),
        })
        .collect();
    for (name, file) in standard_component_skills() {
        subjects.push(Subject {
            name: format!("std/{name}"),
            kind: "component",
            group: "components",
            aliases: vec![name.clone(), format!("imp/std/{name}")],
            summary: None,
            source: Source::Embedded(file),
        });
    }
    subjects
}

fn normalize(subject: &str) -> String {
    let lower = subject.trim().to_lowercase();
    let without_prefix = lower.strip_prefix("./").or_else(|| lower.strip_prefix('/')).unwrap_or(&lower);
    without_prefix.strip_suffix(".md").unwrap_or(without_prefix).to_string()
}

fn find_skill(subject: &str) -> Option<Subject> {
    let wanted = normalize(subject);
    all_subjects().into_iter().find(|candidate| {
        std::iter::once(&candidate.name)
            .chain(candidate.aliases.iter())
            .any(|name| normalize(name) == wanted)
    })
}

static SUBJECT_LINK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[([^\]]+)\]\(([\w-]+)\.md(?:#[^)]*)?\)").unwrap());
static FENCE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\s*(`{3,})(.*)$").unwrap());
static TABLE_ROW: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\s*\|.*\|\s*$").unwrap());
static SEPARATOR_CELL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^:?-+:?$").unwrap());

fn cells_of(row: &str) -> Vec<String> {
    let trimmed = row.trim();
    let inner = &trimmed[1..trimmed.len() - 1];
    inner.split('|').map(|cell| cell.trim().to_string()).collect()
}

fn char_len(text: &str) -> usize {
    text.encode_utf16().count()
}

fn aligned_table(rows: &[String]) -> Vec<String> {
    let table: Vec<Vec<String>> = rows.iter().map(|row| cells_of(row)).collect();
    let columns = table.iter().map(Vec::len).max().unwrap_or(0);
    let widths: Vec<usize> = (0..columns)
        .map(|index| {
            table
                .iter()
                .map(|cells| {
                    let cell = cells.get(index).map(String::as_str).unwrap_or("");
                    if SEPARATOR_CELL.is_match(cell) { 3 } else { char_len(cell) }
                })
                .max()
                .unwrap_or(0)
        })
        .collect();
    table
        .iter()
        .map(|cells| {
            let padded: Vec<String> = widths
                .iter()
                .enumerate()
                .map(|(index, width)| {
                    let cell = cells.get(index).map(String::as_str).unwrap_or("");
                    if SEPARATOR_CELL.is_match(cell) {
                        format!("{}{}", &cell[..1], "-".repeat(width - 1))
                    } else {
                        format!("{cell}{}", " ".repeat(width.saturating_sub(char_len(cell))))
                    }
                })
                .collect();
            format!("| {} |", padded.join(" | ")).trim_end().to_string()
        })
        .collect()
}

fn fenced_lines(lines: &[&str]) -> Vec<bool> {
    let mut fenced = Vec::with_capacity(lines.len());
    let mut open_width = 0;
    for line in lines {
        let Some(caps) = FENCE.captures(line) else {
            fenced.push(open_width > 0);
            continue;
        };
        let width = caps[1].len();
        if open_width == 0 {
            open_width = width;
        } else if width >= open_width && caps[2].trim().is_empty() {
            open_width = 0;
        }
        fenced.push(true);
    }
    fenced
}

fn name_by_file(file: &str) -> Option<&'static str> {
    SKILLS.iter().find(|skill| format!("{}.md", skill.name) == file).map(|skill| skill.name)
}

pub fn retarget_links(text: &str) -> (String, Vec<String>) {
    let mut related: Vec<String> = Vec::new();
    let original: Vec<&str> = text.split('\n').collect();
    let fenced = fenced_lines(&original);
    let mut lines: Vec<String> = original
        .iter()
        .enumerate()
        .map(|(index, line)| {
            if fenced[index] {
                return line.to_string();
            }
            SUBJECT_LINK
                .replace_all(line, |caps: &regex::Captures| {
                    let Some(name) = name_by_file(&format!("{}.md", &caps[2])) else {
                        return caps[0].to_string();
                    };
                    if !related.iter().any(|known| known == name) {
                        related.push(name.to_string());
                    }
                    format!("{} (imp skill {name})", &caps[1])
                })
                .into_owned()
        })
        .collect();
    realign_changed_tables(&mut lines, &original, &fenced);
    (lines.join("\n"), related)
}

fn realign_changed_tables(lines: &mut [String], original: &[&str], fenced: &[bool]) {
    let mut start: Option<usize> = None;
    let flush = |lines: &mut [String], start: &mut Option<usize>, end: usize| {
        let Some(first) = start.take() else { return };
        let rows: Vec<String> = lines[first..end].to_vec();
        if rows.iter().enumerate().any(|(index, row)| row != original[first + index]) {
            for (index, row) in aligned_table(&rows).into_iter().enumerate() {
                lines[first + index] = row;
            }
        }
    };
    for index in 0..lines.len() {
        if !fenced[index] && TABLE_ROW.is_match(&lines[index]) {
            if start.is_none() {
                start = Some(index);
            }
            continue;
        }
        flush(lines, &mut start, index);
    }
    let len = lines.len();
    flush(lines, &mut start, len);
}

fn first_line(text: &str) -> String {
    let line = text.trim_start().split('\n').next().unwrap_or("");
    line.trim_start_matches('#').trim().to_string()
}

fn subject_text(subject: &Subject) -> Result<String> {
    match &subject.source {
        Source::Embedded(path) => embedded::text(path)
            .map(|text| text.trim_end().to_string())
            .ok_or_else(|| anyhow!("{path} is not embedded in this imp build")),
    }
}

fn summary_of(subject: &Subject) -> String {
    subject.summary.clone().unwrap_or_else(|| first_line(&subject_text(subject).unwrap_or_default()))
}

fn render_skill(subject: &Subject) -> Result<String> {
    let (retargeted, related) = retarget_links(&subject_text(subject)?);
    let related_line = related
        .iter()
        .filter(|name| **name != subject.name)
        .map(|name| format!("imp skill {name}"))
        .collect::<Vec<_>>()
        .join(" | ");
    let footer = if related_line.is_empty() { String::new() } else { format!("\n\nRelated: {related_line}") };
    if subject.kind == "component" {
        return Ok(format!("{retargeted}{footer}"));
    }
    let banner = format!(
        "imp skill: {} - {} (imp {VERSION})",
        subject.name,
        subject.summary.as_deref().unwrap_or("")
    );
    Ok(format!("{banner}\n\n{retargeted}{footer}"))
}

fn skill_file_for_str(path: &str) -> String {
    if path.ends_with(SKILL_SUFFIX) {
        return path.to_string();
    }
    let (dir, base) = match path.rfind('/') {
        Some(index) => (&path[..=index], &path[index + 1..]),
        None => ("", path),
    };
    let stem = match base.rfind('.') {
        Some(dot) => &base[..dot],
        None => base,
    };
    format!("{dir}{stem}{SKILL_SUFFIX}")
}

pub fn skill_file_for(path: &Path) -> PathBuf {
    let name = file_name(path);
    if name.ends_with(SKILL_SUFFIX) {
        return path.to_path_buf();
    }
    let stem = match name.rfind('.') {
        Some(dot) => &name[..dot],
        None => &name,
    };
    path.with_file_name(format!("{stem}{SKILL_SUFFIX}"))
}

fn read_skill_text(path: &Path) -> Option<String> {
    std::fs::read_to_string(path).ok().map(|text| text.trim_end().to_string())
}

pub fn read_component_skill(path: &Path, display: &str) -> Result<String> {
    let skill_file = skill_file_for(path);
    read_skill_text(&skill_file).ok_or_else(|| {
        anyhow!("no skill for {display} - describe the component in {} next to it", file_name(&skill_file))
    })
}

struct Listed {
    name: String,
    summary: String,
}

fn project_skills(root: &Path) -> Vec<Listed> {
    let files = crate::walk::collect_files(crate::walk::Collect {
        root,
        paths: &[],
        extensions: &["md"],
        exclude: &[],
    })
    .unwrap_or_default();
    let mut skills = Vec::new();
    for file in files {
        let text = file.to_string_lossy().into_owned();
        let Some(stem) = text.strip_suffix(SKILL_SUFFIX) else { continue };
        let module = PathBuf::from(format!("{stem}.js"));
        let target = if module.exists() { module } else { file.clone() };
        let summary = first_line(&std::fs::read_to_string(&file).unwrap_or_default());
        skills.push(Listed { name: format!("./{}", relative_posix(root, &target)), summary });
    }
    skills
}

fn dependency_skills(root: &Path) -> Vec<Listed> {
    let Ok(entries) = std::fs::read_dir(root.join("dependencies")) else { return Vec::new() };
    let mut skills: Vec<Listed> = entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter_map(|entry| {
            let text = std::fs::read_to_string(entry.path().join(COMPONENT_SKILL_FILE)).ok()?;
            Some(Listed { name: entry.file_name().to_string_lossy().into_owned(), summary: first_line(&text) })
        })
        .collect();
    skills.sort_by(|one, other| one.name.cmp(&other.name));
    skills
}

const INTRO: &str = "imp skills - the usage manuals imp ships for the agent writing the code

imp is a buildless UI toolkit: your ES modules run in the browser exactly as written - no
compile step, no JSX, no bundler in development. Everything an app uses arrives through a
bare specifier imp resolves ('imp', 'imp/html', 'imp/state', ...), and the same imp binary
serves, tests, lints, formats and builds the project.

Read one in full - no flags, the text goes to stdout:

  imp skill state                  a subject listed below (several at once is fine)
  imp skill std/button             a standard component
  imp skill ./src/counter.js       a component of this project, by path to its module
  imp skill widget                 an imp component installed as dependencies/widget/
";

const OUTRO: &str = "A component documents itself in a 'counter.skill.md' file next to it - write one for every
component you build, and an agent can learn it the same way it learns imp. When the person
mentions a review, a comment they left, or an element they marked in the browser, run
'imp review' first: it tells you the page, the element and the state they mean. 'imp help'
lists every command; run 'imp lint' and 'imp fmt' when you are done editing.";

fn section(title: &str, entries: &[Listed], width: usize) -> String {
    let lines: Vec<String> = entries
        .iter()
        .map(|entry| {
            let pad = width.saturating_sub(char_len(&entry.name));
            format!("  {}{}{}", entry.name, " ".repeat(pad), entry.summary)
        })
        .collect();
    format!("{title}\n{}", lines.join("\n"))
}

fn width_of(entries: &[Listed]) -> usize {
    entries.iter().map(|entry| char_len(&entry.name)).max().unwrap_or(0) + 2
}

pub fn skill_index(root: &Path) -> String {
    let subjects = all_subjects();
    let listed: Vec<(&'static str, Listed)> = subjects
        .iter()
        .map(|subject| (subject.group, Listed { name: subject.name.clone(), summary: summary_of(subject) }))
        .collect();
    let all: Vec<Listed> =
        listed.iter().map(|(_, entry)| Listed { name: entry.name.clone(), summary: String::new() }).collect();
    let width = width_of(&all);
    let mut sections: Vec<String> = GROUPS
        .iter()
        .map(|(id, title)| {
            let entries: Vec<Listed> = listed
                .iter()
                .filter(|(group, _)| group == id)
                .map(|(_, entry)| Listed { name: entry.name.clone(), summary: entry.summary.clone() })
                .collect();
            section(title, &entries, width)
        })
        .collect();
    let project = project_skills(root);
    sections.push(if project.is_empty() {
        format!("{PROJECT_TITLE}\n{NO_PROJECT_SKILLS}")
    } else {
        section(PROJECT_TITLE, &project, width_of(&project))
    });
    let installed = dependency_skills(root);
    if !installed.is_empty() {
        sections.push(section(DEPENDENCIES_TITLE, &installed, width_of(&installed)));
    }
    format!("{INTRO}\n{}\n\n{OUTRO}", sections.join("\n\n"))
}

fn looks_like_file(subject: &str) -> bool {
    subject.ends_with(SKILL_SUFFIX) || subject.ends_with(".js") || subject.contains('/') || subject.contains('\\')
}

fn unknown_subject(subject: &str) -> anyhow::Error {
    let names: Vec<String> = all_subjects().into_iter().map(|subject| subject.name).collect();
    anyhow!(
        "unknown skill '{subject}' - run 'imp skill' for the index | subjects: {} | for a component of this project pass its path: imp skill ./path/to/component.js | for an imp component in dependencies/ pass its alias: imp skill widget",
        names.join(", ")
    )
}

fn render_requested(subject: &str, root: &Path) -> Result<String> {
    if let Some(known) = find_skill(subject) {
        return render_skill(&known);
    }
    if !looks_like_file(subject) {
        if is_valid_alias(subject) {
            if let Some(text) = read_skill_text(&root.join("dependencies").join(subject).join(COMPONENT_SKILL_FILE)) {
                return Ok(text);
            }
        }
        return Err(unknown_subject(subject));
    }
    read_component_skill(&crate::paths::absolute(subject), subject)
}

pub fn print_skill(subjects: &[String], root: &Path) -> Result<()> {
    if subjects.is_empty() {
        println!("{}", skill_index(root));
        return Ok(());
    }
    let mut rendered = Vec::new();
    for subject in subjects {
        rendered.push(render_requested(subject, root)?);
    }
    println!("{}", rendered.join("\n\n"));
    Ok(())
}
