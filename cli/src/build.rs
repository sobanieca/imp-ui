use crate::base_path::{base_path_of, site_url};
use crate::bundler::{
    Assets, Bundle, Format, ImpLibrary, LegalComments, Options, VirtualModule, bundle,
};
use crate::config::{get_path, load_imp_config, mocks_setting, public_directory};
use crate::environments::{env_values_script, resolve_environment};
use crate::file_size::format_size;
use crate::flags::split_env_and_flags;
use crate::html_document::{
    Edit, apply_edits, head_edit, is_local_script_source, is_module_type, read_html,
};
use crate::license_notices::{
    LICENSE_NOTICES_FILE, collect_license_notices, license_notices_reference,
    unrecorded_licenses_warning,
};
use crate::license_policy::{license_policy, license_violation_problem, review_licenses};
use crate::logger;
use crate::names::APP_ANALYTICS_FILE;
use crate::paths::{absolute, cwd, file_name, is_within, normalize, posix, relative_posix};
use crate::pwa::{
    APPLE_TOUCH_ICON, build_manifest, cache_version, pwa_head_tags, render_icon_set,
    service_worker_registration, validate_pwa_build,
};
use crate::service_worker::{
    OFFLINE_WORKER_SOURCE, WORKER_ENTRY, assert_service_worker_source, precache_url,
    precache_values, precached_public_file, runtime_values, worker_entry,
};
use crate::skill::{COMPONENT_SKILL_FILE, skill_file_for};
use anyhow::{Result, anyhow, bail};
use serde_json::{Value, json};
use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};

pub struct BuildOptions {
    pub entry: String,
    pub output: String,
    pub env: Option<String>,
}

const FLAGS_GLOBAL: &str = "globalThis.__IMP_FLAGS__";
const HASHED_FOLDER: &str = "chunks";
const SERVICE_WORKER_FILE: &str = "sw.js";
const INLINE_ENTRY: &str = "imp-inline:";

pub fn production_defines() -> Vec<(String, String)> {
    vec![("globalThis.__IMP_DEV__".into(), "false".into())]
}

