use serde_json::Value;

pub fn base_path_of(env: &crate::environments::Env) -> String {
    let text = match env.get("IMP_BASEPATH") {
        None | Some(Value::Null) => return String::new(),
        Some(Value::String(text)) => text.clone(),
        Some(other) => other.to_string(),
    };
    if text.is_empty() || text == "/" {
        return String::new();
    }
    let leading = if text.starts_with('/') {
        text
    } else {
        format!("/{text}")
    };
    leading
        .strip_suffix('/')
        .map(String::from)
        .unwrap_or(leading)
}

pub fn site_url(base: &str, path: &str) -> String {
    format!("{base}/{path}")
}
