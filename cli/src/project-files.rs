pub fn is_unit_file(path: &str) -> bool {
    path.ends_with(".test.js") || path.ends_with(".test.mjs")
}

pub fn is_spec_file(path: &str) -> bool {
    path.ends_with(".spec.js") || path.ends_with(".spec.mjs")
}

pub fn is_test_file(path: &str) -> bool {
    is_unit_file(path) || is_spec_file(path)
}

pub fn is_preview_file(path: &str) -> bool {
    path.ends_with(".preview.js") || path.ends_with(".preview.mjs")
}

pub fn is_mock_file(path: &str) -> bool {
    path.ends_with(".mock.js")
}
