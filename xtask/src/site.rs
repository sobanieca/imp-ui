use crate::script::call_export;
use crate::workspace::{build_imp, repo_root, run_imp};
use anyhow::{Context, Result, bail};
use pulldown_cmark::{CodeBlockKind, CowStr, Event, Options, Parser, Tag, TagEnd, html};
use serde_json::{Map, Value, json};
use std::path::Path;
use std::process::Command;

const INSTALL_SCRIPTS: &[&str] = &["install.sh", "install.ps1"];

const COPIES: &[(&str, &str)] = &[
    ("cli/templates/favicon.ico", "favicon.ico"),
    ("site/aly.js", "aly.js"),
];

const ALY_SERVER_ENV: &str = "IMP_SITE_ALY_SERVER";

fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn slug_of_heading(inner_html: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;
    for char in inner_html.chars() {
        match char {
            '<' => in_tag = true,
            '>' if in_tag => in_tag = false,
            _ if !in_tag => text.push(char),
            _ => {}
        }
    }
    let kept: String = text
        .to_lowercase()
        .chars()
        .filter(|char| {
            char.is_alphanumeric() || *char == '_' || *char == '-' || char.is_whitespace()
        })
        .collect();
    kept.split_whitespace().collect::<Vec<_>>().join("-")
}

fn doc_link(href: &str) -> Option<String> {
    let (path, anchor) = match href.find('#') {
        Some(index) => (&href[..index], &href[index..]),
        None => (href, ""),
    };
    let name = path.strip_suffix(".md")?;
    let valid = !name.is_empty()
        && name
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || char == '_' || char == '-');
    valid.then(|| format!("/docs/{name}{anchor}"))
}

fn is_external(target: &str) -> bool {
    let Some((scheme, _)) = target.split_once(':') else {
        return false;
    };
    let mut chars = scheme.chars();
    chars
        .next()
        .is_some_and(|first| first.is_ascii_alphabetic())
        && chars.all(|char| char.is_ascii_alphanumeric() || "+.-".contains(char))
}

fn link_open(href: &str, title: &str) -> String {
    let target = doc_link(href).unwrap_or_else(|| href.to_string());
    let mut attributes = vec![format!("href=\"{}\"", escape(&target))];
    if !title.is_empty() {
        attributes.push(format!("title=\"{}\"", escape(title)));
    }
    if is_external(&target) {
        attributes.push("target=\"_blank\" rel=\"noopener\"".into());
    }
    format!("<a {}>", attributes.join(" "))
}

fn render_markdown(text: String) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    let mut events: Vec<Event> = Vec::new();
    let mut blocks: Vec<Value> = Vec::new();
    let mut heading: Option<(u8, Vec<Event>)> = None;
    let mut code: Option<(String, String)> = None;
    for event in Parser::new_ext(&text, options) {
        if let Some((language, source)) = code.as_mut() {
            match event {
                Event::Text(part) => source.push_str(&part),
                Event::End(TagEnd::CodeBlock) => {
                    let source = source.strip_suffix('\n').unwrap_or(source).to_string();
                    events.push(Event::Html(CowStr::from(format!(
                        "<!--imp-code-{}-->",
                        blocks.len()
                    ))));
                    blocks.push(json!({ "text": source, "lang": language }));
                    code = None;
                }
                _ => {}
            }
            continue;
        }
        let rewritten = match event {
            Event::Start(Tag::CodeBlock(kind)) => {
                let language = match kind {
                    CodeBlockKind::Fenced(info) => info.to_string(),
                    CodeBlockKind::Indented => String::new(),
                };
                code = Some((language, String::new()));
                continue;
            }
            Event::Start(Tag::Heading { level, .. }) => {
                heading = Some((level as u8, Vec::new()));
                continue;
            }
            Event::End(TagEnd::Heading(_)) => {
                let (level, inner) = heading.take().unwrap_or_default();
                let mut inner_html = String::new();
                html::push_html(&mut inner_html, inner.into_iter());
                Event::Html(CowStr::from(format!(
                    "<h{level} id=\"{}\">{inner_html}</h{level}>\n",
                    slug_of_heading(&inner_html)
                )))
            }
            Event::Start(Tag::Link {
                dest_url, title, ..
            }) => Event::InlineHtml(CowStr::from(link_open(&dest_url, &title))),
            Event::End(TagEnd::Link) => Event::InlineHtml(CowStr::from("</a>")),
            other => other,
        };
        match heading.as_mut() {
            Some((_, inner)) => inner.push(rewritten),
            None => events.push(rewritten),
        }
    }
    let mut out = String::new();
    html::push_html(&mut out, events.into_iter());
    json!({ "html": out, "blocks": blocks }).to_string()
}

