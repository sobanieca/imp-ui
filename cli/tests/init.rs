mod support;

use imp::init::{SCAFFOLD_FONTS, font_by_slug, pick_font};
use support::*;

fn slugs(fonts: &[&imp::init::Font]) -> String {
    fonts
        .iter()
        .map(|font| font.slug)
        .collect::<Vec<_>>()
        .join(",")
}

#[test]
fn pick_font_takes_the_font_from_the_random_number_it_is_given() {
    check(
        pick_font(0.0).slug == "inter",
        "random 0 picks the first font",
    );
    check(
        pick_font(0.999999).slug == "work-sans",
        "random near 1 picks the last font",
    );
    let picked: Vec<&imp::init::Font> = (0..SCAFFOLD_FONTS.len())
        .map(|index| pick_font((index as f64 + 0.5) / SCAFFOLD_FONTS.len() as f64))
        .collect();
    let all: Vec<&imp::init::Font> = SCAFFOLD_FONTS.iter().collect();
    check(
        slugs(&picked) == slugs(&all),
        format!("picked {}", slugs(&picked)),
    );
}

#[test]
fn font_by_slug_names_every_font_it_knows_when_the_slug_is_unknown() {
    check(
        font_by_slug("dm-sans").unwrap().name == "DM Sans",
        "dm-sans is DM Sans",
    );
    let message = font_by_slug("Inter")
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    let known: Vec<&str> = SCAFFOLD_FONTS.iter().map(|font| font.slug).collect();
    check(
        message.contains(&format!("one of {}", known.join(", "))),
        message,
    );
}

#[test]
fn every_scaffold_font_ships_both_subsets_and_its_license_text() {
    let fonts = cli_dir().join("templates/fonts");
    let notices = read(&cli_dir().parent().unwrap().join("THIRD-PARTY-LICENSES.md"));
    for font in &SCAFFOLD_FONTS {
        for subset in ["latin", "latin-ext"] {
            let bytes = std::fs::read(fonts.join(format!("{}-{subset}.woff2", font.slug))).unwrap();
            check(
                bytes.starts_with(b"wOF2"),
                format!("{} {subset}", font.slug),
            );
        }
        let license = read(&fonts.join(format!("{}-ofl.txt", font.slug)));
        let copyright = license.lines().next().unwrap_or("");
        check(
            license.contains("SIL Open Font License, Version 1.1"),
            format!("{} is OFL 1.1", font.slug),
        );
        check(
            copyright.starts_with("Copyright "),
            format!("{} starts with its copyright", font.slug),
        );
        check(
            notices.contains(copyright),
            format!("THIRD-PARTY-LICENSES.md lacks: {copyright}"),
        );
    }
    let mut expected: Vec<String> = SCAFFOLD_FONTS
        .iter()
        .flat_map(|font| {
            [
                format!("{}-latin.woff2", font.slug),
                format!("{}-latin-ext.woff2", font.slug),
                format!("{}-ofl.txt", font.slug),
            ]
        })
        .collect();
    expected.sort();
    check(
        list_files(&fonts) == expected,
        format!("found {:?}", list_files(&fonts)),
    );
}
