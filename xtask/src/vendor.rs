use crate::workspace::repo_root;
use imp::bundler::{Assets, Format, ImpLibrary, LegalComments, Options, bundle};

pub const PUPPETEER_VERSION: &str = "25.16.0";

pub fn puppeteer() -> anyhow::Result<()> {
    let root = repo_root();
    let target = root.join("cli").join("vendor").join("puppeteer");
    let mut options = Options::new(&root);
    options.entries.push((
        Some("puppeteer".into()),
        format!("npm:puppeteer-core@{PUPPETEER_VERSION}/lib/puppeteer/puppeteer-core-browser.js"),
    ));
    options.imp = ImpLibrary::External;
    options.externals = vec![
        "node:*".into(),
        "@puppeteer/browsers".into(),
        "ws".into(),
        "chromium-bidi".into(),
    ];
    options.format = Format::Esm;
    options.minify = true;
    options.split = true;
    options.assets = Assets::Files;
    options.legal_comments = LegalComments::Inline;
    options.entry_names = "[name].js".into();
    options.chunk_names = "[name]-[hash].js".into();
    let bundled = bundle(options).map_err(|error| anyhow::anyhow!("{error}"))?;
    let _ = std::fs::remove_dir_all(&target);
    std::fs::create_dir_all(&target)?;
    let banner = format!("// puppeteer-core@{PUPPETEER_VERSION}\n");
    for chunk in &bundled.chunks {
        std::fs::write(
            target.join(&chunk.file_name),
            format!("{banner}{}", chunk.code),
        )?;
        println!(
            "  cli/vendor/puppeteer/{} ({} kB)",
            chunk.file_name,
            chunk.code.len() / 1024
        );
    }
    let packages = imp::deps::bundled_packages(&bundled.inputs);
    let lines: Vec<String> = imp::dependency_manifest::record_package_licenses(&packages)
        .iter()
        .map(|record| {
            let mut parts = vec![
                format!(
                    "{}@{}",
                    record["name"].as_str().unwrap_or(""),
                    record["version"].as_str().unwrap_or("")
                ),
                record["license"].as_str().unwrap_or("unknown").to_string(),
            ];
            parts.extend(crate::licenses::copyright_lines(
                record["licenseText"].as_str().unwrap_or(""),
            ));
            parts.join(" - ")
        })
        .collect();
    let path = root.join(crate::licenses::LICENSES_FILE);
    let text = std::fs::read_to_string(&path)?;
    std::fs::write(
        &path,
        crate::licenses::replace_section(
            &text,
            crate::licenses::DRIVER_HEADING,
            &crate::licenses::driver_section(&lines),
        ),
    )?;
    println!(
        "  {} packages recorded in {}",
        lines.len(),
        crate::licenses::LICENSES_FILE
    );
    Ok(())
}

const LUCIDE_VERSION: &str = "1.38.0";

fn pascal_case(name: &str) -> String {
    name.split('-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().chain(chars).collect::<String>(),
                None => String::new(),
            }
        })
        .collect()
}

fn single_quoted(value: &serde_json::Value) -> String {
    let text = match value {
        serde_json::Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    format!("'{}'", text.replace('\\', "\\\\").replace('\'', "\\'"))
}

fn icon_declaration(name: &str, nodes: &serde_json::Value) -> String {
    let drawing: Vec<String> = nodes
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .map(|node| {
            let attributes: Vec<String> = node[1]
                .as_object()
                .map(|values| {
                    values
                        .iter()
                        .map(|(key, value)| format!("{key}: {}", single_quoted(value)))
                        .collect()
                })
                .unwrap_or_default();
            format!(
                "[{}, {{ {} }}]",
                single_quoted(&node[0]),
                attributes.join(", ")
            )
        })
        .collect();
    format!(
        "export const lu{} = [{}]",
        pascal_case(name),
        drawing.join(", ")
    )
}

pub fn lucide() -> anyhow::Result<()> {
    let npm = imp::npm::shared()?;
    let package = npm.ensure("lucide-static", LUCIDE_VERSION)?;
    let nodes: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(
        package.directory.join("icon-nodes.json"),
    )?)?;
    let mut icons: Vec<(&String, &serde_json::Value)> = nodes
        .as_object()
        .ok_or_else(|| anyhow::anyhow!("icon-nodes.json holds no object"))?
        .iter()
        .collect();
    icons.sort_by_key(|(a, _)| *a);
    let notice = format!(
        "/*!
 * Lucide {LUCIDE_VERSION} - https://lucide.dev
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 * All other copyright (c) for Lucide are held by Lucide Contributors 2022 (ISC).
 *
 * Icons only, as their drawing instructions. The artwork is unchanged; imp reshapes each icon
 * into a list of [element, attributes] pairs and renames it from 'user' to 'luUser'.
 */"
    );
    let mut lines = vec![
        "// Generated by cargo xtask vendor-lucide - do not edit".to_string(),
        notice,
        String::new(),
    ];
    lines.extend(
        icons
            .iter()
            .map(|(name, nodes)| icon_declaration(name, nodes)),
    );
    lines.push(String::new());
    let target = repo_root().join("lib/src/icons/lucide-icons.js");
    std::fs::create_dir_all(target.parent().unwrap())?;
    let text = lines.join("\n");
    std::fs::write(&target, &text)?;
    eprintln!(
        "wrote lib/src/icons/lucide-icons.js - Lucide {LUCIDE_VERSION}, {} icons, {} kB",
        icons.len(),
        (text.len() as f64 / 1024.0).round()
    );
    Ok(())
}
