use crate::image::{Compose, compose_image, data_uri, media_type_of, raster_dimensions};
use crate::logger;
use anyhow::{Result, bail};
use serde_json::{Map, Value, json};
use std::path::{Path, PathBuf};

const DEFAULT_BACKGROUND: &str = "#ffffff";
const DEFAULT_THEME: &str = "#ffffff";

struct IconTarget {
    file: &'static str,
    size: u32,
    opaque: bool,
    padding: f64,
}

const ICON_TARGETS: [IconTarget; 4] = [
    IconTarget {
        file: "icons/icon-192.png",
        size: 192,
        opaque: false,
        padding: 0.0,
    },
    IconTarget {
        file: "icons/icon-512.png",
        size: 512,
        opaque: false,
        padding: 0.0,
    },
    IconTarget {
        file: "icons/icon-maskable-512.png",
        size: 512,
        opaque: true,
        padding: 0.1,
    },
    IconTarget {
        file: "icons/apple-touch-icon.png",
        size: 180,
        opaque: true,
        padding: 0.0,
    },
];

pub const APPLE_TOUCH_ICON: &str = "icons/apple-touch-icon.png";

fn pwa_str<'a>(pwa: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    pwa.get(key).and_then(Value::as_str)
}

fn resolve_icon(root: &Path, icon: &str) -> PathBuf {
    let path = Path::new(icon);
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(icon)
    }
}

pub struct Icon {
    pub file: &'static str,
    pub bytes: Vec<u8>,
}

pub fn render_icon_set(root: &Path, pwa: &Map<String, Value>) -> Result<Vec<Icon>> {
    let icon = pwa_str(pwa, "icon").unwrap_or("");
    let icon_path = resolve_icon(root, icon);
    let Some(media_type) = media_type_of(&crate::paths::extension(&icon_path)) else {
        bail!(
            "pwa icon must be an .svg, .png, or .jpg file, got '{}'",
            icon_path.display()
        );
    };
    let bytes = std::fs::read(&icon_path)?;
    if media_type != "image/svg+xml" {
        let (width, height) = raster_dimensions(media_type, &bytes)?;
        let largest = ICON_TARGETS
            .iter()
            .map(|target| target.size)
            .max()
            .unwrap_or(0);
        if width.max(height) < largest {
            logger::warn(&format!(
                "pwa icon {icon} is {width}x{height} - icons up to {largest}x{largest} will be upscaled, so some quality loss is expected; use an SVG or a source at least {largest}px on its longest edge for sharp icons"
            ));
        }
    }
    let source = data_uri(media_type, &bytes);
    let background = pwa_str(pwa, "backgroundColor").unwrap_or(DEFAULT_BACKGROUND);
    ICON_TARGETS
        .iter()
        .map(|target| {
            Ok(Icon {
                file: target.file,
                bytes: compose_image(
                    &source,
                    Compose {
                        width: target.size,
                        height: target.size,
                        contain: true,
                        background: target.opaque.then_some(background),
                        padding: target.padding,
                    },
                )?,
            })
        })
        .collect()
}

pub fn build_manifest(
    pwa: &Map<String, Value>,
    icon_base: &str,
    start_url: &str,
    scope: &str,
) -> String {
    let icons: Vec<Value> = [
        ("icons/icon-192.png", "192x192", "any"),
        ("icons/icon-512.png", "512x512", "any"),
        ("icons/icon-maskable-512.png", "512x512", "maskable"),
    ]
    .iter()
    .map(|(file, sizes, purpose)| json!({ "src": format!("{icon_base}{file}"), "sizes": sizes, "type": "image/png", "purpose": purpose }))
    .collect();
    let mut manifest = Map::new();
    manifest.insert(
        "name".into(),
        pwa.get("name").cloned().unwrap_or(Value::Null),
    );
    manifest.insert(
        "short_name".into(),
        pwa.get("shortName")
            .or_else(|| pwa.get("name"))
            .cloned()
            .unwrap_or(Value::Null),
    );
    manifest.insert(
        "theme_color".into(),
        pwa_str(pwa, "themeColor").unwrap_or(DEFAULT_THEME).into(),
    );
    manifest.insert(
        "background_color".into(),
        pwa_str(pwa, "backgroundColor")
            .unwrap_or(DEFAULT_BACKGROUND)
            .into(),
    );
    manifest.insert(
        "display".into(),
        pwa_str(pwa, "display").unwrap_or("standalone").into(),
    );
    manifest.insert("start_url".into(), start_url.into());
    manifest.insert("scope".into(), scope.into());
    manifest.insert("icons".into(), Value::Array(icons));
    crate::json::pretty(&Value::Object(manifest))
}

pub fn cache_version(files: &mut [(String, Vec<u8>)]) -> String {
    files.sort_by(|a, b| a.0.cmp(&b.0));
    let lines: Vec<String> = files
        .iter()
        .map(|(path, bytes)| format!("{path}:{}", crate::http_client::sha256_hex(bytes)))
        .collect();
    crate::http_client::sha256_hex(lines.join("\n").as_bytes())[..16].to_string()
}

pub fn pwa_head_tags(
    manifest_href: &str,
    theme_color: Option<&str>,
    apple_touch_href: &str,
) -> String {
    let mut tags = vec![format!("<link rel=\"manifest\" href=\"{manifest_href}\">")];
    if let Some(color) = theme_color.filter(|color| !color.is_empty()) {
        tags.push(format!("<meta name=\"theme-color\" content=\"{color}\">"));
    }
    tags.push(format!(
        "<link rel=\"apple-touch-icon\" href=\"{apple_touch_href}\">"
    ));
    tags.join("\n")
}

pub fn service_worker_registration(href: &str) -> String {
    format!(
        "addEventListener('load', () => navigator.serviceWorker.register({}))\n",
        serde_json::to_string(href).unwrap()
    )
}

pub fn validate_pwa_build(pwa: &Map<String, Value>, root: &Path) -> Result<()> {
    if pwa_str(pwa, "name").is_none_or(str::is_empty) {
        bail!("invalid imp.json - 'pwa.name' is required");
    }
    let Some(icon) = pwa_str(pwa, "icon").filter(|icon| !icon.is_empty()) else {
        bail!("invalid imp.json - 'pwa.icon' is required");
    };
    let icon_path = resolve_icon(root, icon);
    if media_type_of(&crate::paths::extension(&icon_path)).is_none() {
        bail!("invalid imp.json - 'pwa.icon' must be an .svg, .png, or .jpg file, got '{icon}'");
    }
    if !icon_path.exists() {
        bail!("pwa icon not found: {icon}");
    }
    Ok(())
}