fn decode_uri(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%'
            && index + 2 < bytes.len()
            && let Ok(byte) = u8::from_str_radix(&text[index + 1..index + 3], 16)
        {
            out.push(byte);
            index += 3;
            continue;
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn script_path_of(src: &str, root: &Path) -> PathBuf {
    let path = decode_uri(src.split(['?', '#']).next().unwrap_or(""));
    normalize(&root.join(path.trim_start_matches('/')))
}

fn read_entry_skill(entry: &Path) -> Result<String> {
    let skill_file = skill_file_for(entry);
    match std::fs::read_to_string(&skill_file) {
        Ok(text) => Ok(format!("{}\n", text.trim_end())),
        Err(_) => bail!(
            "no skill for {} - a JS entry is a component, and imp build writes its manual to {COMPONENT_SKILL_FILE} from {} next to it",
            file_name(entry),
            file_name(&skill_file)
        ),
    }
}

fn inline_code_warning(entry_name: &str, inline: &[crate::html_document::InlineCode]) -> String {
    let mut lines = vec![format!(
        "{entry_name} has inline code that the Content Security Policy script-src 'self'; style-src 'self' blocks:"
    )];
    for code in inline {
        lines.push(format!(
            "  {entry_name}:{} - {} - {}",
            code.line, code.construct, code.advice
        ));
    }
    lines.join("\n")
}

fn content_hash(text: &[u8]) -> String {
    crate::http_client::sha256_hex(text)[..8].to_string()
}

fn write_hashed_script(
    outdir: &Path,
    name: &str,
    text: &str,
    written: &mut Vec<String>,
) -> Result<String> {
    let file = format!(
        "{HASHED_FOLDER}/{name}-{}.js",
        content_hash(text.as_bytes())
    );
    std::fs::create_dir_all(outdir.join(HASHED_FOLDER))?;
    std::fs::write(outdir.join(&file), text)?;
    written.push(file.clone());
    Ok(file)
}

fn copy_public_files(
    public: &Path,
    outdir: &Path,
    written: &mut Vec<String>,
    reserved: &[&str],
) -> Result<()> {
    let Ok(meta) = std::fs::metadata(public) else {
        return Ok(());
    };
    if !meta.is_dir() {
        bail!("public must be a folder, not a file: {}", public.display());
    }
    if public.join(HASHED_FOLDER).exists() {
        bail!(
            "public/{HASHED_FOLDER}/ is reserved - imp writes the hashed files of the build there, and a host caches that folder for a year; move the files to another folder"
        );
    }
    let generated: BTreeSet<String> = written
        .iter()
        .cloned()
        .chain(reserved.iter().map(|name| name.to_string()))
        .collect();
    fn copy(
        directory: &Path,
        prefix: &str,
        outdir: &Path,
        generated: &BTreeSet<String>,
        written: &mut Vec<String>,
    ) -> Result<()> {
        let mut entries: Vec<_> = std::fs::read_dir(directory)?.flatten().collect();
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let name = format!("{prefix}{}", entry.file_name().to_string_lossy());
            let kind = entry.file_type()?;
            if kind.is_dir() {
                copy(
                    &entry.path(),
                    &format!("{name}/"),
                    outdir,
                    generated,
                    written,
                )?;
            } else if kind.is_file() {
                if generated.contains(&name) {
                    bail!("public file would overwrite a generated file: {name}");
                }
                let target = outdir.join(&name);
                std::fs::create_dir_all(target.parent().unwrap())?;
                std::fs::copy(entry.path(), &target)?;
                written.push(name);
            }
        }
        Ok(())
    }
    copy(public, "", outdir, &generated, written)
}

fn is_root_absolute(url: &str) -> bool {
    url.starts_with('/') && !url.starts_with("//")
}

fn static_imports_of(bundle: &Bundle, entries: &[String]) -> Vec<String> {
    let by_name: HashMap<&str, &crate::bundler::Chunk> = bundle
        .chunks
        .iter()
        .map(|chunk| (chunk.file_name.as_str(), chunk))
        .collect();
    let mut pending: Vec<String> = entries
        .iter()
        .filter(|entry| by_name.contains_key(entry.as_str()))
        .cloned()
        .collect();
    let entry_set: BTreeSet<String> = pending.iter().cloned().collect();
    let mut reached: Vec<String> = Vec::new();
    while let Some(key) = pending.pop() {
        let Some(chunk) = by_name.get(key.as_str()) else {
            continue;
        };
        for imported in &chunk.imports {
            if !by_name.contains_key(imported.as_str())
                || reached.contains(imported)
                || entry_set.contains(imported)
            {
                continue;
            }
            reached.push(imported.clone());
            pending.push(imported.clone());
        }
    }
    reached
}

fn assert_within_budget(
    config: &crate::config::Config,
    outdir: &Path,
    written: &[String],
) -> Result<()> {
    let Some(budget) = get_path(config, &["build", "maxSize"]).and_then(Value::as_u64) else {
        return Ok(());
    };
    let mut sizes: Vec<(String, u64)> = written
        .iter()
        .map(|name| {
            (
                name.clone(),
                std::fs::metadata(outdir.join(name))
                    .map(|meta| meta.len())
                    .unwrap_or(0),
            )
        })
        .collect();
    let total: u64 = sizes.iter().map(|(_, size)| size).sum();
    if total <= budget {
        return Ok(());
    }
    let _ = std::fs::remove_dir_all(outdir);
    sizes.sort_by_key(|size| std::cmp::Reverse(size.1));
    let largest: Vec<String> = sizes
        .iter()
        .take(5)
        .map(|(name, size)| format!("  {name} ({})", format_size(*size)))
        .collect();
    bail!(
        "the build is {}, over the budget of {} that 'build.maxSize' sets in imp.json. imp wrote nothing. The largest files:\n{}",
        format_size(total),
        format_size(budget),
        largest.join("\n")
    )
}

fn bundle_failure(error: crate::bundler::BundleError) -> anyhow::Error {
    anyhow!("{error}")
}

pub fn build(options: BuildOptions) -> Result<()> {
    let entry_path = crate::entry::resolve_entry_path(&options.entry, "an HTML or JS file")?;
    let root = entry_path.parent().unwrap().to_path_buf();
    let entry_name = file_name(&entry_path);
    let outdir = absolute(&options.output);
    let config = load_imp_config(&root)?;
    let dependencies: Vec<String> = crate::config::dependencies(&config)
        .into_iter()
        .map(|(alias, _)| alias)
        .collect();
    let selected_env = resolve_environment(&root, &config, options.env.as_deref())?;
    let (env, flags) = split_env_and_flags(&config, &selected_env)?;
    let is_html_entry = matches!(
        crate::paths::extension(&entry_path).as_str(),
        "html" | "htm"
    );
    let target_imp_host = config.get("targetImpHost").and_then(Value::as_bool) == Some(true);
    let imp_provided_by_host = target_imp_host && !is_html_entry;
    let pwa_config = config
        .get("pwa")
        .and_then(Value::as_object)
        .filter(|_| is_html_entry)
        .cloned();
    if let Some(pwa) = &pwa_config {
        validate_pwa_build(pwa, &root)?;
    }
    let service_worker_declared = config
        .get("serviceWorker")
        .and_then(Value::as_str)
        .map(String::from);
    let service_worker = service_worker_declared
        .as_ref()
        .filter(|_| is_html_entry)
        .map(|declared| root.join(declared));
    if let (Some(worker), Some(declared)) = (&service_worker, &service_worker_declared) {
        assert_service_worker_source(worker, declared)?;
    }

    let mut html = String::new();
    let mut document = None;
    let mut scripts: Vec<PathBuf> = vec![entry_path.clone()];
    let mut inline_sources: Vec<String> = Vec::new();
    if is_html_entry {
        html = std::fs::read_to_string(&entry_path)?;
        let parsed = read_html(&html);
        if !parsed.inline_code.is_empty() {
            logger::warn(&inline_code_warning(&entry_name, &parsed.inline_code));
        }
        scripts.clear();
        for script in parsed
            .scripts
            .iter()
            .filter(|script| is_module_type(script.kind.as_deref()))
        {
            match &script.src {
                Some(src) => {
                    if !is_local_script_source(src) {
                        continue;
                    }
                    let path = script_path_of(src, &root);
                    if !is_within(&root, &path) {
                        bail!("{entry_name} references a script outside the project: {src}");
                    }
                    if !scripts.contains(&path) {
                        scripts.push(path);
                    }
                }
                None if !script.text.trim().is_empty() => inline_sources.push(script.text.clone()),
                None => {}
            }
        }
        document = Some(parsed);
    }
    let mut sources: Vec<&Path> = vec![&entry_path];
    sources.extend(scripts.iter().map(PathBuf::as_path));
    if let Some(worker) = &service_worker {
        sources.push(worker);
    }
    crate::output_folder::assert_output_folder(&outdir, &options.output, &root, &sources, false)?;
    if scripts.is_empty() && inline_sources.is_empty() {
        bail!("{entry_name} has no module scripts to bundle");
    }

    let base = base_path_of(&env);
    let map = if is_html_entry {
        config.get("map").and_then(Value::as_str).map(String::from)
    } else {
        None
    };
    let component_skill = if is_html_entry {
        None
    } else {
        Some(read_entry_skill(&entry_path)?)
    };

    let mut bundle_options = Options::new(&root);
    for script in &scripts {
        let relative = relative_posix(&root, script);
        let name = if is_html_entry {
            crate::paths::without_extension(relative.rsplit('/').next().unwrap_or(&relative))
                .to_string()
        } else {
            crate::paths::without_extension(&relative).to_string()
        };
        bundle_options
            .entries
            .push((Some(name), script.to_string_lossy().into_owned()));
    }
    for (index, source) in inline_sources.iter().enumerate() {
        let key = format!("{INLINE_ENTRY}{index}");
        bundle_options.virtual_modules.insert(
            key.clone(),
            VirtualModule {
                code: source.clone(),
                resolve_dir: root.clone(),
            },
        );
        bundle_options
            .entries
            .push((Some(format!("inline-{}", index + 1)), key));
    }
    bundle_options.dependencies = dependencies.clone();
    bundle_options.imp = ImpLibrary::Bundled;
    bundle_options.external_imp = imp_provided_by_host;
    bundle_options.flags = Some(flags.clone());
    bundle_options.reject_css = true;
    bundle_options.minify = true;
    bundle_options.split = true;
    bundle_options.assets = Assets::Files;
    bundle_options.legal_comments = LegalComments::External;
    bundle_options.define = production_defines();
    bundle_options.entry_names = if is_html_entry {
        format!("{HASHED_FOLDER}/[name]-[hash].js")
    } else {
        "[name].js".into()
    };
    bundle_options.chunk_names = format!("{HASHED_FOLDER}/[name]-[hash].js");
    bundle_options.asset_names = format!("{HASHED_FOLDER}/[name]-[hash][extname]");
    bundle_options.public_path = if is_html_entry {
        Some(format!("{base}/"))
    } else {
        None
    };

    let pages = match &map {
        Some(map) => Some(crate::map::route_patterns_of_project(
            &root,
            map,
            &dependencies,
        )?),
        None => None,
    };
    let bundled = bundle(bundle_options).map_err(bundle_failure)?;
    let analytics = match pages {
        Some(pages) => {
            let inline_map: HashMap<String, String> = inline_sources
                .iter()
                .enumerate()
                .map(|(index, source)| (format!("{INLINE_ENTRY}{index}"), source.clone()))
                .collect();
            let (zones, outcomes) =
                crate::analytics_names::collect_bundle_names(&root, &bundled.inputs, &inline_map)?;
            Some((pages, zones, outcomes))
        }
        None => None,
    };
    let entry_outputs: HashMap<String, String> = bundled
        .chunks
        .iter()
        .filter(|chunk| chunk.is_entry)
        .filter_map(|chunk| {
            chunk
                .facade_module_id
                .clone()
                .map(|id| (id, chunk.file_name.clone()))
        })
        .collect();
    let worker_bundle = if service_worker.is_some() || pwa_config.is_some() {
        let mut worker_options = Options::new(&root);
        worker_entry(&mut worker_options, &root, OFFLINE_WORKER_SOURCE);
        let entry = service_worker
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|| WORKER_ENTRY.into());
        worker_options.entries.push((Some("sw".into()), entry));
        worker_options.dependencies = dependencies.clone();
        worker_options.imp = ImpLibrary::Bundled;
        worker_options.flags = Some(flags.clone());
        worker_options.reject_css = true;
        worker_options.minify = true;
        worker_options.format = Format::Iife;
        worker_options.assets = Assets::Files;
        worker_options.legal_comments = LegalComments::External;
        worker_options.define = production_defines();
        worker_options.entry_names = "[name].js".into();
        worker_options.asset_names = format!("{HASHED_FOLDER}/[name]-[hash][extname]");
        worker_options.public_path = Some(format!("{base}/"));
        Some(bundle(worker_options).map_err(bundle_failure)?)
    } else {
        None
    };

    if let Some(unfolded) = bundled
        .chunks
        .iter()
        .find(|chunk| chunk.code.contains(FLAGS_GLOBAL))
    {
        bail!(
            "{} still reads a build flag at runtime - every flag must be called as flag('NAME') with a literal name, from a module that imports flag from 'imp', so the build can fold it away",
            unfolded
                .file_name
                .rsplit('/')
                .next()
                .unwrap_or(&unfolded.file_name)
        );
    }

    let mut inputs = bundled.inputs.clone();
    let mut legal = bundled.legal.clone();
    if let Some(worker) = &worker_bundle {
        inputs.extend(worker.inputs.iter().cloned());
        for comment in &worker.legal {
            if !legal.contains(comment) {
                legal.push(comment.clone());
            }
        }
    }
    let bundles_library = bundled.bundles_imp_library()
        || worker_bundle
            .as_ref()
            .is_some_and(Bundle::bundles_imp_library);
    let (notices, manifests, unrecorded) =
        collect_license_notices(&root, &dependencies, &inputs, bundles_library, legal)?;
    if !unrecorded.is_empty() {
        logger::warn(&unrecorded_licenses_warning(&unrecorded));
    }
    let policy = license_policy(&config);
    let (violations, _) = review_licenses(&manifests, &policy);
    if !violations.is_empty() {
        bail!("{}", license_violation_problem(&violations, &policy));
    }
    let notice_count = notices.count();
    let notice_reference = if notice_count > 0 {
        license_notices_reference(&site_url(&base, LICENSE_NOTICES_FILE))
    } else {
        String::new()
    };

    crate::output_folder::replace_output_folder(&outdir)?;
    let mut written: Vec<String> = Vec::new();
    for chunk in &bundled.chunks {
        let path = outdir.join(&chunk.file_name);
        std::fs::create_dir_all(path.parent().unwrap())?;
        std::fs::write(&path, format!("{notice_reference}{}", chunk.code))?;
        written.push(chunk.file_name.clone());
    }
    for asset in bundled
        .assets
        .iter()
        .chain(worker_bundle.iter().flat_map(|worker| worker.assets.iter()))
    {
        let path = outdir.join(&asset.file_name);
        std::fs::create_dir_all(path.parent().unwrap())?;
        std::fs::write(&path, &asset.bytes)?;
        if !written.contains(&asset.file_name) {
            written.push(asset.file_name.clone());
        }
    }
    if notice_count > 0 {
        std::fs::write(outdir.join(LICENSE_NOTICES_FILE), notices.file())?;
        written.push(LICENSE_NOTICES_FILE.into());
    }
    if let Some((pages, zones, outcomes)) = &analytics {
        let text = format!(
            "{}\n",
            crate::json::pretty(&json!({ "pages": pages, "zones": zones, "outcomes": outcomes }))
        );
        std::fs::write(outdir.join(APP_ANALYTICS_FILE), text)?;
        written.push(APP_ANALYTICS_FILE.into());
    }
    if let Some(skill) = &component_skill {
        std::fs::write(outdir.join(COMPONENT_SKILL_FILE), skill)?;
        written.push(COMPONENT_SKILL_FILE.into());
    }
    if let Some(document) = &document {
        let entry_files: Vec<String> = entry_outputs.values().cloned().collect();
        let mut head_tags: Vec<String> = static_imports_of(&bundled, &entry_files)
            .iter()
            .map(|file| {
                format!(
                    "<link rel=\"modulepreload\" href=\"{}\">",
                    site_url(&base, file)
                )
            })
            .collect();
        if !env.is_empty() {
            let file = write_hashed_script(&outdir, "env", &env_values_script(&env), &mut written)?;
            head_tags.push(format!(
                "<script src=\"{}\"></script>",
                site_url(&base, &file)
            ));
        }
        if let Some(pwa) = &pwa_config {
            for icon in render_icon_set(&root, pwa)? {
                let path = outdir.join(icon.file);
                std::fs::create_dir_all(path.parent().unwrap())?;
                std::fs::write(&path, &icon.bytes)?;
                written.push(icon.file.into());
            }
            std::fs::write(
                outdir.join("manifest.webmanifest"),
                build_manifest(
                    pwa,
                    &format!("{base}/"),
                    &format!("{base}/"),
                    &format!("{base}/"),
                ),
            )?;
            written.push("manifest.webmanifest".into());
            head_tags.push(pwa_head_tags(
                &site_url(&base, "manifest.webmanifest"),
                pwa.get("themeColor").and_then(Value::as_str),
                &site_url(&base, APPLE_TOUCH_ICON),
            ));
            let registration = write_hashed_script(
                &outdir,
                "register-service-worker",
                &service_worker_registration(&site_url(&base, SERVICE_WORKER_FILE)),
                &mut written,
            )?;
            head_tags.push(format!(
                "<script src=\"{}\"></script>",
                site_url(&base, &registration)
            ));
        }
        let mut edits: Vec<Edit> = Vec::new();
        let inline_scripts: Vec<&crate::html_document::Script> = document
            .scripts
            .iter()
            .filter(|script| {
                is_module_type(script.kind.as_deref())
                    && script.src.is_none()
                    && !script.text.trim().is_empty()
            })
            .collect();
        for (index, script) in inline_scripts.iter().enumerate() {
            let key = format!(
                "{VIRTUAL}{INLINE_ENTRY}{index}",
                VIRTUAL = crate::bundler::VIRTUAL_PREFIX
            );
            if let Some(output) = entry_outputs.get(&key) {
                let src = site_url(&base, output);
                let tag_end = script.start - 1;
                edits.push(Edit {
                    start: tag_end,
                    end: tag_end,
                    text: format!(" src=\"{src}\""),
                });
                edits.push(Edit {
                    start: script.start,
                    end: script.end,
                    text: String::new(),
                });
            }
        }
        let mut renamed: HashMap<usize, String> = HashMap::new();
        for script in document
            .scripts
            .iter()
            .filter(|script| is_module_type(script.kind.as_deref()))
        {
            let (Some(src), Some(attribute)) = (&script.src, &script.src_attribute) else {
                continue;
            };
            if !is_local_script_source(src) {
                continue;
            }
            let path = script_path_of(src, &root);
            let Some(output) = entry_outputs.get(&path.to_string_lossy().into_owned()) else {
                continue;
            };
            let suffix = src
                .find(['?', '#'])
                .map(|index| &src[index..])
                .unwrap_or("");
            renamed.insert(attribute.start, format!("/{output}{suffix}"));
        }
        for attribute in &document.url_attributes {
            let renamed_value = renamed.get(&attribute.start);
            let value = renamed_value
                .map(String::as_str)
                .unwrap_or(&attribute.value);
            let prefix = if !base.is_empty() && is_root_absolute(value) {
                base.as_str()
            } else {
                ""
            };
            if let Some(renamed_value) = renamed_value {
                edits.push(Edit {
                    start: attribute.start,
                    end: attribute.end,
                    text: format!("{prefix}{renamed_value}"),
                });
            } else if !prefix.is_empty() {
                edits.push(Edit {
                    start: attribute.start,
                    end: attribute.start,
                    text: prefix.to_string(),
                });
            }
        }
        let head = head_tags
            .iter()
            .filter(|tag| !tag.is_empty())
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");
        if !head.is_empty() {
            edits.push(head_edit(document, &head));
        }
        std::fs::write(outdir.join(&entry_name), apply_edits(&html, &mut edits))?;
        written.push(entry_name.clone());
        let emitted = written.clone();
        let reserved: Vec<&str> = if worker_bundle.is_some() {
            vec![SERVICE_WORKER_FILE]
        } else {
            Vec::new()
        };
        copy_public_files(&public_directory(&root), &outdir, &mut written, &reserved)?;
        if let Some(worker) = &worker_bundle {
            let precache = if pwa_config.is_some() {
                let app: Vec<&String> = emitted
                    .iter()
                    .filter(|name| *name != LICENSE_NOTICES_FILE && *name != APP_ANALYTICS_FILE)
                    .collect();
                let optional: Vec<&String> = written[emitted.len()..]
                    .iter()
                    .filter(|name| precached_public_file(name))
                    .collect();
                let mut files: Vec<(String, Vec<u8>)> = app
                    .iter()
                    .chain(optional.iter())
                    .map(|name| {
                        Ok((
                            precache_url(&base, name),
                            std::fs::read(outdir.join(name.as_str()))?,
                        ))
                    })
                    .collect::<Result<_>>()?;
                let prefix = format!("{HASHED_FOLDER}/");
                let hashed: Vec<String> = app
                    .iter()
                    .filter(|name| name.starts_with(&prefix))
                    .map(|name| precache_url(&base, name))
                    .collect();
                let required: Vec<String> = app
                    .iter()
                    .filter(|name| !name.starts_with(&prefix))
                    .map(|name| precache_url(&base, name))
                    .collect();
                let optional_urls: Vec<String> = optional
                    .iter()
                    .map(|name| precache_url(&base, name))
                    .collect();
                precache_values(&json!({
                    "version": cache_version(&mut files),
                    "shell": precache_url(&base, &entry_name),
                    "hashed": hashed,
                    "required": required,
                    "optional": optional_urls,
                }))
            } else {
                String::new()
            };
            let values = if service_worker.is_some() {
                runtime_values(&env, &Default::default())
            } else {
                String::new()
            };
            std::fs::write(
                outdir.join(SERVICE_WORKER_FILE),
                format!(
                    "{notice_reference}{values}{precache}{}",
                    worker.entry_code()
                ),
            )?;
            written.push(SERVICE_WORKER_FILE.into());
        }
    }

    assert_within_budget(&config, &outdir, &written)?;

    let shown = relative_posix(&cwd(), &outdir);
    println!(
        "built {entry_name} -> {}/",
        if shown.is_empty() { "." } else { &shown }
    );
    if let Some(mocks) = mocks_setting(&config)
        && is_html_entry
    {
        println!("  {}/ left out - mocks serve in imp start", mocks.folder);
    }
    if !base.is_empty() && is_html_entry {
        println!("  base path {base} - root-absolute urls prefixed for a sub-path deployment");
    }
    if notice_count > 0 {
        println!(
            "  {LICENSE_NOTICES_FILE} - {notice_count} third-party license notice{}, referenced from every script emitted",
            if notice_count == 1 { "" } else { "s" }
        );
    }
    if let Some((pages, zones, outcomes)) = &analytics {
        let counted = |count: usize, noun: &str| {
            format!("{count} {noun}{}", if count == 1 { "" } else { "s" })
        };
        println!(
            "  {APP_ANALYTICS_FILE} - {}, {} and {}, for an analytics store",
            counted(pages.len(), "route pattern"),
            counted(zones.len(), "zone name"),
            counted(outcomes.len(), "outcome name")
        );
    }
    if component_skill.is_some() {
        println!(
            "  {COMPONENT_SKILL_FILE} - the manual of the component, from {}",
            file_name(&skill_file_for(&entry_path))
        );
    }
    if !flags.is_empty() {
        let states: Vec<String> = flags
            .iter()
            .map(|(name, value)| {
                format!(
                    "{name} {}",
                    if value.as_bool() == Some(true) {
                        "on"
                    } else {
                        "off"
                    }
                )
            })
            .collect();
        println!("  flags folded in - {}", states.join(", "));
    }
    if let (Some(_), Some(declared)) = (&service_worker, &service_worker_declared) {
        println!("  {SERVICE_WORKER_FILE} - your service worker, bundled from {declared}");
    }
    if pwa_config.is_some() {
        println!(
            "{}",
            if service_worker.is_some() {
                "  PWA: manifest, icons (192, 512, maskable, apple-touch), your service worker registered"
            } else {
                "  PWA: manifest, icons (192, 512, maskable, apple-touch), offline service worker"
            }
        );
        println!("  installable - name, 192 + 512 icons, display, start_url all present");
    }
    if imp_provided_by_host {
        println!("  imp imports kept bare - resolved by the imp host at runtime");
    } else if target_imp_host && is_html_entry {
        println!("  targetImpHost ignored - an HTML page is its own host, imp is bundled in");
    }
    written.sort();
    for name in &written {
        let size = std::fs::metadata(outdir.join(name))
            .map(|meta| meta.len())
            .unwrap_or(0);
        println!("  {} ({})", posix(name), format_size(size));
    }
    Ok(())
}
