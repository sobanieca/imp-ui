mod support;

use imp::preview_source::{GroupReference, scan_groups_module, scan_preview_source};
use support::{assert_snapshot, check};

fn group_json(group: &Option<GroupReference>) -> serde_json::Value {
    match group {
        None => serde_json::Value::Null,
        Some(GroupReference::Literal(literal)) => serde_json::json!({ "literal": literal }),
        Some(GroupReference::Key { key, specifier }) => {
            serde_json::json!({ "key": key, "specifier": specifier })
        }
    }
}

#[test]
fn preview_slices_the_call_site_of_every_scenario() {
    let source = include_str!("fixtures/preview-source/select.preview.js");
    let scanned = scan_preview_source(source);
    let mut declared = serde_json::Map::new();
    if let Some(name) = &scanned.declared.name {
        declared.insert("name".into(), name.clone().into());
    }
    if scanned.declared.group.is_some() {
        declared.insert("group".into(), group_json(&scanned.declared.group));
    }
    if let Some(description) = &scanned.declared.description {
        declared.insert("description".into(), description.clone().into());
    }
    let mut report = vec![
        format!("scenarios: {}", scanned.scenarios.join(", ")),
        format!("declared: {}", serde_json::Value::Object(declared)),
    ];
    for scenario in &scanned.scenarios {
        let code = scanned
            .code
            .get(scenario)
            .map(String::as_str)
            .unwrap_or("(no code)");
        report.push(format!("--- {scenario}\n{code}"));
    }
    assert_snapshot("preview-source-slices", &format!("{}\n", report.join("\n")));
}

#[test]
fn preview_reads_a_group_as_a_key_of_the_groups_module() {
    let module = "import { luBox, luUser } from 'imp/icons'\n\nexport const groups = {\n  widgets: { name: 'Widgets', icon: luBox },\n  people: { icon: luUser, name: \"People\" },\n  unnamed: { icon: luBox },\n}\n";
    let names = scan_groups_module(module).unwrap();
    check(
        names
            == vec![
                ("widgets".to_string(), Some("Widgets".to_string())),
                ("people".to_string(), Some("People".to_string())),
                ("unnamed".to_string(), None),
            ],
        format!("group names read from the module: {names:?}"),
    );
    check(
        scan_groups_module("export const groups = []").is_none(),
        "an array is not a groups object",
    );
    let keyed = scan_preview_source(
        "import { groups } from '../preview-groups.js'\nexport const group = groups.widgets\nexport const one = 1\n",
    )
    .declared
    .group;
    check(
        keyed
            == Some(GroupReference::Key {
                key: "widgets".into(),
                specifier: Some("../preview-groups.js".into()),
            }),
        format!("a member expression on an import is a key: {keyed:?}"),
    );
    let literal = scan_preview_source("export const group = 'Widgets'\n")
        .declared
        .group;
    check(
        literal == Some(GroupReference::Literal(Some("Widgets".into()))),
        format!("a string is reported as a literal: {literal:?}"),
    );
    let local = scan_preview_source("const groups = {}\nexport const group = groups.widgets\n")
        .declared
        .group;
    check(
        local
            == Some(GroupReference::Key {
                key: "widgets".into(),
                specifier: None,
            }),
        format!("a local object has no specifier: {local:?}"),
    );
}

#[test]
fn preview_dedents_a_multiline_description() {
    let declared = scan_preview_source(
        "export const description = `\n  A number.\n\n  - counts up\n`\nexport const one = 1\n",
    )
    .declared;
    check(
        declared.description.as_deref() == Some("A number.\n\n- counts up"),
        format!("a template literal is dedented: {:?}", declared.description),
    );
    check(
        scan_preview_source("export const description = `count: ${1}`\n")
            .declared
            .description
            .is_none(),
        "a template literal with a substitution is ignored",
    );
}
