fn is_namespaced_name(name: &str) -> bool {
    let parts: Vec<&str> = name.split('.').collect();
    parts.len() >= 2
        && parts
            .iter()
            .all(|part| !part.is_empty() && !part.chars().any(char::is_whitespace))
}

pub fn namespaced_name_problem(name: &str, label: &str, example: &str) -> Option<String> {
    if !is_namespaced_name(name) {
        return Some(format!(
            "{label} '{name}' must include a namespace - use dot-separated segments like '{example}'"
        ));
    }
    None
}

pub fn state_name_problem(name: &str) -> Option<String> {
    namespaced_name_problem(name, "state name", "myapp.user")
}

pub fn http_client_name_problem(name: &str) -> Option<String> {
    namespaced_name_problem(name, "http client name", "myapp.api")
}

const MAX_ANALYTICS_NAME_LENGTH: usize = 128;

pub fn analytics_name_problem(name: &str, subject: &str, example: &str) -> Option<String> {
    let label = format!("{subject} name");
    if let Some(problem) = namespaced_name_problem(name, &label, example) {
        return Some(problem);
    }
    let valid = name.split('.').all(|part| {
        !part.is_empty()
            && part
                .chars()
                .all(|char| char.is_ascii_alphanumeric() || char == '_' || char == '-')
    });
    if name.encode_utf16().count() > MAX_ANALYTICS_NAME_LENGTH || !valid {
        return Some(format!(
            "{label} '{name}' must use only ASCII letters, digits, '-' and '_' between the dots, up to {MAX_ANALYTICS_NAME_LENGTH} characters, like '{example}'"
        ));
    }
    None
}

const RESERVED_COMPONENT_NAMES: [&str; 8] = [
    "annotation-xml",
    "color-profile",
    "font-face",
    "font-face-src",
    "font-face-uri",
    "font-face-format",
    "font-face-name",
    "missing-glyph",
];

pub fn component_name_problem(name: &str) -> Option<String> {
    let mut parts = name.split('-');
    let first = parts.next().unwrap_or("");
    let first_valid = first
        .chars()
        .next()
        .is_some_and(|char| char.is_ascii_lowercase())
        && first
            .chars()
            .all(|char| char.is_ascii_lowercase() || char.is_ascii_digit());
    let rest: Vec<&str> = parts.collect();
    let rest_valid = !rest.is_empty()
        && rest.iter().all(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|char| char.is_ascii_lowercase() || char.is_ascii_digit())
        });
    if !(first_valid && rest_valid) {
        return Some(format!(
            "component name '{name}' must be lowercase with at least one dash - like 'my-app-profile'"
        ));
    }
    if RESERVED_COMPONENT_NAMES.contains(&name) {
        return Some(format!(
            "component name '{name}' is reserved by the HTML standard - pick another name"
        ));
    }
    None
}

pub const APP_ANALYTICS_FILE: &str = "app-analytics.json";

pub fn analytics_subject(helper: &str) -> Option<(&'static str, &'static str)> {
    match helper {
        "zone" => Some(("zone", "myapp.invoice-summary")),
        "track" => Some(("outcome", "myapp.invoice-sent")),
        _ => None,
    }
}

pub fn analytics_name_problem_of(helper: &str, name: &str) -> Option<String> {
    let (subject, example) = analytics_subject(helper)?;
    analytics_name_problem(name, subject, example)
}
