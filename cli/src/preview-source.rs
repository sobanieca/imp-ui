use crate::lint_support::{parse, property_key_name};
use oxc::allocator::Allocator;
use oxc::ast::AstKind;
use oxc::ast::ast::*;
use oxc::semantic::{NodeId, Semantic};
use oxc::span::{GetSpan, Span};
use std::collections::{BTreeMap, HashSet};

const IMPORT_LINE_WIDTH: usize = 100;
const COMPONENT_KEY: &str = "component";
pub const PREVIEW_METADATA_EXPORTS: [&str; 3] = ["name", "group", "description"];
pub const GROUP_EXPORT: &str = "group";
pub const DESCRIPTION_EXPORT: &str = "description";
pub const GROUPS_EXPORT: &str = "groups";
pub const PREVIEW_SKILL_EXPORT: &str = "impPreviewSkill";

pub fn is_preview_metadata_export(name: &str) -> bool {
    PREVIEW_METADATA_EXPORTS.contains(&name)
}

#[derive(Debug, Clone, PartialEq)]
pub enum GroupReference {
    Literal(Option<String>),
    Key {
        key: String,
        specifier: Option<String>,
    },
}

#[derive(Debug, Default, Clone)]
pub struct Declared {
    pub name: Option<String>,
    pub group: Option<GroupReference>,
    pub description: Option<String>,
}

#[derive(Debug, Default, Clone)]
pub struct Scanned {
    pub scenarios: Vec<String>,
    pub declared: Declared,
    pub code: BTreeMap<String, String>,
}

struct Own {
    span: Span,
    arrow_body: Option<Span>,
}

struct Scenario {
    name: String,
    node: Option<Span>,
    own: Option<Own>,
    value: bool,
}

fn exported_name(name: &ModuleExportName) -> String {
    name.name().to_string()
}

fn property_of<'a, 'b>(
    object: &'b ObjectExpression<'a>,
    name: &str,
) -> Option<&'b ObjectProperty<'a>> {
    object
        .properties
        .iter()
        .find_map(|property| match property {
            ObjectPropertyKind::ObjectProperty(property)
                if !property.computed && property_key_name(property).as_deref() == Some(name) =>
            {
                Some(&**property)
            }
            _ => None,
        })
}

fn own_of(expression: &Expression) -> Own {
    let expression = match expression {
        Expression::ObjectExpression(object) => property_of(object, COMPONENT_KEY)
            .map(|property| &property.value)
            .unwrap_or(expression),
        _ => expression,
    };
    let arrow_body = match expression {
        Expression::ArrowFunctionExpression(arrow)
            if !arrow.r#async
                && arrow.params.items.is_empty()
                && arrow.params.rest.is_none()
                && !matches!(arrow.body, ArrowFunctionBody::FunctionBody(_)) =>
        {
            Some(arrow.body.span())
        }
        _ => None,
    };
    Own {
        span: expression.span(),
        arrow_body,
    }
}

fn scenarios_of(program: &Program) -> Vec<Scenario> {
    let mut scenarios: Vec<Scenario> = Vec::new();
    let mut add = |scenario: Scenario| {
        if is_preview_metadata_export(&scenario.name)
            || scenarios.iter().any(|known| known.name == scenario.name)
        {
            return;
        }
        scenarios.push(scenario);
    };
    let named = |name: String| Scenario {
        name,
        node: None,
        own: None,
        value: false,
    };
    for statement in &program.body {
        if let Statement::ExportNamedDeclaration(export) = statement {
            for specifier in &export.specifiers {
                add(named(exported_name(&specifier.exported)));
            }
            continue;
        }
        let Statement::ExportDeclaration(export) = statement else {
            continue;
        };
        match &export.declaration {
            Declaration::VariableDeclaration(declaration) => {
                for declarator in &declaration.declarations {
                    match (&declarator.id, &declarator.init) {
                        (BindingPattern::BindingIdentifier(identifier), Some(init)) => {
                            add(Scenario {
                                name: identifier.name.to_string(),
                                node: Some(declarator.span),
                                own: Some(own_of(init)),
                                value: true,
                            })
                        }
                        (pattern, _) => {
                            let mut names = Vec::new();
                            crate::lint_support::binding_names(pattern, &mut names);
                            for identifier in names {
                                add(named(identifier.name.to_string()));
                            }
                        }
                    }
                }
            }
            Declaration::FunctionDeclaration(function) => {
                if let Some(id) = &function.id {
                    add(Scenario {
                        name: id.name.to_string(),
                        node: Some(function.span),
                        own: Some(Own {
                            span: function.span,
                            arrow_body: None,
                        }),
                        value: false,
                    });
                }
            }
            Declaration::ClassDeclaration(class) => {
                if let Some(id) = &class.id {
                    add(Scenario {
                        name: id.name.to_string(),
                        node: Some(class.span),
                        own: Some(Own {
                            span: class.span,
                            arrow_body: None,
                        }),
                        value: false,
                    });
                }
            }
            _ => {}
        }
    }
    scenarios
}

