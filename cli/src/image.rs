use anyhow::{Result, anyhow, bail};
use base64::Engine;

pub fn media_type_of(extension: &str) -> Option<&'static str> {
    match extension {
        "svg" => Some("image/svg+xml"),
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        _ => None,
    }
}

pub fn data_uri(media_type: &str, bytes: &[u8]) -> String {
    format!(
        "data:{media_type};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )
}

pub fn render_svg(svg: &str, fit_to_width: u32) -> Result<Vec<u8>> {
    let options = resvg::usvg::Options::default();
    let tree = resvg::usvg::Tree::from_str(svg, &options)
        .map_err(|error| anyhow!("could not read the SVG - {error}"))?;
    let size = tree.size();
    let scale = fit_to_width as f32 / size.width();
    let height = (size.height() * scale).round().max(1.0) as u32;
    let mut pixmap = resvg::tiny_skia::Pixmap::new(fit_to_width, height)
        .ok_or_else(|| anyhow!("the image is too large"))?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    pixmap
        .encode_png()
        .map_err(|error| anyhow!("could not encode the PNG - {error}"))
}

pub struct Compose<'a> {
    pub width: u32,
    pub height: u32,
    pub contain: bool,
    pub background: Option<&'a str>,
    pub padding: f64,
}

pub fn compose_image(source: &str, options: Compose) -> Result<Vec<u8>> {
    let Compose {
        width,
        height,
        contain,
        background,
        padding,
    } = options;
    let inset = (width.min(height) as f64 * padding).round() as u32;
    let drawn_width = width - inset * 2;
    let drawn_height = height - inset * 2;
    let background = background
        .map(|color| format!("<rect width=\"{width}\" height=\"{height}\" fill=\"{color}\"/>"))
        .unwrap_or_default();
    let aspect = if contain { "xMidYMid meet" } else { "none" };
    let svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\">{background}<image href=\"{source}\" x=\"{inset}\" y=\"{inset}\" width=\"{drawn_width}\" height=\"{drawn_height}\" preserveAspectRatio=\"{aspect}\"/></svg>"
    );
    render_svg(&svg, width)
}

pub fn is_animated_png(bytes: &[u8]) -> bool {
    let mut offset = 8;
    while offset + 8 <= bytes.len() {
        let length = u32::from_be_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        let kind = &bytes[offset + 4..offset + 8];
        if kind == b"acTL" {
            return true;
        }
        if kind == b"IDAT" {
            return false;
        }
        offset += 12 + length;
    }
    false
}

pub fn raster_dimensions(media_type: &str, bytes: &[u8]) -> Result<(u32, u32)> {
    if media_type == "image/png" {
        if bytes.len() < 24 {
            bail!("could not read PNG dimensions - the file may be corrupt");
        }
        let read = |offset: usize| {
            u32::from_be_bytes([
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ])
        };
        return Ok((read(16), read(20)));
    }
    let mut offset = 2;
    while offset + 9 < bytes.len() {
        if bytes[offset] != 0xff {
            offset += 1;
            continue;
        }
        let marker = bytes[offset + 1];
        if (0xc0..=0xcf).contains(&marker) && ![0xc4, 0xc8, 0xcc].contains(&marker) {
            let height = u16::from_be_bytes([bytes[offset + 5], bytes[offset + 6]]) as u32;
            let width = u16::from_be_bytes([bytes[offset + 7], bytes[offset + 8]]) as u32;
            return Ok((width, height));
        }
        offset += 2 + u16::from_be_bytes([bytes[offset + 2], bytes[offset + 3]]) as usize;
    }
    bail!("could not read JPEG dimensions - the file may be corrupt")
}
