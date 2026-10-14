use crate::workspace::repo_root;
use anyhow::{Result, bail};
use serde_json::Value;

const VERSION: &str = "5.1.2";

const GRID: f64 = 65535.0;

const MAX_LATITUDE: f64 = 85.0511;

const ROAD_KINDS: [&str; 2] = ["Major Highway", "Secondary Highway"];

type Point = (i64, i64);

enum Literal {
    Integer(i64),
    Decimal(f64),
    Text(String),
    List(Vec<Literal>),
}

impl Literal {
    fn write(&self, out: &mut String) {
        match self {
            Literal::Integer(value) => out.push_str(&value.to_string()),
            Literal::Decimal(value) => out.push_str(&format!("{value}")),
            Literal::Text(text) => out.push_str(&Value::String(text.clone()).to_string()),
            Literal::List(items) => {
                out.push('[');
                for (index, item) in items.iter().enumerate() {
                    if index > 0 {
                        out.push(',');
                    }
                    item.write(out);
                }
                out.push(']');
            }
        }
    }
}

fn source_url(name: &str) -> String {
    format!(
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v{VERSION}/geojson/{name}.geojson"
    )
}

fn notice(what: &str) -> String {
    format!(
        "/*!
 * Natural Earth {VERSION} - https://www.naturalearthdata.com
 * Public domain. No permission is needed and no credit is required.
 *
 * {what}, projected to Web Mercator and quantized to a
 * {GRID} x {GRID} grid. Each shape is a delta-encoded string of that grid.
 */"
    )
}

fn project(coordinate: &Value) -> Point {
    let longitude = coordinate[0].as_f64().unwrap_or(0.0);
    let latitude = coordinate[1].as_f64().unwrap_or(0.0);
    let radians = latitude.clamp(-MAX_LATITUDE, MAX_LATITUDE) * std::f64::consts::PI / 180.0;
    let x = (longitude + 180.0) / 360.0;
    let y = (1.0 - (radians.tan() + 1.0 / radians.cos()).ln() / std::f64::consts::PI) / 2.0;
    (
        (x.clamp(0.0, 1.0) * GRID).round() as i64,
        (y.clamp(0.0, 1.0) * GRID).round() as i64,
    )
}

fn encode_integer(value: i64) -> String {
    let mut rest = if value < 0 { !(value << 1) } else { value << 1 };
    let mut text = String::new();
    while rest >= 0x20 {
        text.push(char::from_u32(((0x20 | (rest & 0x1f)) + 63) as u32).unwrap());
        rest >>= 5;
    }
    text.push(char::from_u32((rest + 63) as u32).unwrap());
    text
}

fn encode_points(points: &[Point]) -> String {
    let mut text = String::new();
    let (mut last_x, mut last_y) = (0, 0);
    for (x, y) in points {
        text.push_str(&encode_integer(x - last_x));
        text.push_str(&encode_integer(y - last_y));
        last_x = *x;
        last_y = *y;
    }
    text
}

fn quantize(coordinates: &Value) -> Vec<Point> {
    let mut points: Vec<Point> = Vec::new();
    for coordinate in coordinates
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default()
    {
        let point = project(coordinate);
        if points.last() == Some(&point) {
            continue;
        }
        points.push(point);
    }
    points
}

fn quantize_ring(coordinates: &Value) -> Option<Vec<Point>> {
    let mut points = quantize(coordinates);
    if points.len() > 1 && points.first() == points.last() {
        points.pop();
    }
    (points.len() >= 3).then_some(points)
}

fn quantize_line(coordinates: &Value) -> Option<Vec<Point>> {
    let points = quantize(coordinates);
    (points.len() >= 2).then_some(points)
}

fn items(value: &Value) -> &[Value] {
    value.as_array().map(Vec::as_slice).unwrap_or_default()
}

fn rings_of(geometry: &Value) -> Literal {
    let polygons: Vec<&Value> = if geometry["type"] == "Polygon" {
        vec![&geometry["coordinates"]]
    } else {
        items(&geometry["coordinates"]).iter().collect()
    };
    Literal::List(
        polygons
            .into_iter()
            .flat_map(items)
            .filter_map(quantize_ring)
            .map(|ring| Literal::Text(encode_points(&ring)))
            .collect(),
    )
}

