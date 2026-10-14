use crate::colors::{bold, dim, green};
use crate::embedded;
use crate::logger;
use crate::paths::{file_name, relative_posix, resolve};
use crate::version::VERSION;
use anyhow::{Result, bail};
use regex::Regex;
use serde_json::{Map, Value};
use std::path::Path;

const PWA_THEME_COLOR: &str = "#0f3a5d";
const PWA_BACKGROUND_COLOR: &str = "#ffffff";
const PWA_ICON: &str = "icon.svg";
const OFL: &str = "SIL Open Font License 1.1";

pub struct Font {
    pub name: &'static str,
    pub slug: &'static str,
}

pub const SCAFFOLD_FONTS: [Font; 10] = [
    Font {
        name: "Inter",
        slug: "inter",
    },
    Font {
        name: "Manrope",
        slug: "manrope",
    },
    Font {
        name: "Plus Jakarta Sans",
        slug: "plus-jakarta-sans",
    },
    Font {
        name: "DM Sans",
        slug: "dm-sans",
    },
    Font {
        name: "Outfit",
        slug: "outfit",
    },
    Font {
        name: "Space Grotesk",
        slug: "space-grotesk",
    },
    Font {
        name: "Sora",
        slug: "sora",
    },
    Font {
        name: "Figtree",
        slug: "figtree",
    },
    Font {
        name: "Nunito Sans",
        slug: "nunito-sans",
    },
    Font {
        name: "Work Sans",
        slug: "work-sans",
    },
];

pub fn pick_font(random: f64) -> &'static Font {
    let index = (random * SCAFFOLD_FONTS.len() as f64) as usize;
    &SCAFFOLD_FONTS[index.min(SCAFFOLD_FONTS.len() - 1)]
}

fn random_unit() -> f64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.subsec_nanos() ^ std::process::id())
        .unwrap_or(0);
    f64::from(nanos % 1_000_000) / 1_000_000.0
}

pub fn font_by_slug(slug: &str) -> Result<&'static Font> {
    SCAFFOLD_FONTS
        .iter()
        .find(|font| font.slug == slug)
        .ok_or_else(|| {
            let known: Vec<&str> = SCAFFOLD_FONTS.iter().map(|font| font.slug).collect();
            anyhow::anyhow!(
                "unknown font '{slug}' - --font takes one of {}",
                known.join(", ")
            )
        })
}

struct Subset {
    name: &'static str,
    label: &'static str,
    ranges: &'static [&'static str],
}

const FONT_SUBSETS: [Subset; 2] = [
    Subset {
        name: "latin-ext",
        label: "Latin Extended",
        ranges: &[
            "U+0100-02BA",
            "U+02BD-02C5",
            "U+02C7-02CC",
            "U+02CE-02D7",
            "U+02DD-02FF",
            "U+0304",
            "U+0308",
            "U+0329",
            "U+1D00-1DBF",
            "U+1E00-1E9F",
            "U+1EF2-1EFF",
            "U+2020",
            "U+20A0-20AB",
            "U+20AD-20C4",
            "U+2113",
            "U+2C60-2C7F",
            "U+A720-A7FF",
        ],
    },
    Subset {
        name: "latin",
        label: "Latin",
        ranges: &[
            "U+0000-00FF",
            "U+0131",
            "U+0152-0153",
            "U+02BB-02BC",
            "U+02C6",
            "U+02DA",
            "U+02DC",
            "U+0304",
            "U+0308",
            "U+0329",
            "U+2000-206F",
            "U+20AC",
            "U+2122",
            "U+2191",
            "U+2193",
            "U+2212",
            "U+2215",
            "U+FEFF",
            "U+FFFD",
        ],
    },
];

fn font_file(font: &Font, subset: &Subset) -> String {
    format!("{}-{}.woff2", font.slug, subset.name)
}

