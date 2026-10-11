use anyhow::Result;
use base64::Engine;
use serde_json::Value;

const MIN_FRAME_DELAY_MS: f64 = 20.0;

pub fn encode_gif(frames: &[Value], options: &Value) -> Result<Option<Vec<u8>>> {
    let number = |key: &str, fallback: f64| options.get(key).and_then(Value::as_f64).unwrap_or(fallback);
    let fps = number("fps", 10.0);
    let max_duration = number("maxDuration", 30.0);
    let Some(base) = frames.first().and_then(|frame| frame.get("timestamp")).and_then(Value::as_f64) else {
        return Ok(None);
    };
    let min_spacing = 1000.0 / fps;
    let mut selected: Vec<(&str, f64)> = Vec::new();
    let mut last_kept = f64::NEG_INFINITY;
    for frame in frames {
        let timestamp = frame.get("timestamp").and_then(Value::as_f64).unwrap_or(base);
        let elapsed = (timestamp - base) * 1000.0;
        if elapsed > max_duration * 1000.0 {
            break;
        }
        if elapsed - last_kept < min_spacing {
            continue;
        }
        selected.push((frame.get("data").and_then(Value::as_str).unwrap_or(""), elapsed));
        last_kept = elapsed;
    }
    if selected.is_empty() {
        return Ok(None);
    }
    let fallback_delay = (1000.0 / fps).round();
    let mut decoded = Vec::new();
    for (index, (data, elapsed)) in selected.iter().enumerate() {
        let bytes = base64::engine::general_purpose::STANDARD.decode(data)?;
        let image = image::load_from_memory_with_format(&bytes, image::ImageFormat::Jpeg)?.to_rgba8();
        let delay = match selected.get(index + 1) {
            Some((_, next)) => (next - elapsed).round().max(MIN_FRAME_DELAY_MS),
            None => fallback_delay,
        };
        decoded.push((image, delay));
    }
    let (width, height) = decoded[0].0.dimensions();
    let mut output = Vec::new();
    {
        let mut encoder = gif::Encoder::new(&mut output, width as u16, height as u16, &[])?;
        encoder.set_repeat(gif::Repeat::Infinite)?;
        for (image, delay) in decoded {
            let (frame_width, frame_height) = image.dimensions();
            let mut pixels = image.into_raw();
            let mut frame = gif::Frame::from_rgba_speed(frame_width as u16, frame_height as u16, &mut pixels, 10);
            frame.delay = (delay / 10.0).round() as u16;
            encoder.write_frame(&frame)?;
        }
    }
    Ok(Some(output))
}