fn exported_declarators<'a, 'b>(program: &'b Program<'a>) -> Vec<&'b VariableDeclarator<'a>> {
    program
        .body
        .iter()
        .filter_map(|statement| match statement {
            Statement::ExportDeclaration(export) => match &export.declaration {
                Declaration::VariableDeclaration(declaration) => {
                    Some(declaration.declarations.iter())
                }
                _ => None,
            },
            _ => None,
        })
        .flatten()
        .collect()
}

fn string_literal_of(expression: Option<&Expression>) -> Option<String> {
    match expression {
        Some(Expression::StringLiteral(literal)) => Some(literal.value.to_string()),
        _ => None,
    }
}

fn text_literal_of(expression: &Expression) -> Option<String> {
    match expression {
        Expression::StringLiteral(literal) => Some(literal.value.to_string()),
        Expression::TemplateLiteral(template) if template.expressions.is_empty() => template
            .quasis
            .first()
            .and_then(|quasi| quasi.value.cooked.map(|text| text.to_string())),
        _ => None,
    }
}

fn dedent(text: &str) -> String {
    let mut text = text;
    if let Some(newline) = text.find('\n')
        && text[..newline]
            .chars()
            .all(|char| char == ' ' || char == '\t')
    {
        text = &text[newline + 1..];
    }
    let text = text.trim_end();
    let lines: Vec<&str> = text.split('\n').collect();
    let indent_of = |line: &str| line.len() - line.trim_start_matches([' ', '\t']).len();
    let shortest = lines
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| indent_of(line))
        .min()
        .unwrap_or(0);
    lines
        .iter()
        .map(|line| line.get(shortest..).unwrap_or(""))
        .collect::<Vec<_>>()
        .join("\n")
}

struct Module<'s, 'a> {
    source: &'a str,
    semantic: &'s Semantic<'a>,
}

