use serde_json::Value;
use std::collections::HashSet;

const PERMISSIVE: u8 = 0;
const WEAK_COPYLEFT: u8 = 1;
const STRONG_COPYLEFT: u8 = 2;

const TIER_NAMES: [&str; 3] = ["permissive", "weak copyleft", "strong copyleft"];
const POLICY_ALLOWING: [&str; 3] = ["permissive", "weak-copyleft", "any"];

const PERMISSIVE_IDS: &[&str] = &[
    "0BSD",
    "Apache-2.0",
    "Artistic-2.0",
    "BlueOak-1.0.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "BSD-3-Clause-Clear",
    "CC0-1.0",
    "CC-BY-4.0",
    "ISC",
    "MIT",
    "MIT-0",
    "PostgreSQL",
    "Python-2.0",
    "Unlicense",
    "WTFPL",
    "Zlib",
];
const WEAK_COPYLEFT_IDS: &[&str] = &[
    "CDDL-1.0", "CDDL-1.1", "EPL-1.0", "EPL-2.0", "MPL-1.1", "MPL-2.0",
];
const STRONG_COPYLEFT_IDS: &[&str] = &[
    "CC-BY-SA-4.0",
    "EUPL-1.1",
    "EUPL-1.2",
    "OSL-3.0",
    "SSPL-1.0",
];

#[derive(Clone, Debug)]
pub enum Policy {
    Tier(String),
    AllowList(Vec<String>),
}

pub fn license_policy(config: &crate::config::Config) -> Policy {
    match config.get("licenses") {
        Some(Value::Array(items)) => Policy::AllowList(
            items
                .iter()
                .filter_map(|item| item.as_str().map(String::from))
                .collect(),
        ),
        Some(Value::String(name)) => Policy::Tier(name.clone()),
        _ => Policy::Tier(crate::config::DEFAULT_LICENSE_POLICY.into()),
    }
}

fn normalize_identifier(identifier: &str) -> String {
    identifier.to_lowercase().trim_end_matches('+').to_string()
}

fn tier_of_identifier(identifier: &str) -> Option<u8> {
    let normalized = normalize_identifier(identifier);
    for (tier, list) in [
        (PERMISSIVE, PERMISSIVE_IDS),
        (WEAK_COPYLEFT, WEAK_COPYLEFT_IDS),
        (STRONG_COPYLEFT, STRONG_COPYLEFT_IDS),
    ] {
        if list.iter().any(|id| id.to_lowercase() == normalized) {
            return Some(tier);
        }
    }
    if normalized.starts_with("agpl-") || normalized.starts_with("gpl-") {
        return Some(STRONG_COPYLEFT);
    }
    if normalized.starts_with("lgpl-") {
        return Some(WEAK_COPYLEFT);
    }
    None
}

enum Node {
    License(String),
    And(Vec<Node>),
    Or(Vec<Node>),
}