fn copy_folder(from: &Path, to: &Path) -> Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            std::fs::copy(entry.path(), to.join(entry.file_name()))?;
        }
    }
    Ok(())
}

pub fn build_site() -> Result<()> {
    let root = repo_root();
    let dist = root.join("site").join("dist");
    let origin = std::env::var("IMP_SITE_URL")
        .ok()
        .map(|origin| origin.trim_end_matches('/').to_string())
        .filter(|origin| !origin.is_empty());
    let aly = std::env::var(ALY_SERVER_ENV)
        .ok()
        .map(|server| server.trim_end_matches('/').to_string())
        .filter(|server| !server.is_empty());
    let mut docs = Map::new();
    for entry in std::fs::read_dir(root.join("docs"))? {
        let path = entry?.path();
        if path.extension().is_some_and(|extension| extension == "md") {
            let slug = path.file_stem().unwrap().to_string_lossy().into_owned();
            docs.insert(slug, Value::String(std::fs::read_to_string(&path)?));
        }
    }
    let input = json!({
        "docs": docs,
        "overview": std::fs::read_to_string(root.join("site/content/overview.md"))?,
        "version": imp::version::VERSION,
        "origin": origin,
        "aly": aly,
    });
    let built = call_export(
        &root.join("site/build/site.js"),
        "buildSite",
        &input,
        &[("markdown", render_markdown)],
    )?;
    let _ = std::fs::remove_dir_all(&dist);
    std::fs::create_dir_all(&dist)?;
    let files = built["files"]
        .as_object()
        .context("buildSite returned no files")?;
    for (path, text) in files {
        let target = dist.join(path);
        std::fs::create_dir_all(target.parent().unwrap())?;
        std::fs::write(target, text.as_str().unwrap_or(""))?;
    }
    for script in INSTALL_SCRIPTS {
        std::fs::copy(root.join(script), dist.join(script))?;
    }
    for (from, to) in COPIES {
        std::fs::copy(root.join(from), dist.join(to))?;
    }
    copy_folder(&root.join("lib/src/public/fonts"), &dist.join("fonts"))?;
    let binary = build_imp("dev")?;
    let gallery = dist.join("gallery");
    run_imp(
        &binary,
        &["preview", "--output", &gallery.to_string_lossy()],
        &root.join("lib/src"),
    )?;
    let pages = built["pages"].as_u64().unwrap_or(0);
    match &aly {
        Some(server) => println!("site: records of the pages are sent to imp-aly at {server}"),
        None => println!("site: set {ALY_SERVER_ENV} to send the records of the pages to imp-aly"),
    }
    match origin {
        Some(origin) => {
            println!("site: {pages} pages written into site/dist/, with a sitemap for {origin}")
        }
        None => println!(
            "site: {pages} pages written into site/dist/ (set IMP_SITE_URL for canonical links and a sitemap)"
        ),
    }
    Ok(())
}

pub fn serve_site() -> Result<()> {
    build_site()?;
    let status = Command::new("rfm")
        .current_dir(repo_root().join("site/dist"))
        .status()
        .context(
            "cannot run rfm - install it from https://adam.sobaniec.com/remote-file-manager/",
        )?;
    if !status.success() {
        bail!("rfm failed");
    }
    Ok(())
}