impl<'s, 'a> Module<'s, 'a> {
    fn text(&self, span: Span) -> &'a str {
        &self.source[span.start as usize..span.end as usize]
    }

    fn import_declaration_of(&self, name: &str) -> Option<&'s ImportDeclaration<'a>> {
        let scoping = self.semantic.scoping();
        let symbol = scoping.get_binding(scoping.root_scope_id(), name.into())?;
        let declaration = scoping.symbol_declaration(symbol);
        match self.semantic.nodes().parent_kind(declaration) {
            AstKind::ImportDeclaration(import) => Some(import),
            _ => None,
        }
    }

    fn group_reference_of(&self, value: &Expression) -> GroupReference {
        if let Some(literal) = string_literal_of(Some(value)) {
            return GroupReference::Literal(Some(literal));
        }
        match value {
            Expression::StaticMemberExpression(member) => match &member.object {
                Expression::Identifier(object) => GroupReference::Key {
                    key: member.property.name.to_string(),
                    specifier: self
                        .import_declaration_of(&object.name)
                        .map(|import| import.source.value.to_string()),
                },
                _ => GroupReference::Literal(None),
            },
            _ => GroupReference::Literal(None),
        }
    }

    fn declared_of(&self, program: &Program) -> Declared {
        let mut declared = Declared::default();
        for declarator in exported_declarators(program) {
            let (BindingPattern::BindingIdentifier(identifier), Some(init)) =
                (&declarator.id, &declarator.init)
            else {
                continue;
            };
            match identifier.name.as_str() {
                GROUP_EXPORT => declared.group = Some(self.group_reference_of(init)),
                DESCRIPTION_EXPORT => {
                    if let Some(text) = text_literal_of(init) {
                        declared.description = Some(dedent(&text));
                    }
                }
                "name" => {
                    if let Some(text) = text_literal_of(init) {
                        declared.name = Some(text);
                    }
                }
                _ => {}
            }
        }
        declared
    }

    fn call_site_of(&self, own: &Own) -> String {
        match own.arrow_body {
            None => self.text(own.span).to_string(),
            Some(body) => {
                let head = &self.source[own.span.start as usize..body.start as usize];
                let arrow = head
                    .rfind("=>")
                    .map(|index| own.span.start as usize + index + 2)
                    .unwrap_or(body.start as usize);
                self.source[arrow..own.span.end as usize].trim().to_string()
            }
        }
    }

    fn render_import(&self, import: &ImportDeclaration, locals: &HashSet<String>) -> String {
        let mut parts = Vec::new();
        let mut named = Vec::new();
        for specifier in import.specifiers.iter().flatten() {
            match specifier {
                ImportDeclarationSpecifier::ImportDefaultSpecifier(default)
                    if locals.contains(default.local.name.as_str()) =>
                {
                    parts.push(default.local.name.to_string())
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(namespace)
                    if locals.contains(namespace.local.name.as_str()) =>
                {
                    parts.push(format!("* as {}", namespace.local.name))
                }
                ImportDeclarationSpecifier::ImportSpecifier(named_specifier)
                    if locals.contains(named_specifier.local.name.as_str()) =>
                {
                    named.push(self.text(named_specifier.span).to_string())
                }
                _ => {}
            }
        }
        if !named.is_empty() {
            parts.push(format!("{{ {} }}", named.join(", ")));
        }
        let from = self.text(import.source.span);
        let line = format!("import {} from {from}", parts.join(", "));
        if line.len() <= IMPORT_LINE_WIDTH || named.is_empty() {
            return line;
        }
        let head: String = parts[..parts.len() - 1]
            .iter()
            .map(|part| format!("{part}, "))
            .collect();
        let body: String = named.iter().map(|text| format!("  {text},\n")).collect();
        format!("import {head}{{\n{body}}} from {from}")
    }

    fn scenario_code(&self, scenario: &Scenario) -> Option<String> {
        let own = scenario.own.as_ref()?;
        let scoping = self.semantic.scoping();
        let nodes = self.semantic.nodes();
        let bindings: Vec<(String, oxc::semantic::SymbolId)> = scoping
            .get_bindings(scoping.root_scope_id())
            .iter()
            .map(|(name, symbol)| (name.to_string(), *symbol))
            .collect();
        let mut imports: BTreeMap<u32, (NodeId, HashSet<String>)> = BTreeMap::new();
        let mut helpers: BTreeMap<u32, String> = BTreeMap::new();
        let mut seen = HashSet::new();
        let mut queue = vec![own.span];
        while let Some(span) = queue.pop() {
            for (name, symbol) in &bindings {
                if seen.contains(symbol) {
                    continue;
                }
                let referenced =
                    scoping
                        .get_resolved_reference_ids(*symbol)
                        .iter()
                        .any(|reference| {
                            let at = nodes
                                .get_node(scoping.get_reference(*reference).node_id())
                                .span();
                            at.start >= span.start && at.end <= span.end
                        });
                if !referenced {
                    continue;
                }
                seen.insert(*symbol);
                let declaration = scoping.symbol_declaration(*symbol);
                let parent = nodes.parent_id(declaration);
                match nodes.kind(declaration) {
                    AstKind::ImportSpecifier(_)
                    | AstKind::ImportDefaultSpecifier(_)
                    | AstKind::ImportNamespaceSpecifier(_) => {
                        if let AstKind::ImportDeclaration(import) = nodes.kind(parent) {
                            imports
                                .entry(import.span.start)
                                .or_insert_with(|| (parent, HashSet::new()))
                                .1
                                .insert(name.clone());
                        }
                    }
                    AstKind::VariableDeclarator(declarator) => {
                        let AstKind::VariableDeclaration(declaration) = nodes.kind(parent) else {
                            continue;
                        };
                        let exported =
                            matches!(nodes.parent_kind(parent), AstKind::ExportDeclaration(_));
                        let (statement, text) = if exported {
                            let keyword = self
                                .text(declaration.span)
                                .split_whitespace()
                                .next()
                                .unwrap_or("const");
                            (
                                declarator.span,
                                format!("{keyword} {}", self.text(declarator.span)),
                            )
                        } else {
                            (declaration.span, self.text(declaration.span).to_string())
                        };
                        if Some(statement) == scenario.node
                            || helpers.contains_key(&statement.start)
                        {
                            continue;
                        }
                        helpers.insert(statement.start, text);
                        queue.push(statement);
                    }
                    AstKind::Function(function) => {
                        self.add_helper(function.span, scenario, &mut helpers, &mut queue);
                    }
                    AstKind::Class(class) => {
                        self.add_helper(class.span, scenario, &mut helpers, &mut queue);
                    }
                    _ => {}
                }
            }
        }
        let import_lines: Vec<String> = imports
            .values()
            .filter_map(|(node, locals)| match nodes.kind(*node) {
                AstKind::ImportDeclaration(import) => Some(self.render_import(import, locals)),
                _ => None,
            })
            .collect();
        let helper_blocks: Vec<String> = helpers.into_values().collect();
        let call = if scenario.value {
            self.call_site_of(own)
        } else {
            self.text(own.span).to_string()
        };
        Some(
            [import_lines.join("\n"), helper_blocks.join("\n\n"), call]
                .into_iter()
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join("\n\n"),
        )
    }

    fn add_helper(
        &self,
        span: Span,
        scenario: &Scenario,
        helpers: &mut BTreeMap<u32, String>,
        queue: &mut Vec<Span>,
    ) {
        if Some(span) == scenario.node || helpers.contains_key(&span.start) {
            return;
        }
        helpers.insert(span.start, self.text(span).to_string());
        queue.push(span);
    }
}

