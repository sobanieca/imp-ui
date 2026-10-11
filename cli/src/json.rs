pub fn describe_error(error: &serde_json::Error) -> String {
    let message = error.to_string();
    let reason = match message.rfind(" at line ") {
        Some(index) => &message[..index],
        None => &message,
    };
    format!("{reason} (line {} column {})", error.line(), error.column())
}

pub fn pretty(value: &serde_json::Value) -> String {
    serde_json::to_string_pretty(value).unwrap()
}
