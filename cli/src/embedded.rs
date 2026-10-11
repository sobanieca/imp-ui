include!(concat!(env!("OUT_DIR"), "/embedded.rs"));

pub fn file(path: &str) -> Option<&'static [u8]> {
    FILES
        .binary_search_by(|(name, _)| (*name).cmp(path))
        .ok()
        .map(|index| FILES[index].1)
}

pub fn text(path: &str) -> Option<&'static str> {
    file(path).and_then(|bytes| std::str::from_utf8(bytes).ok())
}

pub fn expect_text(path: &str) -> &'static str {
    text(path).unwrap_or_else(|| panic!("{path} is not embedded in this imp build"))
}

pub fn under(prefix: &str) -> impl Iterator<Item = (&'static str, &'static [u8])> {
    let prefix = prefix.to_string();
    FILES
        .iter()
        .copied()
        .filter(move |(name, _)| name.starts_with(&prefix))
}

pub fn library_file(path: &str) -> Option<&'static str> {
    text(&format!("lib/src/{path}"))
}
