use oxc::allocator::Allocator;
use oxc::ast::ast::*;
use oxc::ast::{AstKind, GetNodeId};
use oxc::semantic::{AstNode, Semantic, SemanticBuilder};
use oxc::span::{GetSpan, SourceType, Span};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};

pub struct Parsed<'a> {
    pub semantic: Semantic<'a>,
    pub errors: Vec<(String, u32)>,
}

pub fn parse<'a>(allocator: &'a Allocator, source: &'a str) -> Parsed<'a> {
    let options = oxc::parser::ParseOptions { preserve_parens: false, ..Default::default() };
    let parsed = oxc::parser::Parser::new(allocator, source, SourceType::mjs()).with_options(options).parse();
    let mut errors: Vec<(String, u32)> = parsed
        .errors
        .iter()
        .map(|error| (error.message.to_string(), error.labels.as_ref().and_then(|labels| labels.first()).map(|label| label.offset() as u32).unwrap_or(0)))
        .collect();
    let program = allocator.alloc(parsed.program);
    let built = SemanticBuilder::new().with_check_syntax_error(true).with_cfg(false).build(program);
    if errors.is_empty() {
        errors.extend(built.errors.iter().map(|error| {
            (error.message.to_string(), error.labels.as_ref().and_then(|labels| labels.first()).map(|label| label.offset() as u32).unwrap_or(0))
        }));
    }
    Parsed { semantic: built.semantic, errors }
}

pub struct Raw {
    pub rule: &'static str,
    pub message: String,
    pub span: Span,
    pub fix: Option<Vec<(u32, u32, String)>>,
}

pub struct Ctx<'s, 'a> {
    pub source: &'a str,
    pub semantic: &'s Semantic<'a>,
    pub dependency_aliases: &'s [String],
    pub findings: RefCell<Vec<Raw>>,
}

impl<'s, 'a> Ctx<'s, 'a> {
    pub fn report(&self, rule: &'static str, span: Span, message: impl Into<String>) {
        self.findings.borrow_mut().push(Raw { rule, message: message.into(), span, fix: None });
    }

    pub fn report_fix(&self, rule: &'static str, span: Span, message: impl Into<String>, fix: Option<Vec<(u32, u32, String)>>) {
        self.findings.borrow_mut().push(Raw { rule, message: message.into(), span, fix });
    }

    pub fn nodes(&self) -> impl Iterator<Item = &'s AstNode<'a>> {
        self.semantic.nodes().iter()
    }

    pub fn parent(&self, node_id: oxc::semantic::NodeId) -> AstKind<'a> {
        self.semantic.nodes().parent_kind(node_id)
    }

    pub fn parent_of<T: GetNodeId>(&self, node: &T) -> AstKind<'a> {
        self.semantic.nodes().parent_kind(node.node_id())
    }

    pub fn text(&self, span: Span) -> &'a str {
        &self.source[span.start as usize..span.end as usize]
    }
}

pub fn import_source<'a>(declaration: &ImportDeclaration<'a>) -> &'a str {
    declaration.source.value.as_str()
}

pub fn imported_name<'a>(specifier: &ImportSpecifier<'a>) -> String {
    specifier.imported.name().to_string()
}

#[derive(Default)]
pub struct ImportTracker {
    pub locals: HashMap<String, String>,
    pub namespaces: HashSet<String>,
}

impl ImportTracker {
    pub fn collect(&mut self, declaration: &ImportDeclaration, source: &str, classify: impl Fn(&str) -> Option<String>) {
        if import_source(declaration) != source {
            return;
        }
        for specifier in declaration.specifiers.iter().flatten() {
            match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(specifier) => {
                    if let Some(classified) = classify(&imported_name(specifier)) {
                        self.locals.insert(specifier.local.name.to_string(), classified);
                    }
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(specifier) => {
                    self.namespaces.insert(specifier.local.name.to_string());
                }
                ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => {}
            }
        }
    }

    pub fn namespace_callee_name<'e>(&self, callee: &'e Expression) -> Option<&'e str> {
        namespace_callee_name(callee, &self.namespaces)
    }
}

pub fn namespace_callee_name<'e>(callee: &'e Expression, namespaces: &HashSet<String>) -> Option<&'e str> {
    let Expression::StaticMemberExpression(member) = callee.without_parentheses() else { return None };
    let Expression::Identifier(object) = &member.object else { return None };
    namespaces.contains(object.name.as_str()).then(|| member.property.name.as_str())
}

