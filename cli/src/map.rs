use crate::bundler::{Assets, Format, ImpLibrary, Options, VirtualModule, bundle};
use crate::colors::{bold, dim};
use crate::config::{dependencies, get_str, load_imp_config, project_root};
use crate::paths::{absolute, relative_posix};
use anyhow::{Result, anyhow, bail};
use serde_json::Value;
use std::collections::BTreeSet;
use std::path::Path;

const MAP_KEY: &str = "imp.appMap";
const ENTRY_ID: &str = "imp-map-entry";
const INDENT: &str = "  ";

fn read_maps(target: &Path, root: &Path, dependencies: &[String]) -> Result<Vec<Value>> {
    let mut options = Options::new(root);
    options.virtual_modules.insert(
        ENTRY_ID.into(),
        VirtualModule {
            code: format!(
                "import * as mapModule from {}\nglobalThis.__impMapModule = mapModule\n",
                serde_json::to_string(&target.to_string_lossy())?
            ),
            resolve_dir: root.to_path_buf(),
        },
    );
    options.entries.push((None, ENTRY_ID.into()));
    options.dependencies = dependencies.to_vec();
    options.imp = ImpLibrary::Tooling;
    options.format = Format::Iife;
    options.assets = Assets::DataUrl;
    let bundled = bundle(options).map_err(|error| anyhow!("{error}"))?;
    let input = serde_json::json!({ "key": MAP_KEY }).to_string();
    let output = crate::script_engine::evaluate(bundled.entry_code(), "map-reader.js", &input, "map - ")
        .map_err(|failure| {
            anyhow!(
                "{} failed to load - {failure}; a map module holds data, so it must not use the DOM when it loads",
                relative_posix(root, target)
            )
        })?;
    match serde_json::from_str(&output)? {
        Value::Array(maps) => Ok(maps),
        _ => Ok(Vec::new()),
    }
}

pub fn route_patterns_of_project(
    root: &Path,
    map: &str,
    dependencies: &[String],
) -> Result<Vec<String>> {
    let maps = read_maps(&absolute(root.join(map)), root, dependencies)?;
    let mut patterns = BTreeSet::new();
    for map in maps
        .iter()
        .filter(|map| map["grafted"] != Value::Bool(true))
    {
        for pattern in map["patterns"].as_array().into_iter().flatten() {
            if let Some(pattern) = pattern.as_str() {
                patterns.insert(pattern.to_string());
            }
        }
    }
    Ok(patterns.into_iter().collect())
}

fn notes_of(node: &Value) -> Vec<String> {
    let mut notes = Vec::new();
    if let Some(access) = node["access"].as_str() {
        notes.push(format!("access: {access}"));
    }
    let mut nav = Vec::new();
    if node["hidden"] == Value::Bool(true) {
        nav.push("hidden from the nav".to_string());
    }
    if let Some(group) = node["group"].as_str() {
        nav.push(format!("group '{group}'"));
    }
    if !nav.is_empty() {
        notes.push(nav.join(", "));
    }
    notes
}

fn text(value: &Value) -> &str {
    value.as_str().unwrap_or("")
}

fn render_map(map: &Value) -> String {
    let mut lines = Vec::new();
    let props = &map["props"];
    let mut notes = notes_of(props);
    if let Some(description) = props["description"].as_str() {
        notes.push(description.to_string());
    }
    let described = if notes.is_empty() {
        String::new()
    } else {
        format!(
            " {}",
            dim(format!("- a part of another map: {}", notes.join(" | ")))
        )
    };
    lines.push(format!("{}{described}", bold(text(&map["name"]))));
    let rows: Vec<&Value> = map["rows"]
        .as_array()
        .map(|rows| rows.iter().collect())
        .unwrap_or_default();
    if rows.is_empty() {
        lines.push(format!("{INDENT}{}", dim("(no nodes)")));
        return lines.join("\n");
    }
    let depth = |row: &Value| row["depth"].as_u64().unwrap_or(1) as usize;
    let width = rows
        .iter()
        .map(|row| depth(row) * INDENT.len() + text(&row["location"]).chars().count())
        .max()
        .unwrap_or(0);
    for row in rows {
        let head = format!("{}{}", INDENT.repeat(depth(row)), text(&row["location"]));
        let padded = format!("{head:<width$}", width = width + 2);
        let notes = notes_of(row).join(" | ");
        let notes = if notes.is_empty() {
            String::new()
        } else {
            format!("  {}", dim(notes))
        };
        lines.push(format!("{padded}{}{notes}", text(&row["label"])));
        if !text(&row["description"]).is_empty() {
            lines.push(format!(
                "{}{}",
                INDENT.repeat(depth(row) + 1),
                dim(text(&row["description"]))
            ));
        }
    }
    lines.join("\n")
}

pub fn print_map(cwd: &Path, file: Option<String>) -> Result<()> {
    let root = project_root(cwd);
    let config = load_imp_config(&root)?;
    let declared = get_str(&config, &["map"]);
    let target = match (&file, declared) {
        (Some(file), _) => absolute(cwd.join(file)),
        (None, Some(map)) => absolute(root.join(map)),
        (None, None) => bail!(
            "imp.json has no 'map' - add \"map\": \"src/app-map.js\", the file that exports appMap(), or pass a file: imp map src/admin/map.js"
        ),
    };
    if !target.exists() {
        let shown = relative_posix(cwd, &target);
        bail!(
            "no map at {} - imp map reads the file that exports appMap(), {}",
            if shown.is_empty() {
                target.display().to_string()
            } else {
                shown
            },
            if file.is_none() {
                "the 'map' of imp.json"
            } else {
                "the file you pass"
            }
        );
    }
    let aliases: Vec<String> = dependencies(&config)
        .into_iter()
        .map(|(alias, _)| alias)
        .collect();
    let maps = read_maps(&target, &root, &aliases)?;
    if maps.is_empty() {
        bail!(
            "{} exports no map - export the value of appMap(), like export const app = appMap({{ ... }})",
            relative_posix(cwd, &target)
        );
    }
    println!(
        "{}",
        maps.iter().map(render_map).collect::<Vec<_>>().join("\n\n")
    );
    Ok(())
}