fn lines_of(geometry: &Value) -> Vec<String> {
    let lines: Vec<&Value> = if geometry["type"] == "LineString" {
        vec![&geometry["coordinates"]]
    } else {
        items(&geometry["coordinates"]).iter().collect()
    };
    lines
        .into_iter()
        .filter_map(quantize_line)
        .map(|line| encode_points(&line))
        .collect()
}

fn fetch_json(name: &str) -> Result<Value> {
    let fetched = imp::http_client::get(&source_url(name), &[], None)?;
    if !fetched.ok() {
        bail!("{name}: {}", fetched.status);
    }
    fetched.json()
}

fn shapes(collection: &Value) -> Literal {
    Literal::List(
        items(&collection["features"])
            .iter()
            .map(|feature| rings_of(&feature["geometry"]))
            .collect(),
    )
}

fn one_decimal(value: &Value) -> f64 {
    (value.as_f64().unwrap_or(0.0) * 10.0).round() / 10.0
}

fn collapse_spaces(text: &str) -> String {
    let mut out = String::new();
    let mut in_space = false;
    for char in text.chars() {
        if char.is_whitespace() {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(char);
            in_space = false;
        }
    }
    out
}

fn place_entries(places: &Value) -> Literal {
    let mut entries: Vec<(String, Point, f64)> = items(&places["features"])
        .iter()
        .map(|feature| {
            let name = collapse_spaces(feature["properties"]["name"].as_str().unwrap_or(""));
            let point = project(&feature["geometry"]["coordinates"]);
            (name, point, one_decimal(&feature["properties"]["min_zoom"]))
        })
        .collect();
    entries.sort_by(|a, b| a.2.total_cmp(&b.2).then_with(|| locale_order(&a.0, &b.0)));
    Literal::List(
        entries
            .into_iter()
            .map(|(name, (x, y), zoom)| {
                Literal::List(vec![
                    Literal::Text(name),
                    Literal::Integer(x),
                    Literal::Integer(y),
                    Literal::Decimal(zoom),
                ])
            })
            .collect(),
    )
}

const ASCII_COLLATION: &str =
    " _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz";

fn base_letter(char: char) -> (char, bool) {
    const FOLDED: &[(&str, char)] = &[
        (
            "\u{e0}\u{e1}\u{e2}\u{e3}\u{e4}\u{e5}\u{101}\u{103}\u{105}",
            'a',
        ),
        ("\u{e7}\u{107}\u{109}\u{10b}\u{10d}", 'c'),
        ("\u{10f}\u{111}", 'd'),
        (
            "\u{e8}\u{e9}\u{ea}\u{eb}\u{113}\u{115}\u{117}\u{119}\u{11b}",
            'e',
        ),
        ("\u{11d}\u{11f}\u{121}\u{123}", 'g'),
        ("\u{125}\u{127}", 'h'),
        (
            "\u{ec}\u{ed}\u{ee}\u{ef}\u{129}\u{12b}\u{12d}\u{12f}\u{131}",
            'i',
        ),
        ("\u{135}", 'j'),
        ("\u{137}", 'k'),
        ("\u{13a}\u{13c}\u{13e}\u{140}\u{142}", 'l'),
        ("\u{f1}\u{144}\u{146}\u{148}\u{149}", 'n'),
        (
            "\u{f2}\u{f3}\u{f4}\u{f5}\u{f6}\u{f8}\u{14d}\u{14f}\u{151}",
            'o',
        ),
        ("\u{155}\u{157}\u{159}", 'r'),
        ("\u{15b}\u{15d}\u{15f}\u{161}\u{219}", 's'),
        ("\u{163}\u{165}\u{167}\u{21b}", 't'),
        (
            "\u{f9}\u{fa}\u{fb}\u{fc}\u{169}\u{16b}\u{16d}\u{16f}\u{171}\u{173}",
            'u',
        ),
        ("\u{175}", 'w'),
        ("\u{fd}\u{ff}\u{177}", 'y'),
        ("\u{17a}\u{17c}\u{17e}", 'z'),
    ];
    FOLDED
        .iter()
        .find(|(accented, _)| accented.contains(char))
        .map(|(_, base)| (*base, true))
        .unwrap_or((char, false))
}

