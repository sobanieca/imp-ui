use crate::embedded;
use crate::lint_support::parse;
use crate::specifiers::IMP_MODULES;
use oxc::allocator::Allocator;
use oxc::ast::ast::*;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::OnceLock;

fn join(base: &str, module: &str) -> String {
    let mut parts: Vec<&str> = base.split('/').collect();
    parts.pop();
    for segment in module.split('/') {
        match segment {
            "." | "" => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }
    parts.join("/")
}

pub fn module_exports(path: &str, seen: &mut BTreeSet<String>) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    if !seen.insert(path.to_string()) {
        return names;
    }
    let Some(source) = embedded::text(path) else {
        return names;
    };
    let allocator = Allocator::default();
    let parsed = parse(&allocator, source);
    for statement in &parsed.semantic.nodes().program().body {
        match statement {
            Statement::ExportNamedDeclaration(declaration) => {
                for specifier in &declaration.specifiers {
                    names.insert(specifier.exported.name().to_string());
                }
            }
            Statement::ExportFromDeclaration(declaration) => {
                for specifier in &declaration.specifiers {
                    names.insert(specifier.exported.name().to_string());
                }
            }
            Statement::ExportDeclaration(declaration) => match &declaration.declaration {
                Declaration::VariableDeclaration(variables) => {
                    for declarator in &variables.declarations {
                        let mut found = Vec::new();
                        crate::lint_support::binding_names(&declarator.id, &mut found);
                        names.extend(found.iter().map(|identifier| identifier.name.to_string()));
                    }
                }
                Declaration::FunctionDeclaration(function) => {
                    if let Some(id) = &function.id {
                        names.insert(id.name.to_string());
                    }
                }
                Declaration::ClassDeclaration(class) => {
                    if let Some(id) = &class.id {
                        names.insert(id.name.to_string());
                    }
                }
                _ => {}
            },
            Statement::ExportDefaultDeclaration(_) => {
                names.insert("default".into());
            }
            Statement::ExportAllDeclaration(declaration) => match &declaration.exported {
                Some(exported) => {
                    names.insert(exported.name().to_string());
                }
                None => {
                    let target = join(path, declaration.source.value.as_str().unwrap_or_default());
                    names.extend(
                        module_exports(&target, seen)
                            .into_iter()
                            .filter(|name| name != "default"),
                    );
                }
            },
            _ => {}
        }
    }
    names
}

pub fn imp_module_exports() -> &'static BTreeMap<&'static str, BTreeSet<String>> {
    static EXPORTS: OnceLock<BTreeMap<&'static str, BTreeSet<String>>> = OnceLock::new();
    EXPORTS.get_or_init(|| {
        IMP_MODULES
            .iter()
            .map(|(specifier, file)| {
                (
                    *specifier,
                    module_exports(&format!("lib/src/{file}"), &mut BTreeSet::new()),
                )
            })
            .collect()
    })
}
