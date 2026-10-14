use crate::file_size::{format_size, max_file_bytes};
use crate::image::{is_animated_png, raster_dimensions};
use crate::logger;
use crate::paths::relative_posix;
use anyhow::{Result, anyhow, bail};
use image::ImageEncoder;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::imageops::FilterType;
use std::path::{Path, PathBuf};

const JPEG_QUALITY: u8 = 92;
const RECOMMENDED_MAX_EDGE: u32 = 1920;
const DEFERRED_TYPES: [&str; 2] = [".webp", ".gif"];

pub struct ResizeOptions {
    pub root: PathBuf,
    pub image: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub output: Option<String>,
    pub stretch: bool,
}

#[derive(Clone, Copy, PartialEq)]
enum Encoder {
    Png,
    Jpeg,
}

fn scaled(value: u32, numerator: u32, denominator: u32) -> u32 {
    ((value as f64 * numerator as f64 / denominator as f64).round() as u32).max(1)
}

fn target_dimensions(
    source: (u32, u32),
    width: Option<u32>,
    height: Option<u32>,
    stretch: bool,
) -> (u32, u32) {
    match (width, height) {
        (Some(width), Some(height)) if stretch => (width.min(source.0), height.min(source.1)),
        (Some(width), Some(height)) => {
            let scale = (width as f64 / source.0 as f64)
                .min(height as f64 / source.1 as f64)
                .min(1.0);
            (
                ((source.0 as f64 * scale).round() as u32).max(1),
                ((source.1 as f64 * scale).round() as u32).max(1),
            )
        }
        (Some(width), None) => {
            let width = width.min(source.0);
            (width, scaled(source.1, width, source.0))
        }
        (None, height) => {
            let height = height.unwrap_or(source.1).min(source.1);
            (scaled(source.0, height, source.1), height)
        }
    }
}

fn recommend(display: &str, source: (u32, u32), byte_size: u64, max_bytes: u64) {
    let longest_edge = source.0.max(source.1);
    logger::info(&format!(
        "{display} is {}x{}, {}",
        source.0,
        source.1,
        format_size(byte_size)
    ));
    if byte_size <= max_bytes && longest_edge <= RECOMMENDED_MAX_EDGE {
        logger::info("already within the size budget - nothing to resize");
        return;
    }
    let suggested = if longest_edge > RECOMMENDED_MAX_EDGE {
        RECOMMENDED_MAX_EDGE
    } else {
        ((longest_edge as f64 * 0.75).round() as u32).max(1)
    };
    let axis = if source.0 >= source.1 { "-w" } else { "-h" };
    logger::info(&format!(
        "to shrink it, run:  imp resize {display} {axis} {suggested}"
    ));
    logger::info(
        "resize keeps quality high with minimal compression - reach for a dedicated image tool for fine-grained control",
    );
}

fn encode(bytes: &[u8], encoder: Encoder, target: (u32, u32)) -> Result<Vec<u8>> {
    let decoded = image::load_from_memory(bytes)?;
    let resized = decoded.resize_exact(target.0, target.1, FilterType::Lanczos3);
    let mut out = Vec::new();
    match encoder {
        Encoder::Png => {
            let rgba = resized.to_rgba8();
            PngEncoder::new_with_quality(
                &mut out,
                image::codecs::png::CompressionType::Best,
                image::codecs::png::FilterType::Adaptive,
            )
            .write_image(&rgba, target.0, target.1, image::ExtendedColorType::Rgba8)?;
        }
        Encoder::Jpeg => {
            let rgb = resized.to_rgb8();
            JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY).write_image(
                &rgb,
                target.0,
                target.1,
                image::ExtendedColorType::Rgb8,
            )?;
        }
    }
    Ok(out)
}

fn shown(root: &Path, path: &Path, fallback: &str) -> String {
    let relative = relative_posix(root, path);
    if relative.is_empty() {
        fallback.to_string()
    } else {
        relative
    }
}

pub fn resize(options: ResizeOptions) -> Result<()> {
    let Some(image) = options.image.as_deref() else {
        bail!("usage: imp resize <image> [-w <px>] [-h <px>] [--output <path>] [--stretch]");
    };
    let extension = Path::new(image)
        .extension()
        .map(|extension| format!(".{}", extension.to_string_lossy().to_ascii_lowercase()))
        .unwrap_or_default();
    if DEFERRED_TYPES.contains(&extension.as_str()) {
        bail!(
            "{extension} images are not yet supported - imp resize currently handles .png and .jpg"
        );
    }
    let (encoder, media_type) = match extension.as_str() {
        ".png" => (Encoder::Png, "image/png"),
        ".jpg" | ".jpeg" => (Encoder::Jpeg, "image/jpeg"),
        _ => bail!(
            "unsupported image format '{}' - imp resize handles .png and .jpg",
            if extension.is_empty() {
                image
            } else {
                &extension
            }
        ),
    };
    if options.stretch && (options.width.is_none() || options.height.is_none()) {
        bail!("--stretch requires both -w and -h - without it aspect ratio is always kept");
    }
    let root = &options.root;
    let path = root.join(image);
    let display = shown(root, &path, image);
    let bytes = std::fs::read(&path).map_err(|_| anyhow!("image not found: {image}"))?;
    if encoder == Encoder::Png && is_animated_png(&bytes) {
        bail!("animated PNG (APNG) is not yet supported");
    }
    let source = raster_dimensions(media_type, &bytes)?;
    if options.width.is_none() && options.height.is_none() {
        let config = crate::config::load_imp_config(root)?;
        recommend(
            &display,
            source,
            bytes.len() as u64,
            max_file_bytes(&config),
        );
        return Ok(());
    }
    let target = target_dimensions(source, options.width, options.height, options.stretch);
    if target == source {
        logger::info(&format!(
            "{display} is already {}x{} - requested size would upscale it, so nothing was changed",
            source.0, source.1
        ));
        return Ok(());
    }
    let encoded = encode(&bytes, encoder, target)?;
    let out_path = match &options.output {
        Some(output) => root.join(output),
        None => path.clone(),
    };
    std::fs::write(&out_path, &encoded)?;
    let out_display = shown(
        root,
        &out_path,
        options.output.as_deref().unwrap_or(&display),
    );
    logger::info(&format!(
        "{display} {}x{} {} -> {out_display} {}x{} {}",
        source.0,
        source.1,
        format_size(bytes.len() as u64),
        target.0,
        target.1,
        format_size(encoded.len() as u64)
    ));
    Ok(())
}