fn tokens(expression: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    for char in expression.chars() {
        if char == '(' || char == ')' || char.is_whitespace() {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
            if char != ' ' && !char.is_whitespace() {
                tokens.push(char.to_string());
            }
        } else {
            current.push(char);
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn parse_factor(tokens: &mut std::collections::VecDeque<String>) -> Node {
    if tokens.front().map(String::as_str) == Some("(") {
        tokens.pop_front();
        let node = parse_expression(tokens);
        if tokens.front().map(String::as_str) == Some(")") {
            tokens.pop_front();
        }
        return node;
    }
    let license = tokens.pop_front().unwrap_or_default();
    if tokens
        .front()
        .is_some_and(|token| token.eq_ignore_ascii_case("WITH"))
    {
        tokens.pop_front();
        tokens.pop_front();
    }
    Node::License(license)
}

fn parse_term(tokens: &mut std::collections::VecDeque<String>) -> Node {
    let mut operands = vec![parse_factor(tokens)];
    while tokens
        .front()
        .is_some_and(|token| token.eq_ignore_ascii_case("AND"))
    {
        tokens.pop_front();
        operands.push(parse_factor(tokens));
    }
    if operands.len() == 1 {
        operands.pop().unwrap()
    } else {
        Node::And(operands)
    }
}

fn parse_expression(tokens: &mut std::collections::VecDeque<String>) -> Node {
    let mut operands = vec![parse_term(tokens)];
    while tokens
        .front()
        .is_some_and(|token| token.eq_ignore_ascii_case("OR"))
    {
        tokens.pop_front();
        operands.push(parse_term(tokens));
    }
    if operands.len() == 1 {
        operands.pop().unwrap()
    } else {
        Node::Or(operands)
    }
}

fn parse_license_expression(expression: Option<&str>) -> Option<Node> {
    let expression = expression?;
    if expression.trim().is_empty() {
        return None;
    }
    Some(parse_expression(&mut tokens(expression).into()))
}

fn tier_of(node: &Node) -> Option<u8> {
    match node {
        Node::License(license) => tier_of_identifier(license),
        Node::Or(operands) => operands.iter().filter_map(tier_of).min(),
        Node::And(operands) => {
            let tiers: Vec<Option<u8>> = operands.iter().map(tier_of).collect();
            if tiers.contains(&None) {
                return tiers
                    .contains(&Some(STRONG_COPYLEFT))
                    .then_some(STRONG_COPYLEFT);
            }
            tiers.into_iter().flatten().max()
        }
    }
}

fn allowed_by(node: &Node, allow: &HashSet<String>) -> bool {
    match node {
        Node::License(license) => allow.contains(&normalize_identifier(license)),
        Node::Or(operands) => operands.iter().any(|operand| allowed_by(operand, allow)),
        Node::And(operands) => operands.iter().all(|operand| allowed_by(operand, allow)),
    }
}

pub struct Violation {
    pub id: String,
    pub license: String,
    pub tier: Option<u8>,
}

pub struct Unknown {
    pub id: String,
    pub license: Option<String>,
}

pub fn package_id(entry: &Value) -> String {
    format!(
        "{}@{}",
        entry.get("name").and_then(Value::as_str).unwrap_or(""),
        entry.get("version").and_then(Value::as_str).unwrap_or("")
    )
}

pub fn review_licenses(manifests: &[Value], policy: &Policy) -> (Vec<Violation>, Vec<Unknown>) {
    let allow: Option<HashSet<String>> = match policy {
        Policy::AllowList(list) => Some(list.iter().map(|id| normalize_identifier(id)).collect()),
        Policy::Tier(_) => None,
    };
    let allowed_tier = match policy {
        Policy::Tier(name) => POLICY_ALLOWING
            .iter()
            .position(|policy| policy == name)
            .unwrap_or(0) as u8,
        Policy::AllowList(_) => 0,
    };
    let mut violations = Vec::new();
    let mut unknown = Vec::new();
    let mut seen = HashSet::new();
    for manifest in manifests {
        for entry in manifest
            .get("packages")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let id = package_id(entry);
            if !seen.insert(id.clone()) {
                continue;
            }
            let license = entry.get("license").and_then(Value::as_str);
            let Some(node) = parse_license_expression(license) else {
                unknown.push(Unknown {
                    id,
                    license: license.map(String::from),
                });
                continue;
            };
            if let Some(allow) = &allow {
                if !allowed_by(&node, allow) {
                    violations.push(Violation {
                        id,
                        license: license.unwrap_or("").into(),
                        tier: None,
                    });
                }
                continue;
            }
            match tier_of(&node) {
                None => unknown.push(Unknown {
                    id,
                    license: license.map(String::from),
                }),
                Some(tier) if tier > allowed_tier => violations.push(Violation {
                    id,
                    license: license.unwrap_or("").into(),
                    tier: Some(tier),
                }),
                _ => {}
            }
        }
    }
    (violations, unknown)
}

fn describe_policy(policy: &Policy) -> String {
    match policy {
        Policy::AllowList(list) => format!("licenses list ({})", list.join(", ")),
        Policy::Tier(name) => format!("'{name}' license policy"),
    }
}

pub fn license_violation_problem(violations: &[Violation], policy: &Policy) -> String {
    let mut lines = vec![format!(
        "{} bundled package{} outside the {}:",
        violations.len(),
        if violations.len() == 1 {
            " falls"
        } else {
            "s fall"
        },
        describe_policy(policy)
    )];
    for violation in violations {
        lines.push(match violation.tier {
            None => format!("  {} is {}", violation.id, violation.license),
            Some(tier) => format!(
                "  {} is {}, which is {}",
                violation.id, violation.license, TIER_NAMES[tier as usize]
            ),
        });
    }
    let them = if violations.len() == 1 { "it" } else { "them" };
    lines.push(match policy {
        Policy::AllowList(_) => {
            let mut missing: Vec<String> = Vec::new();
            for violation in violations {
                if !missing.contains(&violation.license) {
                    missing.push(violation.license.clone());
                }
            }
            format!(
                "add {} to 'licenses' in imp.json to allow {them}",
                missing.join(", ")
            )
        }
        Policy::Tier(_) => {
            let lowest = violations
                .iter()
                .filter_map(|violation| violation.tier)
                .min()
                .unwrap_or(0);
            format!(
                "set 'licenses' in imp.json to '{}' to allow {them}",
                POLICY_ALLOWING[lowest as usize]
            )
        }
    });
    lines.join("\n")
}

pub fn unknown_license_warning(unknown: &[Unknown]) -> String {
    let listed: Vec<String> = unknown
        .iter()
        .map(|entry| match &entry.license {
            Some(license) if !license.is_empty() => format!("{} ({license})", entry.id),
            _ => entry.id.clone(),
        })
        .collect();
    format!(
        "could not identify the license of {} - check the terms yourself; imp cannot hold {} to the 'licenses' policy",
        listed.join(", "),
        if unknown.len() == 1 { "it" } else { "them" }
    )
}