fn primary_weight(char: char) -> (usize, char) {
    let (base, _) = base_letter(char.to_lowercase().next().unwrap_or(char));
    let position = ASCII_COLLATION.find(base).unwrap_or(ASCII_COLLATION.len());
    (position, base)
}

fn locale_order(a: &str, b: &str) -> std::cmp::Ordering {
    let primary = |text: &str| text.chars().map(primary_weight).collect::<Vec<_>>();
    let accents = |text: &str| {
        text.chars()
            .map(|char| base_letter(char.to_lowercase().next().unwrap_or(char)).1)
            .collect::<Vec<_>>()
    };
    let cases = |text: &str| text.chars().map(char::is_uppercase).collect::<Vec<_>>();
    primary(a)
        .cmp(&primary(b))
        .then_with(|| accents(a).cmp(&accents(b)))
        .then_with(|| cases(a).cmp(&cases(b)))
}

fn road_entries(roads: &Value) -> Literal {
    let mut entries: Vec<(usize, f64, String)> = items(&roads["features"])
        .iter()
        .filter_map(|feature| {
            let kind = feature["properties"]["type"].as_str()?;
            let index = ROAD_KINDS.iter().position(|road| *road == kind)?;
            let zoom = one_decimal(&feature["properties"]["min_zoom"]);
            Some(
                lines_of(&feature["geometry"])
                    .into_iter()
                    .map(move |line| (index, zoom, line)),
            )
        })
        .flatten()
        .collect();
    entries.sort_by(|a, b| a.1.total_cmp(&b.1).then(a.0.cmp(&b.0)));
    Literal::List(
        entries
            .into_iter()
            .map(|(index, zoom, line)| {
                Literal::List(vec![
                    Literal::Integer(index as i64),
                    Literal::Decimal(zoom),
                    Literal::Text(line),
                ])
            })
            .collect(),
    )
}

fn write_module(file: &str, what: &str, exports: Vec<(&str, Literal)>) -> Result<u64> {
    let mut lines = vec![
        "// Generated by cargo xtask vendor-natural-earth - do not edit".to_string(),
        notice(what),
        String::new(),
        format!("export const WORLD_GRID = {GRID}"),
        String::new(),
    ];
    for (name, value) in exports {
        let mut literal = String::new();
        value.write(&mut literal);
        lines.push(format!("export const {name} = {literal}"));
        lines.push(String::new());
    }
    let text = lines.join("\n");
    std::fs::write(repo_root().join("lib/src/std/data").join(file), &text)?;
    Ok((text.len() as f64 / 1024.0).round() as u64)
}

fn count(collection: &Value) -> usize {
    items(&collection["features"]).len()
}

fn write_world(scale: &str) -> Result<()> {
    let countries = fetch_json(&format!("ne_{scale}_admin_0_countries"))?;
    let lakes = fetch_json(&format!("ne_{scale}_lakes"))?;
    let places = fetch_json(&format!("ne_{scale}_populated_places_simple"))?;
    let file = format!("map-world-{scale}.js");
    let size = write_module(
        &file,
        &format!("The 1:{scale} countries, lakes and populated places"),
        vec![
            ("worldCountries", shapes(&countries)),
            ("worldLakes", shapes(&lakes)),
            ("worldPlaces", place_entries(&places)),
        ],
    )?;
    eprintln!(
        "wrote lib/src/std/data/{file} - Natural Earth {VERSION}, {} countries, {} lakes, {} places, {size} kB",
        count(&countries),
        count(&lakes),
        count(&places)
    );
    Ok(())
}

fn write_roads() -> Result<()> {
    let roads = fetch_json("ne_10m_roads")?;
    let entries = road_entries(&roads);
    let total = match &entries {
        Literal::List(items) => items.len(),
        _ => 0,
    };
    let file = "map-roads-10m.js";
    let size = write_module(
        file,
        "The 1:10m major and secondary highways",
        vec![("worldRoads", entries)],
    )?;
    eprintln!("wrote lib/src/std/data/{file} - Natural Earth {VERSION}, {total} roads, {size} kB");
    Ok(())
}

pub fn natural_earth() -> Result<()> {
    write_world("110m")?;
    write_world("50m")?;
    write_roads()
}