pub fn identifier_name<'e>(expression: &'e Expression) -> Option<&'e str> {
    match expression.without_parentheses() {
        Expression::Identifier(identifier) => Some(identifier.name.as_str()),
        _ => None,
    }
}

pub fn property_key_name(property: &ObjectProperty) -> Option<String> {
    if property.computed {
        return None;
    }
    match &property.key {
        PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.to_string()),
        PropertyKey::StringLiteral(literal) => Some(literal.value.to_string()),
        PropertyKey::NumericLiteral(literal) => Some(number_text(literal.value)),
        _ => None,
    }
}

pub fn number_text(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e21 { format!("{}", value as i64) } else { format!("{value}") }
}

#[derive(Clone, Debug, PartialEq)]
pub enum LiteralValue {
    Missing,
    Str(String),
    Other(String),
}

pub fn literal_argument(argument: Option<&Argument>) -> Option<LiteralValue> {
    let Some(argument) = argument else { return Some(LiteralValue::Missing) };
    let expression = argument.as_expression()?;
    literal_expression(expression)
}

pub fn literal_expression(expression: &Expression) -> Option<LiteralValue> {
    match expression.without_parentheses() {
        Expression::StringLiteral(literal) => Some(LiteralValue::Str(literal.value.to_string())),
        Expression::NumericLiteral(literal) => Some(LiteralValue::Other(number_text(literal.value))),
        Expression::BooleanLiteral(literal) => Some(LiteralValue::Other(literal.value.to_string())),
        Expression::NullLiteral(_) => Some(LiteralValue::Other("null".into())),
        Expression::BigIntLiteral(literal) => Some(LiteralValue::Other(literal.raw.as_ref().map(|raw| raw.to_string()).unwrap_or_default())),
        Expression::RegExpLiteral(literal) => Some(LiteralValue::Other(literal.raw.as_ref().map(|raw| raw.to_string()).unwrap_or_default())),
        Expression::TemplateLiteral(template) if template.expressions.is_empty() => Some(LiteralValue::Str(
            template.quasis.first().and_then(|quasi| quasi.value.cooked.as_ref()).map(|cooked| cooked.to_string()).unwrap_or_default(),
        )),
        _ => None,
    }
}

pub fn first_param_name(params: &FormalParameters) -> Option<String> {
    match params.items.first().map(|param| &param.pattern) {
        Some(BindingPattern::BindingIdentifier(identifier)) => Some(identifier.name.to_string()),
        _ => None,
    }
}

pub fn binding_names<'p>(pattern: &'p BindingPattern<'p>, into: &mut Vec<&'p BindingIdentifier<'p>>) {
    match pattern {
        BindingPattern::BindingIdentifier(identifier) => into.push(identifier),
        BindingPattern::ObjectPattern(object) => {
            for property in &object.properties {
                binding_names(&property.value, into);
            }
            if let Some(rest) = &object.rest {
                binding_names(&rest.argument, into);
            }
        }
        BindingPattern::ArrayPattern(array) => {
            for element in array.elements.iter().flatten() {
                binding_names(element, into);
            }
            if let Some(rest) = &array.rest {
                binding_names(&rest.argument, into);
            }
        }
        BindingPattern::AssignmentPattern(assignment) => binding_names(&assignment.left, into),
    }
}

pub fn root_identifier<'e>(expression: &'e Expression<'e>) -> Option<&'e IdentifierReference<'e>> {
    let mut current = expression.without_parentheses();
    loop {
        match current {
            Expression::StaticMemberExpression(member) => current = member.object.without_parentheses(),
            Expression::ComputedMemberExpression(member) => current = member.object.without_parentheses(),
            Expression::PrivateFieldExpression(member) => current = member.object.without_parentheses(),
            Expression::Identifier(identifier) => return Some(identifier),
            _ => return None,
        }
    }
}

pub fn line_column(source: &str, offset: u32) -> (usize, usize) {
    let offset = (offset as usize).min(source.len());
    let before = &source[..offset];
    let line = before.matches('\n').count() + 1;
    let line_start = before.rfind('\n').map_or(0, |index| index + 1);
    let column = before[line_start..].encode_utf16().count() + 1;
    (line, column)
}

pub fn span_of<T: GetSpan>(node: &T) -> Span {
    node.span()
}