fn font_face_css(font: &Font) -> String {
    FONT_SUBSETS
        .iter()
        .map(|subset| {
            format!(
                "@font-face {{\n  font-family: '{}';\n  font-style: normal;\n  font-weight: 400 700;\n  font-display: swap;\n  src: url({}) format('woff2');\n  unicode-range:\n    {};\n}}\n",
                font.name,
                font_file(font, subset),
                subset.ranges.join(",\n    ")
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn theme_js(font: &Font) -> String {
    format!(
        "export default {{\n  name: 'app-light',\n  base: 'imp-light',\n  tokens: {{\n    'font-family': \"'{}', system-ui, sans-serif\",\n  }},\n}}\n",
        font.name
    )
}

const DEFAULT_TITLE: &str = "My imp app";

fn title_from(name: &str) -> String {
    let separators = Regex::new(r"[-_.]+").unwrap();
    let words = separators
        .replace_all(name, " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let mut chars = words.chars();
    match chars.next() {
        None => DEFAULT_TITLE.to_string(),
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
    }
}

fn short_name_from(title: &str) -> String {
    if title.chars().count() <= 12 {
        return title.to_string();
    }
    title
        .split(' ')
        .next()
        .unwrap_or("")
        .chars()
        .take(12)
        .collect()
}

fn imp_config(title: &str, pwa: bool) -> String {
    let mut config = Map::new();
    config.insert("version".into(), Value::String(VERSION.into()));
    config.insert("map".into(), Value::String("src/app-map.js".into()));
    if pwa {
        let mut block = Map::new();
        block.insert("name".into(), title.into());
        block.insert("shortName".into(), short_name_from(title).into());
        block.insert("themeColor".into(), PWA_THEME_COLOR.into());
        block.insert("backgroundColor".into(), PWA_BACKGROUND_COLOR.into());
        block.insert("display".into(), "standalone".into());
        block.insert("icon".into(), PWA_ICON.into());
        config.insert("pwa".into(), Value::Object(block));
    }
    format!("{}\n", crate::json::pretty(&Value::Object(config)))
}

fn template(name: &str) -> &'static str {
    embedded::expect_text(&format!("cli/templates/{name}"))
}

struct File {
    path: String,
    contents: Vec<u8>,
    note: String,
    merge: bool,
    appended: Option<Vec<String>>,
}

fn file(path: &str, contents: impl Into<Vec<u8>>, note: impl Into<String>) -> File {
    File {
        path: path.into(),
        contents: contents.into(),
        note: note.into(),
        merge: false,
        appended: None,
    }
}

fn ignore_entries(text: &str) -> Vec<String> {
    text.split('\n')
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(String::from)
        .collect()
}

fn without_slashes(entry: &str) -> &str {
    entry.trim_start_matches('/').trim_end_matches('/')
}

fn ignore_matcher(entry: &str) -> Regex {
    let escaped = regex::escape(without_slashes(entry));
    let source = escaped
        .replace(r"\*\*", "\u{0}")
        .replace(r"\*", "[^/]*")
        .replace('\u{0}', ".*")
        .replace(r"\?", "[^/]");
    Regex::new(&format!("^{source}$")).unwrap_or_else(|_| Regex::new("^$").unwrap())
}

fn entries_missing_from(existing: &str) -> Vec<String> {
    let covered: Vec<Regex> = ignore_entries(existing)
        .iter()
        .filter(|entry| !entry.starts_with('!'))
        .map(|entry| ignore_matcher(entry))
        .collect();
    ignore_entries(template("init/gitignore"))
        .into_iter()
        .filter(|entry| {
            !covered
                .iter()
                .any(|matcher| matcher.is_match(without_slashes(entry)))
        })
        .collect()
}

fn template_files(title: &str, pwa: bool, font: &Font) -> Vec<File> {
    let quoted = title.replace('\\', "\\\\").replace('\'', "\\'");
    let mut files = vec![
        file(
            "imp.json",
            imp_config(title, pwa),
            format!("the one config file - pins imp {VERSION}"),
        ),
        file(
            "index.html",
            template("init/index.html").replace("{{TITLE}}", title),
            "the page imp serves",
        ),
        file(
            "src/main.js",
            template("init/main.js"),
            "entry point: applies the theme, mounts the frame",
        ),
        file(
            "src/theme.js",
            theme_js(font),
            format!(
                "the theme: {} over imp-light - make the palette your own",
                font.name
            ),
        ),
        file(
            "src/app-map.js",
            template("init/app-map.js"),
            "the application map: every feature of the app, one line each",
        ),
        file(
            "src/app.js",
            template("init/app.js").replace("{{TITLE_QUOTED}}", &quoted),
            "the frame, the router and the counter",
        ),
        file(
            "test/app.test.js",
            template("init/app.test.js"),
            "unit test, runs in a headless browser",
        ),
        file(
            "test/app.spec.js",
            template("init/app.spec.js"),
            "e2e spec, drives the served app in a headless browser",
        ),
        file(
            "public/favicon.svg",
            template("favicon.svg"),
            "published at the site root - replace it with your own mark",
        ),
        file(
            "public/fonts/fonts.css",
            font_face_css(font),
            format!(
                "the @font-face rules of {} - linked from index.html",
                font.name
            ),
        ),
    ];
    for subset in &FONT_SUBSETS {
        let name = font_file(font, subset);
        files.push(file(
            &format!("public/fonts/{name}"),
            embedded::file(&format!("cli/templates/fonts/{name}")).expect("an embedded font"),
            format!("{}, {}", font.name, subset.label),
        ));
    }
    files.push(file(
        &format!("public/fonts/{}-ofl.txt", font.slug),
        template(&format!("fonts/{}-ofl.txt", font.slug)),
        format!("{OFL} - ships with the font"),
    ));
    let mut ignore = file(
        ".gitignore",
        template("init/gitignore"),
        "dist/, .imp/ and every .env file",
    );
    ignore.merge = true;
    files.push(ignore);
    if pwa {
        files.push(file(
            PWA_ICON,
            crate::review::imp_mark_svg("light"),
            "the source image imp renders the whole PWA icon set from",
        ));
    }
    files
}

fn note_for(file: &File) -> String {
    match &file.appended {
        None => file.note.clone(),
        Some(appended) if appended.is_empty() => {
            "left as it was - it already covers all of these".into()
        }
        Some(appended) => format!(
            "kept yours - appended the {} {} it was missing",
            appended.len(),
            if appended.len() > 1 {
                "entries"
            } else {
                "entry"
            }
        ),
    }
}

pub fn init(cwd: &Path, dir: Option<String>, pwa: bool, font: Option<String>) -> Result<()> {
    let (chosen, choice) = match &font {
        Some(slug) => (font_by_slug(slug)?, "named by --font"),
        None => (pick_font(random_unit()), "picked at random"),
    };
    let target = match &dir {
        Some(dir) => resolve(cwd, dir),
        None => cwd.to_path_buf(),
    };
    let label = dir
        .as_ref()
        .map(|_| relative_posix(cwd, &target))
        .filter(|label| !label.is_empty());
    let mut files = template_files(&title_from(&file_name(&target)), pwa, chosen);
    let conflicts: Vec<&str> = files
        .iter()
        .filter(|file| !file.merge && target.join(&file.path).exists())
        .map(|file| file.path.as_str())
        .collect();
    if !conflicts.is_empty() {
        bail!(
            "imp init writes {}, which already {}{} - nothing was written. Scaffold into an empty directory instead ('imp init <dir>'), or move those files aside.",
            conflicts.join(", "),
            if conflicts.len() > 1 {
                "exist"
            } else {
                "exists"
            },
            label
                .as_ref()
                .map(|label| format!(" in {label}"))
                .unwrap_or_else(|| " here".into())
        );
    }
    for file in &mut files {
        let path = target.join(&file.path);
        if file.merge && path.exists() {
            let existing = std::fs::read_to_string(&path)?;
            let missing = entries_missing_from(&existing);
            if !missing.is_empty() {
                let base = if existing.ends_with('\n') {
                    existing.clone()
                } else {
                    format!("{existing}\n")
                };
                std::fs::write(
                    &path,
                    format!("{base}\n# added by imp init\n{}\n", missing.join("\n")),
                )?;
            }
            file.appended = Some(missing);
            continue;
        }
        std::fs::create_dir_all(path.parent().unwrap())?;
        std::fs::write(&path, &file.contents)?;
    }
    let width = files.iter().map(|file| file.path.len()).max().unwrap_or(0);
    let place = label
        .as_ref()
        .map(|label| format!(" in {label}"))
        .unwrap_or_else(|| " here".into());
    println!("{}{place}.\n", green("Created a new imp project"));
    for file in &files {
        println!(
            "  {}  {}",
            bold(format!("{:<width$}", file.path)),
            dim(note_for(file))
        );
    }
    if let Some(appended) = files
        .iter()
        .find_map(|file| file.appended.as_ref().filter(|list| !list.is_empty()))
    {
        println!();
        logger::warn(&format!(
            ".gitignore already existed - appended {} to it and left everything else in it untouched",
            appended.join(", ")
        ));
    }
    println!("\n{}", bold("Next steps:"));
    if let Some(label) = &label {
        println!("  cd {label}");
    }
    println!(
        "  imp start        {}",
        dim("serve the app with live reload")
    );
    println!(
        "  imp test --unit  {}",
        dim("run the unit test (--e2e for the browser spec)")
    );
    if pwa {
        println!(
            "  imp build --pwa  {}",
            dim("build an installable, offline app into dist/")
        );
    }
    println!(
        "  imp skill        {}",
        dim("read imp's manuals - an AI agent starts here")
    );
    println!(
        "\nThe font is {}, {choice}. An AI agent keeps it and follows `imp skill init`\nto give the app a theme of its own.",
        chosen.name
    );
    println!("Now point your AI agent at `imp skill` and start building!");
    Ok(())
}
