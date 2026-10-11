use crate::embedded;
use serde_json::Value;

pub fn function_source(module: &str) -> String {
    let source = embedded::expect_text(&format!("cli/js/{module}"));
    let body = source
        .strip_prefix("export const ")
        .and_then(|rest| rest.split_once(" = ").map(|(_, body)| body))
        .unwrap_or_else(|| panic!("cli/js/{module} must export one function"));
    body.trim_end().to_string()
}

pub fn browser_script(module: &str, input: &Value) -> String {
    format!("({})({})\n", function_source(module), crate::environments::script_safe_json(input))
}
