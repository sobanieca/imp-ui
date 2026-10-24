use regex::Regex;
use std::sync::LazyLock;

pub const NPM_PREFIX: &str = "npm:";

pub static EXACT_VERSION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d+\.\d+\.\d+([-+][\w.-]+)?$").unwrap());

static SPECIFIER_SHAPE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(@[^/@:]+/[^/@:]+|[^/@:]+)(?:@([^/]+))?(/.*)?$").unwrap());

pub static VALID_ALIAS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_-][A-Za-z0-9._-]*$").unwrap());

pub fn is_valid_alias(alias: &str) -> bool {
    VALID_ALIAS.is_match(alias) && !alias.contains("..")
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Specifier {
    pub npm_prefix: bool,
    pub name: String,
    pub version: Option<String>,
    pub subpath: String,
}

pub fn parse_specifier(input: &str) -> Option<Specifier> {
    let rest = input.strip_prefix(NPM_PREFIX);
    let caps = SPECIFIER_SHAPE.captures(rest.unwrap_or(input))?;
    Some(Specifier {
        npm_prefix: rest.is_some(),
        name: caps[1].to_string(),
        version: caps.get(2).map(|m| m.as_str().to_string()),
        subpath: caps
            .get(3)
            .map(|m| m.as_str().to_string())
            .unwrap_or_default(),
    })
}

pub fn default_alias(specifier: &Specifier) -> String {
    if !specifier.subpath.is_empty() {
        let last = specifier.subpath.rsplit('/').next().unwrap_or("");
        return match last.rfind('.') {
            Some(dot) => last[..dot].to_string(),
            None => last.to_string(),
        };
    }
    specifier.name.rsplit('/').next().unwrap_or("").to_string()
}

pub const IMP_MODULES: &[(&str, &str)] = &[
    ("imp", "imp.js"),
    ("imp/html", "api/html.js"),
    ("imp/state", "api/state.js"),
    ("imp/router", "api/router.js"),
    ("imp/theme", "api/theme.js"),
    ("imp/i18n", "api/i18n.js"),
    ("imp/log", "api/log.js"),
    ("imp/http", "api/http.js"),
    ("imp/icons", "api/icons.js"),
    ("imp/service-worker", "api/service-worker.js"),
    ("imp/analytics", "api/analytics.js"),
    ("imp/analytics/aly", "api/analytics-aly.js"),
    ("imp/std", "std/index.js"),
    ("imp/std/layout", "std/layout/index.js"),
    ("imp/std/display", "std/display/index.js"),
    ("imp/std/inputs", "std/inputs/index.js"),
    ("imp/std/shell", "std/shell/index.js"),
    ("imp/std/feedback", "std/feedback/index.js"),
    ("imp/std/data", "std/data/index.js"),
];

pub fn imp_module(specifier: &str) -> Option<&'static str> {
    IMP_MODULES
        .iter()
        .find(|(name, _)| *name == specifier)
        .map(|(_, file)| *file)
}

pub fn is_imp_std_specifier(specifier: &str) -> bool {
    specifier == "imp/std" || specifier.starts_with("imp/std/")
}

pub const IMP_TOOLING_MODULES: &[(&str, &str, &str)] = &[
    ("imp/test", "cli/js/test-library.js", "imp test"),
    ("imp/preview", "cli/js/preview-library.js", "imp preview"),
    (
        "imp/fake",
        "cli/js/fake-library.js",
        "imp start, imp test and imp preview",
    ),
];

pub fn imp_tooling_module(specifier: &str) -> Option<(&'static str, &'static str)> {
    IMP_TOOLING_MODULES
        .iter()
        .find(|(name, _, _)| *name == specifier)
        .map(|(_, file, resolved_by)| (*file, *resolved_by))
}

pub fn is_imp_specifier(specifier: &str) -> bool {
    imp_module(specifier).is_some() || imp_tooling_module(specifier).is_some()
}

fn known_imp_specifiers() -> String {
    IMP_MODULES
        .iter()
        .map(|(name, _)| *name)
        .chain(IMP_TOOLING_MODULES.iter().map(|(name, _, _)| *name))
        .map(|name| format!("'{name}'"))
        .collect::<Vec<_>>()
        .join(", ")
}

pub fn imp_subpath_problem(specifier: &str) -> String {
    format!(
        "'{specifier}' is not part of the imp library - import {}",
        known_imp_specifiers()
    )
}

pub fn imp_tooling_only_problem(specifier: &str) -> String {
    let (_, resolved_by) = imp_tooling_module(specifier).expect("a tooling specifier");
    format!("'{specifier}' is only resolved by {resolved_by} - it cannot be bundled into an app")
}