pub fn scan_preview_source(source: &str) -> Scanned {
    let allocator = Allocator::default();
    let parsed = parse(&allocator, source);
    if !parsed.errors.is_empty() {
        return Scanned::default();
    }
    let program = parsed.semantic.nodes().program();
    let module = Module {
        source,
        semantic: &parsed.semantic,
    };
    let scenarios = scenarios_of(program);
    let code = scenarios
        .iter()
        .filter_map(|scenario| {
            module
                .scenario_code(scenario)
                .map(|code| (scenario.name.clone(), code))
        })
        .collect();
    Scanned {
        scenarios: scenarios
            .into_iter()
            .map(|scenario| scenario.name)
            .collect(),
        declared: module.declared_of(program),
        code,
    }
}

pub fn scan_groups_module(source: &str) -> Option<Vec<(String, Option<String>)>> {
    let allocator = Allocator::default();
    let parsed = parse(&allocator, source);
    if !parsed.errors.is_empty() {
        return None;
    }
    let program = parsed.semantic.nodes().program();
    let groups = exported_declarators(program).into_iter().find(|declarator| {
        matches!(&declarator.id, BindingPattern::BindingIdentifier(identifier) if identifier.name == GROUPS_EXPORT)
    })?;
    let Some(Expression::ObjectExpression(object)) = &groups.init else {
        return None;
    };
    let mut names = Vec::new();
    for property in &object.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            continue;
        };
        if property.computed {
            continue;
        }
        let Some(key) = property_key_name(property) else {
            continue;
        };
        let name = match &property.value {
            Expression::ObjectExpression(entry) => {
                property_of(entry, "name").and_then(|named| string_literal_of(Some(&named.value)))
            }
            _ => None,
        };
        names.push((key, name));
    }
    Some(names)
}
