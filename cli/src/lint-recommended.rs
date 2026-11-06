use crate::lint_support::*;
use oxc::ast::AstKind;
use oxc::ast::ast::*;
use oxc::semantic::NodeId;
use oxc::span::{GetSpan, Span};
use oxc::syntax::symbol::SymbolFlags;
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

pub const RECOMMENDED_RULES: &[&str] = &[
    "for-direction",
    "getter-return",
    "no-async-promise-executor",
    "no-case-declarations",
    "no-class-assign",
    "no-compare-neg-zero",
    "no-cond-assign",
    "no-const-assign",
    "no-constant-condition",
    "no-control-regex",
    "no-debugger",
    "no-dupe-class-members",
    "no-dupe-else-if",
    "no-dupe-keys",
    "no-duplicate-case",
    "no-empty",
    "no-empty-character-class",
    "no-empty-pattern",
    "no-empty-static-block",
    "no-ex-assign",
    "no-extra-boolean-cast",
    "no-fallthrough",
    "no-func-assign",
    "no-global-assign",
    "no-import-assign",
    "no-irregular-whitespace",
    "no-loss-of-precision",
    "no-new-native-nonconstructor",
    "no-obj-calls",
    "no-prototype-builtins",
    "no-redeclare",
    "no-regex-spaces",
    "no-self-assign",
    "no-setter-return",
    "no-shadow-restricted-names",
    "no-sparse-arrays",
    "no-unassigned-vars",
    "no-undef",
    "no-unexpected-multiline",
    "no-unreachable",
    "no-unsafe-finally",
    "no-unsafe-negation",
    "no-unsafe-optional-chaining",
    "no-unused-labels",
    "no-unused-private-class-members",
    "no-unused-vars",
    "no-useless-catch",
    "no-useless-escape",
    "preserve-caught-error",
    "require-yield",
    "use-isnan",
    "valid-typeof",
];

pub struct Globals {
    pub names: HashMap<String, bool>,
}

pub fn browser_globals() -> &'static Globals {
    static GLOBALS: OnceLock<Globals> = OnceLock::new();
    GLOBALS.get_or_init(|| Globals {
        names: include_str!("browser-globals.txt")
            .lines()
            .filter(|line| !line.is_empty())
            .map(|line| match line.split_once(' ') {
                Some((name, _)) => (name.to_string(), true),
                None => (line.to_string(), false),
            })
            .collect(),
    })
}

fn identifier_of<'e>(expression: &'e Expression<'e>) -> Option<&'e str> {
    identifier_name(expression)
}

fn is_literal_like(expression: &Expression) -> bool {
    match expression.without_parentheses() {
        Expression::StringLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_)
        | Expression::BigIntLiteral(_)
        | Expression::RegExpLiteral(_)
        | Expression::ObjectExpression(_)
        | Expression::ArrayExpression(_)
        | Expression::ArrowFunctionExpression(_)
        | Expression::FunctionExpression(_)
        | Expression::ClassExpression(_) => true,
        Expression::TemplateLiteral(template) => template.expressions.is_empty(),
        Expression::UnaryExpression(unary) => {
            unary.operator == UnaryOperator::Void || is_literal_like(&unary.argument)
        }
        _ => false,
    }
}

fn assignment_targets_symbol<'a>(
    ctx: &Ctx<'_, 'a>,
    symbol_flag: SymbolFlags,
) -> Vec<(String, Span)> {
    let scoping = ctx.semantic.scoping();
    let mut found = Vec::new();
    for symbol in scoping.symbol_ids() {
        if !scoping.symbol_flags(symbol).intersects(symbol_flag) {
            continue;
        }
        for reference in scoping.get_resolved_references(symbol) {
            if reference.is_write() {
                let span = ctx
                    .semantic
                    .nodes()
                    .get_node(reference.node_id())
                    .kind()
                    .span();
                found.push((scoping.symbol_name(symbol).to_string(), span));
            }
        }
    }
    found
}

fn terminates(statement: &Statement) -> bool {
    match statement {
        Statement::ReturnStatement(_)
        | Statement::ThrowStatement(_)
        | Statement::BreakStatement(_)
        | Statement::ContinueStatement(_) => true,
        Statement::BlockStatement(block) => block.body.last().is_some_and(terminates),
        Statement::IfStatement(statement) => {
            terminates(&statement.consequent)
                && statement.alternate.as_ref().is_some_and(terminates)
        }
        _ => false,
    }
}

fn unreachable_in(ctx: &Ctx, statements: &[Statement]) {
    let mut terminated = false;
    for statement in statements {
        if terminated {
            let declaration_only = matches!(
                statement,
                Statement::FunctionDeclaration(_) | Statement::EmptyStatement(_)
            ) || matches!(statement, Statement::VariableDeclaration(declaration) if declaration.kind == VariableDeclarationKind::Var && declaration.declarations.iter().all(|declarator| declarator.init.is_none()));
            if !declaration_only {
                ctx.report("no-unreachable", statement.span(), "Unreachable code.");
                return;
            }
            continue;
        }
        if terminates(statement) {
            terminated = true;
        }
    }
}

fn has_comment_within(ctx: &Ctx, span: Span) -> bool {
    ctx.semantic
        .nodes()
        .program()
        .comments
        .iter()
        .any(|comment| comment.span.start >= span.start && comment.span.end <= span.end)
}

fn comments_between(ctx: &Ctx, start: u32, end: u32) -> Vec<String> {
    ctx.semantic
        .nodes()
        .program()
        .comments
        .iter()
        .filter(|comment| comment.span.start >= start && comment.span.end <= end)
        .map(|comment| ctx.text(comment.span).to_string())
        .collect()
}

fn function_contains_return_value(body: &FunctionBody) -> bool {
    struct Finder(bool);
    impl<'a> oxc::ast_visit::Visit<'a> for Finder {
        fn visit_return_statement(&mut self, statement: &ReturnStatement<'a>) {
            if statement.argument.is_some() {
                self.0 = true;
            }
        }
        fn visit_function(
            &mut self,
            _function: &Function<'a>,
            _flags: oxc::syntax::scope::ScopeFlags,
        ) {
        }
        fn visit_arrow_function_expression(&mut self, _arrow: &ArrowFunctionExpression<'a>) {}
        fn visit_class(&mut self, _class: &Class<'a>) {}
    }
    let mut finder = Finder(false);
    oxc::ast_visit::Visit::visit_function_body(&mut finder, body);
    finder.0
}

fn contains_yield(body: &FunctionBody) -> bool {
    struct Finder(bool);
    impl<'a> oxc::ast_visit::Visit<'a> for Finder {
        fn visit_yield_expression(&mut self, _expression: &YieldExpression<'a>) {
            self.0 = true;
        }
        fn visit_function(
            &mut self,
            _function: &Function<'a>,
            _flags: oxc::syntax::scope::ScopeFlags,
        ) {
        }
        fn visit_class(&mut self, _class: &Class<'a>) {}
    }
    let mut finder = Finder(false);
    oxc::ast_visit::Visit::visit_function_body(&mut finder, body);
    finder.0
}

fn is_getter_or_setter<'a>(
    ctx: &Ctx<'_, 'a>,
    function_id: NodeId,
) -> Option<(&'static str, String)> {
    match ctx.parent(function_id) {
        AstKind::MethodDefinition(method) => match method.kind {
            MethodDefinitionKind::Get => Some((
                "get",
                method
                    .key
                    .static_name()
                    .map(|name| name.display().to_string())
                    .unwrap_or_default(),
            )),
            MethodDefinitionKind::Set => Some((
                "set",
                method
                    .key
                    .static_name()
                    .map(|name| name.display().to_string())
                    .unwrap_or_default(),
            )),
            _ => None,
        },
        AstKind::ObjectProperty(property) => match property.kind {
            PropertyKind::Get => Some(("get", property_key_name(property).unwrap_or_default())),
            PropertyKind::Set => Some(("set", property_key_name(property).unwrap_or_default())),
            PropertyKind::Init => None,
        },
        _ => None,
    }
}

fn escape_valid_in_string(char: char, template: bool) -> bool {
    matches!(
        char,
        '\\' | 'n'
            | 'r'
            | 'v'
            | 't'
            | 'b'
            | 'f'
            | 'x'
            | 'u'
            | '\n'
            | '\r'
            | '\u{2028}'
            | '\u{2029}'
            | '0'..='9'
    ) || char == '\''
        || char == '"'
        || (template && (char == '`' || char == '$' || char == '{'))
        || (!template && char == '`')
}

fn useless_escapes(ctx: &Ctx, span: Span, template: bool) {
    let text = ctx.text(span);
    let mut chars = text.char_indices().peekable();
    while let Some((index, char)) = chars.next() {
        if char != '\\' {
            continue;
        }
        let Some((_, next)) = chars.next() else { break };
        let quote = text.chars().next().unwrap_or('"');
        let needed = escape_valid_in_string(next, template) || (!template && next == quote);
        let allowed_quote = !template && (next == '\'' || next == '"');
        if !needed || (!template && next == '`' && quote != '`' && false) {
            let offset = span.start + index as u32;
            ctx.report(
                "no-useless-escape",
                Span::new(offset, offset + 1 + next.len_utf8() as u32),
                format!("Unnecessary escape character: \\{next}."),
            );
        }
        let _ = allowed_quote;
    }
}

fn has_empty_class(pattern: &str) -> bool {
    let chars: Vec<char> = pattern.chars().collect();
    let mut index = 0;
    let mut in_class = false;
    while index < chars.len() {
        match chars[index] {
            '\\' => index += 1,
            '[' if !in_class => {
                if chars.get(index + 1) == Some(&']') {
                    return true;
                }
                in_class = true;
                if chars.get(index + 1) == Some(&'^') {
                    index += 1;
                }
            }
            ']' if in_class => in_class = false,
            _ => {}
        }
        index += 1;
    }
    false
}

fn regex_checks(ctx: &Ctx, literal: &RegExpLiteral) {
    let raw = literal
        .raw
        .as_ref()
        .map(|raw| raw.to_string())
        .unwrap_or_default();
    let Some(end) = raw.rfind('/') else { return };
    let pattern = &raw[1..end];
    if has_empty_class(pattern) {
        ctx.report("no-empty-character-class", literal.span, "Empty class.");
    }
    let mut controls = Vec::new();
    let bytes: Vec<char> = pattern.chars().collect();
    let mut index = 0;
    while index < bytes.len() {
        let char = bytes[index];
        if char == '\\' && index + 1 < bytes.len() {
            if bytes[index + 1] == 'x' && index + 3 < bytes.len() {
                let hex: String = bytes[index + 2..index + 4].iter().collect();
                if let Ok(value) = u32::from_str_radix(&hex, 16)
                    && value < 0x20
                {
                    controls.push(format!("\\x{hex}"));
                }
            }
            index += 2;
            continue;
        }
        if (char as u32) < 0x20 {
            controls.push(format!("\\x{:02x}", char as u32));
        }
        index += 1;
    }
    if !controls.is_empty() {
        ctx.report(
            "no-control-regex",
            literal.span,
            format!(
                "Unexpected control character(s) in regular expression: {}.",
                controls.join(", ")
            ),
        );
    }
    let mut in_class = false;
    let mut escaped = false;
    let mut run = 0;
    for char in pattern.chars() {
        if escaped {
            escaped = false;
            run = 0;
            continue;
        }
        match char {
            '\\' => {
                escaped = true;
                run = 0;
            }
            '[' => {
                in_class = true;
                run = 0;
            }
            ']' => {
                in_class = false;
                run = 0;
            }
            ' ' if !in_class => {
                run += 1;
                if run == 2 {
                    let count = pattern.split("  ").next().map(|_| 0).unwrap_or(0) + 2;
                    let _ = count;
                }
            }
            _ => {
                if run >= 2 {
                    ctx.report(
                        "no-regex-spaces",
                        literal.span,
                        format!("Spaces are hard to count. Use {{{run}}}."),
                    );
                    return;
                }
                run = 0;
            }
        }
    }
    if run >= 2 {
        ctx.report(
            "no-regex-spaces",
            literal.span,
            format!("Spaces are hard to count. Use {{{run}}}."),
        );
    }
}

fn significant_digits(text: &str) -> String {
    let lower = text.to_lowercase().replace('_', "");
    let (mantissa, exponent) = match lower.split_once('e') {
        Some((mantissa, exponent)) => (mantissa.to_string(), exponent.parse::<i64>().unwrap_or(0)),
        None => (lower.clone(), 0),
    };
    let (integer, fraction) = mantissa
        .split_once('.')
        .map(|(a, b)| (a.to_string(), b.to_string()))
        .unwrap_or((mantissa.clone(), String::new()));
    let digits = format!("{integer}{fraction}");
    let trimmed = digits.trim_start_matches('0');
    let leading_zeros = digits.len() - trimmed.len();
    let point = integer.len() as i64 + exponent - leading_zeros as i64;
    format!("{}e{point}", trimmed.trim_end_matches('0'))
}

fn loses_precision(literal: &NumericLiteral) -> bool {
    let Some(raw) = literal.raw.as_ref() else {
        return false;
    };
    let raw = raw.as_str();
    let lower = raw.to_lowercase();
    if lower.starts_with("0x") || lower.starts_with("0b") || lower.starts_with("0o") {
        let digits = lower[2..].replace('_', "");
        let radix = match &lower[..2] {
            "0x" => 16,
            "0b" => 2,
            _ => 8,
        };
        return u128::from_str_radix(&digits, radix)
            .is_ok_and(|value| value > (1u128 << 53) && (literal.value as u128) != value);
    }
    if literal.value.is_infinite() {
        return true;
    }
    let shortest = format!("{:e}", literal.value);
    significant_digits(raw) != significant_digits(&shortest) && literal.value != 0.0
}

fn unused_vars(ctx: &Ctx) {
    let scoping = ctx.semantic.scoping();
    let nodes = ctx.semantic.nodes();
    for symbol in scoping.symbol_ids() {
        let flags = scoping.symbol_flags(symbol);
        let name = scoping.symbol_name(symbol);
        if name.starts_with('_') {
            continue;
        }
        let declaration = scoping.symbol_declaration(symbol);
        let declaration_kind = nodes.kind(declaration);
        let mut exported = false;
        for ancestor in nodes.ancestor_kinds(declaration) {
            if matches!(
                ancestor,
                AstKind::ExportDeclaration(_) | AstKind::ExportDefaultDeclaration(_)
            ) {
                exported = true;
                break;
            }
            if matches!(ancestor, AstKind::Program(_)) || ancestor.is_function_like() {
                break;
            }
        }
        if exported {
            continue;
        }
        if let AstKind::Function(function) = declaration_kind
            && function.r#type == FunctionType::FunctionExpression
        {
            continue;
        }
        if matches!(declaration_kind, AstKind::Class(class) if class.r#type == ClassType::ClassExpression)
        {
            continue;
        }
        let symbol_span = scoping.symbol_span(symbol);
        let self_scope: Option<Span> = match declaration_kind {
            AstKind::Function(function) => Some(function.span),
            AstKind::Class(class) => Some(class.span),
            _ => None,
        };
        let references: Vec<&oxc::semantic::Reference> =
            scoping.get_resolved_references(symbol).collect();
        let used = references.iter().any(|reference| {
            if !reference.is_read() {
                return false;
            }
            let span = nodes.get_node(reference.node_id()).kind().span();
            if let Some(scope) = self_scope
                && span.start >= scope.start
                && span.end <= scope.end
            {
                return false;
            }
            if reference.is_write() {
                let parent = nodes.parent_kind(reference.node_id());
                if matches!(parent, AstKind::UpdateExpression(_))
                    && matches!(
                        nodes.parent_kind(nodes.parent_id(reference.node_id())),
                        AstKind::ExpressionStatement(_)
                    )
                {
                    return false;
                }
                if let AstKind::AssignmentExpression(assignment) = parent
                    && assignment.operator != AssignmentOperator::Assign
                    && matches!(
                        nodes.parent_kind(nodes.parent_id(reference.node_id())),
                        AstKind::ExpressionStatement(_)
                    )
                {
                    return false;
                }
            }
            true
        });
        if used {
            continue;
        }
        let is_parameter = matches!(
            declaration_kind,
            AstKind::FormalParameter(_) | AstKind::FormalParameterRest(_)
        ) || nodes
            .ancestor_kinds(declaration)
            .take_while(|kind| !kind.is_function_like())
            .any(|kind| {
                matches!(
                    kind,
                    AstKind::FormalParameter(_) | AstKind::FormalParameterRest(_)
                )
            });
        if is_parameter {
            let function = nodes
                .ancestor_ids(declaration)
                .find(|id| nodes.kind(*id).is_function_like());
            let params = function.and_then(|id| match nodes.kind(id) {
                AstKind::Function(function) => Some(&*function.params),
                AstKind::ArrowFunctionExpression(arrow) => Some(&*arrow.params),
                _ => None,
            });
            if let Some(params) = params {
                if matches!(nodes.kind(function.unwrap()), AstKind::Function(function) if matches!(nodes.parent_kind(function.node_id()), AstKind::MethodDefinition(method) if method.kind == MethodDefinitionKind::Set))
                {
                    continue;
                }
                let mut later_used = false;
                let mut after = false;
                let mut parameter_names: Vec<Vec<&BindingIdentifier>> = Vec::new();
                for item in &params.items {
                    let mut names = Vec::new();
                    binding_names(&item.pattern, &mut names);
                    parameter_names.push(names);
                }
                for names in &parameter_names {
                    if after {
                        for identifier in names {
                            if let Some(other) = identifier.symbol_id.get()
                                && scoping
                                    .get_resolved_references(other)
                                    .any(|reference| reference.is_read())
                            {
                                later_used = true;
                            }
                        }
                    }
                    if names
                        .iter()
                        .any(|identifier| identifier.span == symbol_span)
                    {
                        after = true;
                    }
                }
                if let Some(rest) = &params.rest {
                    let mut names = Vec::new();
                    binding_names(&rest.rest.argument, &mut names);
                    if after {
                        for identifier in names {
                            if let Some(other) = identifier.symbol_id.get()
                                && scoping
                                    .get_resolved_references(other)
                                    .any(|reference| reference.is_read())
                            {
                                later_used = true;
                            }
                        }
                    }
                }
                if later_used {
                    continue;
                }
            }
        }
        let writes: Vec<Span> = references
            .iter()
            .filter(|reference| reference.is_write())
            .map(|reference| nodes.get_node(reference.node_id()).kind().span())
            .collect();
        let has_init = match declaration_kind {
            AstKind::VariableDeclarator(declarator) => declarator.init.is_some(),
            _ => {
                nodes
                    .ancestor_kinds(declaration)
                    .find_map(|kind| match kind {
                        AstKind::VariableDeclarator(declarator) => Some(declarator.init.is_some()),
                        _ => None,
                    })
                    .unwrap_or(false)
                    && !matches!(declaration_kind, AstKind::FormalParameter(_))
            }
        };
        let assigned = (has_init || !writes.is_empty())
            && !flags.intersects(
                SymbolFlags::Function
                    | SymbolFlags::Class
                    | SymbolFlags::Import
                    | SymbolFlags::CatchVariable,
            )
            && !is_parameter;
        let in_for_in_of = nodes.ancestor_kinds(declaration).take(3).any(|kind| {
            matches!(
                kind,
                AstKind::ForInStatement(_) | AstKind::ForOfStatement(_)
            )
        });
        let message = if assigned || in_for_in_of {
            format!("'{name}' is assigned a value but never used.")
        } else {
            format!("'{name}' is defined but never used.")
        };
        let span = writes
            .last()
            .copied()
            .filter(|_| !has_init && !in_for_in_of)
            .unwrap_or(symbol_span);
        ctx.report("no-unused-vars", span, message);
    }
}

fn check_undefined(ctx: &Ctx) {
    let scoping = ctx.semantic.scoping();
    let nodes = ctx.semantic.nodes();
    let globals = browser_globals();
    for references in scoping.root_unresolved_references_ids() {
        for reference_id in references {
            let reference = scoping.get_reference(reference_id);
            let node = nodes.get_node(reference.node_id());
            let AstKind::IdentifierReference(identifier) = node.kind() else {
                continue;
            };
            let name = identifier.name.as_str();
            if let Some(writable) = globals.names.get(name) {
                if reference.is_write() && !*writable {
                    ctx.report(
                        "no-global-assign",
                        identifier.span,
                        format!("Read-only global '{name}' should not be modified."),
                    );
                }
                continue;
            }
            if name == "undefined" || name == "globalThis" {
                continue;
            }
            if matches!(nodes.parent_kind(reference.node_id()), AstKind::UnaryExpression(unary) if unary.operator == UnaryOperator::Typeof)
            {
                continue;
            }
            ctx.report(
                "no-undef",
                identifier.span,
                format!("'{name}' is not defined."),
            );
        }
    }
}

fn binary_operator_text(operator: BinaryOperator) -> &'static str {
    operator.as_str()
}

pub fn run(ctx: &Ctx) {
    let scoping = ctx.semantic.scoping();
    let nodes = ctx.semantic.nodes();
    unused_vars(ctx);
    check_undefined(ctx);
    for (name, span) in assignment_targets_symbol(ctx, SymbolFlags::ConstVariable) {
        ctx.report("no-const-assign", span, format!("'{name}' is constant."));
    }
    for (name, span) in assignment_targets_symbol(ctx, SymbolFlags::Class) {
        ctx.report("no-class-assign", span, format!("'{name}' is a class."));
    }
    for (name, span) in assignment_targets_symbol(ctx, SymbolFlags::Function) {
        ctx.report("no-func-assign", span, format!("'{name}' is a function."));
    }
    for (name, span) in assignment_targets_symbol(ctx, SymbolFlags::Import) {
        ctx.report("no-import-assign", span, format!("'{name}' is read-only."));
    }
    for (name, span) in assignment_targets_symbol(ctx, SymbolFlags::CatchVariable) {
        let _ = name;
        ctx.report(
            "no-ex-assign",
            span,
            "Do not assign to the exception parameter.",
        );
    }
    for symbol in scoping.symbol_ids() {
        for redeclaration in scoping.symbol_redeclarations(symbol) {
            ctx.report(
                "no-redeclare",
                redeclaration.span,
                format!("'{}' is already defined.", scoping.symbol_name(symbol)),
            );
        }
        let name = scoping.symbol_name(symbol);
        if ["undefined", "NaN", "Infinity", "eval", "arguments"].contains(&name) {
            ctx.report(
                "no-shadow-restricted-names",
                scoping.symbol_span(symbol),
                format!("Shadowing of global property '{name}'."),
            );
        }
        let flags = scoping.symbol_flags(symbol);
        if flags.intersects(SymbolFlags::Variable) && !flags.contains(SymbolFlags::ConstVariable) {
            let declaration = scoping.symbol_declaration(symbol);
            let declarator =
                nodes
                    .ancestor_kinds(declaration)
                    .take(4)
                    .find_map(|kind| match kind {
                        AstKind::VariableDeclarator(declarator) => Some(declarator),
                        _ => None,
                    });
            if let Some(declarator) = declarator {
                let in_loop_head = nodes.ancestor_kinds(declaration).take(5).any(|kind| {
                    matches!(
                        kind,
                        AstKind::ForInStatement(_) | AstKind::ForOfStatement(_)
                    )
                });
                let references: Vec<&oxc::semantic::Reference> =
                    scoping.get_resolved_references(symbol).collect();
                if declarator.init.is_none()
                    && !in_loop_head
                    && matches!(declarator.id, BindingPattern::BindingIdentifier(_))
                    && !references.iter().any(|reference| reference.is_write())
                    && references.iter().any(|reference| reference.is_read())
                {
                    ctx.report(
                        "no-unassigned-vars",
                        scoping.symbol_span(symbol),
                        format!("'{name}' is always 'undefined' because it's never assigned."),
                    );
                }
            }
        }
    }
    let mut used_labels: HashSet<String> = HashSet::new();
    for node in nodes.iter() {
        match node.kind() {
            AstKind::BreakStatement(statement) => {
                if let Some(label) = &statement.label {
                    used_labels.insert(label.name.to_string());
                }
            }
            AstKind::ContinueStatement(statement) => {
                if let Some(label) = &statement.label {
                    used_labels.insert(label.name.to_string());
                }
            }
            _ => {}
        }
    }
    let mut private_used: HashSet<String> = HashSet::new();
    for node in nodes.iter() {
        match node.kind() {
            AstKind::PrivateFieldExpression(expression) => {
                private_used.insert(expression.field.name.to_string());
            }
            AstKind::PrivateInExpression(expression) => {
                private_used.insert(expression.left.name.to_string());
            }
            _ => {}
        }
    }
    for node in nodes.iter() {
        let id = node.id();
        match node.kind() {
            AstKind::DebuggerStatement(statement) => ctx.report(
                "no-debugger",
                statement.span,
                "Unexpected 'debugger' statement.",
            ),
            AstKind::ForStatement(statement) => {
                if let (Some(Expression::BinaryExpression(test)), Some(update)) =
                    (&statement.test, &statement.update)
                {
                    let counter = identifier_of(&test.left);
                    let direction = match test.operator {
                        BinaryOperator::LessThan | BinaryOperator::LessEqualThan => 1,
                        BinaryOperator::GreaterThan | BinaryOperator::GreaterEqualThan => -1,
                        _ => 0,
                    };
                    let moves = match update {
                        Expression::UpdateExpression(update) => {
                            let target = match &update.argument {
                                SimpleAssignmentTarget::AssignmentTargetIdentifier(identifier) => {
                                    Some(identifier.name.as_str())
                                }
                                _ => None,
                            };
                            (target == counter).then_some(
                                if update.operator == UpdateOperator::Increment {
                                    1
                                } else {
                                    -1
                                },
                            )
                        }
                        Expression::AssignmentExpression(assignment) => {
                            let target = match &assignment.left {
                                AssignmentTarget::AssignmentTargetIdentifier(identifier) => {
                                    Some(identifier.name.as_str())
                                }
                                _ => None,
                            };
                            let sign = match (
                                &assignment.operator,
                                assignment.right.without_parentheses(),
                            ) {
                                (
                                    AssignmentOperator::Addition,
                                    Expression::NumericLiteral(literal),
                                ) => Some(if literal.value >= 0.0 { 1 } else { -1 }),
                                (
                                    AssignmentOperator::Subtraction,
                                    Expression::NumericLiteral(literal),
                                ) => Some(if literal.value >= 0.0 { -1 } else { 1 }),
                                _ => None,
                            };
                            if target == counter { sign } else { None }
                        }
                        _ => None,
                    };
                    if counter.is_some()
                        && direction != 0
                        && moves.is_some_and(|moves| moves != direction)
                    {
                        ctx.report("for-direction", statement.span, "The update clause in this loop moves the variable in the wrong direction.");
                    }
                }
                if let Some(test) = &statement.test {
                    if let Expression::AssignmentExpression(assignment) = test
                        && !wrapped_twice(ctx, assignment.span, 1)
                    {
                        ctx.report(
                            "no-cond-assign",
                            assignment.span,
                            "Expected a conditional expression and instead saw an assignment.",
                        );
                    }
                    if is_literal_like(test) {
                        ctx.report(
                            "no-constant-condition",
                            test.span(),
                            "Unexpected constant condition.",
                        );
                    }
                }
            }
            AstKind::Function(function) => {
                if let Some(body) = &function.body {
                    if let Some((kind, name)) = is_getter_or_setter(ctx, id)
                        && kind == "get"
                        && !function_contains_return_value(body)
                    {
                        ctx.report(
                            "getter-return",
                            function.span,
                            format!("Expected to return a value in getter '{name}'."),
                        );
                    }
                    if function.generator && !body.statements.is_empty() && !contains_yield(body) {
                        ctx.report(
                            "require-yield",
                            function.span,
                            "This generator function does not have 'yield'.",
                        );
                    }
                    unreachable_in(ctx, &body.statements);
                }
            }
            AstKind::ArrowFunctionExpression(arrow) => {
                if let ArrowFunctionBody::FunctionBody(body) = &arrow.body {
                    unreachable_in(ctx, &body.statements);
                }
            }
            AstKind::BlockStatement(block) => {
                unreachable_in(ctx, &block.body);
                let parent = ctx.parent(id);
                let allowed_parent = matches!(
                    parent,
                    AstKind::Function(_)
                        | AstKind::ArrowFunctionExpression(_)
                        | AstKind::FunctionBody(_)
                );
                if block.body.is_empty() && !allowed_parent && !has_comment_within(ctx, block.span)
                {
                    ctx.report("no-empty", block.span, "Empty block statement.");
                }
            }
            AstKind::StaticBlock(block) => {
                if block.body.is_empty() && !has_comment_within(ctx, block.span) {
                    ctx.report(
                        "no-empty-static-block",
                        block.span,
                        "Unexpected empty static block.",
                    );
                }
            }
            AstKind::SwitchStatement(statement) => {
                if statement.cases.is_empty() && !has_comment_within(ctx, statement.span) {
                    ctx.report("no-empty", statement.span, "Empty switch statement.");
                }
                let mut seen: Vec<&str> = Vec::new();
                for case in &statement.cases {
                    if let Some(test) = &case.test {
                        let text = ctx.text(test.span()).trim();
                        if seen.contains(&text) {
                            ctx.report("no-duplicate-case", case.span, "Duplicate case label.");
                        } else {
                            seen.push(text);
                        }
                        if is_nan(test) {
                            ctx.report(
                                "use-isnan",
                                test.span(),
                                "'case NaN' can never match. Use Number.isNaN before the switch.",
                            );
                        }
                    }
                }
                if is_nan(&statement.discriminant) {
                    ctx.report("use-isnan", statement.discriminant.span(), "'switch(NaN)' can never match a case clause. Use Number.isNaN instead of the switch.");
                }
                for (index, case) in statement.cases.iter().enumerate() {
                    if matches!(case.consequent.first(), Some(Statement::VariableDeclaration(declaration)) if declaration.kind != VariableDeclarationKind::Var)
                        || case.consequent.iter().any(|statement| matches!(statement, Statement::VariableDeclaration(declaration) if declaration.kind != VariableDeclarationKind::Var) || matches!(statement, Statement::FunctionDeclaration(_) | Statement::ClassDeclaration(_)))
                    {
                        for statement in &case.consequent {
                            if matches!(statement, Statement::VariableDeclaration(declaration) if declaration.kind != VariableDeclarationKind::Var) || matches!(statement, Statement::FunctionDeclaration(_) | Statement::ClassDeclaration(_)) {
                                ctx.report("no-case-declarations", statement.span(), "Unexpected lexical declaration in case block.");
                            }
                        }
                    }
                    let Some(next) = statement.cases.get(index + 1) else {
                        continue;
                    };
                    if case.consequent.is_empty() || case.consequent.last().is_some_and(terminates)
                    {
                        continue;
                    }
                    let comments = comments_between(
                        ctx,
                        case.consequent.last().unwrap().span().end,
                        next.span.start,
                    );
                    if comments.iter().any(|comment| {
                        comment.to_lowercase().contains("falls through")
                            || comment.to_lowercase().contains("fall through")
                            || comment.to_lowercase().contains("fallthrough")
                    }) {
                        continue;
                    }
                    let message = if next.test.is_some() {
                        "Expected a 'break' statement before 'case'."
                    } else {
                        "Expected a 'break' statement before 'default'."
                    };
                    ctx.report("no-fallthrough", next.span, message);
                }
            }
            AstKind::CatchClause(clause) => {
                if let Some(parameter) = &clause.param
                    && let BindingPattern::BindingIdentifier(param) = &parameter.pattern
                    && let [Statement::ThrowStatement(throw)] = clause.body.body.as_slice()
                    && identifier_of(&throw.argument) == Some(param.name.as_str())
                {
                    let try_statement = ctx.parent(id);
                    let message = match try_statement {
                        AstKind::TryStatement(statement) if statement.finalizer.is_some() => {
                            "Unnecessary catch clause."
                        }
                        _ => "Unnecessary try/catch wrapper.",
                    };
                    let span = match try_statement {
                        AstKind::TryStatement(statement) if statement.finalizer.is_none() => {
                            statement.span
                        }
                        _ => clause.span,
                    };
                    ctx.report("no-useless-catch", span, message);
                }
            }
            AstKind::TryStatement(statement) => {
                if let Some(finalizer) = &statement.finalizer {
                    finally_check(ctx, &finalizer.body);
                }
            }
            AstKind::ThrowStatement(throw) => {
                let catch_param = nodes
                    .ancestor_kinds(id)
                    .take_while(|kind| !kind.is_function_like())
                    .find_map(|kind| match kind {
                        AstKind::CatchClause(clause) => {
                            clause
                                .param
                                .as_ref()
                                .and_then(|param| match &param.pattern {
                                    BindingPattern::BindingIdentifier(identifier) => {
                                        Some(identifier.name.to_string())
                                    }
                                    _ => None,
                                })
                        }
                        _ => None,
                    });
                if let (Some(caught), Expression::NewExpression(created)) =
                    (catch_param, throw.argument.without_parentheses())
                {
                    let is_error = identifier_of(&created.callee)
                        .is_some_and(|name| name == "Error" || name.ends_with("Error"));
                    let references_caught = created
                        .arguments
                        .iter()
                        .any(|argument| ctx.text(argument.span()).contains(&caught));
                    let has_cause = created.arguments.iter().any(|argument| matches!(argument, Argument::ObjectExpression(object) if object.properties.iter().any(|property| matches!(property, ObjectPropertyKind::ObjectProperty(property) if property_key_name(property).as_deref() == Some("cause")))));
                    if is_error && !has_cause && !references_caught {
                        ctx.report(
                            "preserve-caught-error",
                            created.span,
                            "There is no `cause` attached to the symptom error being thrown.",
                        );
                    }
                }
            }
            AstKind::IfStatement(statement) => {
                if let Expression::AssignmentExpression(assignment) = &statement.test
                    && !wrapped_twice(ctx, assignment.span, 2)
                {
                    ctx.report(
                        "no-cond-assign",
                        assignment.span,
                        "Expected a conditional expression and instead saw an assignment.",
                    );
                }
                if is_literal_like(&statement.test) {
                    ctx.report(
                        "no-constant-condition",
                        statement.test.span(),
                        "Unexpected constant condition.",
                    );
                }
                extra_boolean_cast(ctx, &statement.test);
                let mut tests = vec![ctx.text(statement.test.span()).trim()];
                let mut alternate = statement.alternate.as_ref();
                while let Some(Statement::IfStatement(next)) = alternate {
                    let text = ctx.text(next.test.span()).trim();
                    if tests.contains(&text) {
                        ctx.report("no-dupe-else-if", next.test.span(), "This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.");
                    }
                    tests.push(text);
                    alternate = next.alternate.as_ref();
                }
            }
            AstKind::WhileStatement(statement) => {
                if let Expression::AssignmentExpression(assignment) = &statement.test
                    && !wrapped_twice(ctx, assignment.span, 2)
                {
                    ctx.report(
                        "no-cond-assign",
                        assignment.span,
                        "Expected a conditional expression and instead saw an assignment.",
                    );
                }
                let while_true = matches!(statement.test.without_parentheses(), Expression::BooleanLiteral(literal) if literal.value);
                if !while_true && is_literal_like(&statement.test) {
                    ctx.report(
                        "no-constant-condition",
                        statement.test.span(),
                        "Unexpected constant condition.",
                    );
                }
                extra_boolean_cast(ctx, &statement.test);
            }
            AstKind::DoWhileStatement(statement) => {
                if let Expression::AssignmentExpression(assignment) = &statement.test
                    && !wrapped_twice(ctx, assignment.span, 2)
                {
                    ctx.report(
                        "no-cond-assign",
                        assignment.span,
                        "Expected a conditional expression and instead saw an assignment.",
                    );
                }
                extra_boolean_cast(ctx, &statement.test);
            }
            AstKind::ConditionalExpression(expression) => {
                if is_literal_like(&expression.test) {
                    ctx.report(
                        "no-constant-condition",
                        expression.test.span(),
                        "Unexpected constant condition.",
                    );
                }
                if let Expression::AssignmentExpression(assignment) = &expression.test
                    && !wrapped_twice(ctx, assignment.span, 1)
                {
                    ctx.report(
                        "no-cond-assign",
                        assignment.span,
                        "Expected a conditional expression and instead saw an assignment.",
                    );
                }
                extra_boolean_cast(ctx, &expression.test);
            }
            AstKind::UnaryExpression(unary) => {
                if unary.operator == UnaryOperator::LogicalNot {
                    extra_boolean_cast(ctx, &unary.argument);
                }
            }
            AstKind::BinaryExpression(expression) => {
                let operator = binary_operator_text(expression.operator);
                if expression.operator.is_equality() || expression.operator.is_compare() {
                    let negative_zero = |side: &Expression| matches!(side.without_parentheses(), Expression::UnaryExpression(unary) if unary.operator == UnaryOperator::UnaryNegation && matches!(unary.argument.without_parentheses(), Expression::NumericLiteral(literal) if literal.value == 0.0));
                    if negative_zero(&expression.left) || negative_zero(&expression.right) {
                        ctx.report(
                            "no-compare-neg-zero",
                            expression.span,
                            format!("Do not use the '{operator}' operator to compare against -0."),
                        );
                    }
                    if is_nan(&expression.left) || is_nan(&expression.right) {
                        ctx.report(
                            "use-isnan",
                            expression.span,
                            "Use the isNaN function to compare with NaN.",
                        );
                    }
                }
                if matches!(
                    expression.operator,
                    BinaryOperator::In | BinaryOperator::Instanceof
                ) {
                    if let Expression::UnaryExpression(unary) = &expression.left
                        && unary.operator == UnaryOperator::LogicalNot
                        && !wrapped_twice(ctx, unary.span, 1)
                    {
                        ctx.report(
                            "no-unsafe-negation",
                            unary.span,
                            format!(
                                "Unexpected negating the left operand of '{operator}' operator."
                            ),
                        );
                    }
                    if is_chain(&expression.right) {
                        ctx.report("no-unsafe-optional-chaining", expression.right.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                    }
                }
                if expression.operator.is_equality() {
                    let typeof_operand = |side: &Expression| matches!(side.without_parentheses(), Expression::UnaryExpression(unary) if unary.operator == UnaryOperator::Typeof);
                    for (typed, other) in [
                        (&expression.left, &expression.right),
                        (&expression.right, &expression.left),
                    ] {
                        if !typeof_operand(typed) {
                            continue;
                        }
                        if let Some(LiteralValue::Str(value)) = literal_expression(other)
                            && ![
                                "undefined",
                                "object",
                                "boolean",
                                "number",
                                "string",
                                "function",
                                "symbol",
                                "bigint",
                            ]
                            .contains(&value.as_str())
                        {
                            ctx.report(
                                "valid-typeof",
                                other.span(),
                                "Invalid typeof comparison value.",
                            );
                        }
                    }
                }
            }
            AstKind::AssignmentExpression(assignment) => {
                if assignment.operator == AssignmentOperator::Assign {
                    if let (AssignmentTarget::AssignmentTargetIdentifier(left), Some(right)) =
                        (&assignment.left, identifier_of(&assignment.right))
                        && left.name == right
                    {
                        ctx.report(
                            "no-self-assign",
                            assignment.right.span(),
                            format!("'{right}' is assigned to itself."),
                        );
                    }
                    if let (
                        AssignmentTarget::StaticMemberExpression(left),
                        Expression::StaticMemberExpression(right),
                    ) = (&assignment.left, assignment.right.without_parentheses())
                        && ctx.text(left.span) == ctx.text(right.span)
                    {
                        ctx.report(
                            "no-self-assign",
                            right.span,
                            format!("'{}' is assigned to itself.", ctx.text(right.span)),
                        );
                    }
                }
                if let AssignmentTarget::StaticMemberExpression(member) = &assignment.left {
                    namespace_member_write(ctx, &member.object, member.span);
                }
                if let AssignmentTarget::ComputedMemberExpression(member) = &assignment.left {
                    namespace_member_write(ctx, &member.object, member.span);
                }
            }
            AstKind::ObjectExpression(object) => {
                let mut seen: HashMap<(String, &'static str), ()> = HashMap::new();
                for property in &object.properties {
                    let ObjectPropertyKind::ObjectProperty(property) = property else {
                        continue;
                    };
                    let Some(key) = property_key_name(property) else {
                        continue;
                    };
                    if key == "__proto__" && !property.shorthand && !property.method {
                        continue;
                    }
                    let kind = match property.kind {
                        PropertyKind::Get => "get",
                        PropertyKind::Set => "set",
                        PropertyKind::Init => "init",
                    };
                    let conflicts = match kind {
                        "init" => {
                            seen.contains_key(&(key.clone(), "init"))
                                || seen.contains_key(&(key.clone(), "get"))
                                || seen.contains_key(&(key.clone(), "set"))
                        }
                        other => {
                            seen.contains_key(&(key.clone(), other))
                                || seen.contains_key(&(key.clone(), "init"))
                        }
                    };
                    if conflicts {
                        ctx.report(
                            "no-dupe-keys",
                            property.span,
                            format!("Duplicate key '{key}'."),
                        );
                    }
                    seen.insert((key, kind), ());
                }
            }
            AstKind::ClassBody(body) => {
                let mut seen: HashMap<(String, bool, &'static str), ()> = HashMap::new();
                for element in &body.body {
                    let ClassElement::MethodDefinition(method) = element else {
                        continue;
                    };
                    if method.kind == MethodDefinitionKind::Constructor || method.computed {
                        continue;
                    }
                    let Some(name) = method.key.static_name() else {
                        continue;
                    };
                    let kind = match method.kind {
                        MethodDefinitionKind::Get => "get",
                        MethodDefinitionKind::Set => "set",
                        _ => "method",
                    };
                    let key = (name.display().to_string(), method.r#static, kind);
                    let conflicts = match kind {
                        "method" => seen
                            .keys()
                            .any(|(other, is_static, _)| other == &key.0 && *is_static == key.1),
                        other => {
                            seen.contains_key(&key)
                                || seen.contains_key(&(key.0.clone(), key.1, "method"))
                                || {
                                    let _ = other;
                                    false
                                }
                        }
                    };
                    if conflicts {
                        ctx.report(
                            "no-dupe-class-members",
                            method.span,
                            format!("Duplicate name '{}'.", name.display()),
                        );
                    }
                    seen.insert(key, ());
                }
                for element in &body.body {
                    let (name, span) = match element {
                        ClassElement::PropertyDefinition(property) => match &property.key {
                            PropertyKey::PrivateIdentifier(identifier) => {
                                (identifier.name.to_string(), identifier.span)
                            }
                            _ => continue,
                        },
                        ClassElement::MethodDefinition(method) => match &method.key {
                            PropertyKey::PrivateIdentifier(identifier) => {
                                (identifier.name.to_string(), identifier.span)
                            }
                            _ => continue,
                        },
                        _ => continue,
                    };
                    if !private_used.contains(&name) {
                        ctx.report(
                            "no-unused-private-class-members",
                            span,
                            format!("'#{name}' is defined but never used."),
                        );
                    }
                }
            }
            AstKind::ObjectPattern(pattern) => {
                if pattern.properties.is_empty()
                    && pattern.rest.is_none()
                    && !matches!(ctx.parent(id), AstKind::FormalParameter(_))
                {
                    ctx.report(
                        "no-empty-pattern",
                        pattern.span,
                        "Unexpected empty object pattern.",
                    );
                }
            }
            AstKind::ArrayPattern(pattern) => {
                if pattern.elements.is_empty() && pattern.rest.is_none() {
                    ctx.report(
                        "no-empty-pattern",
                        pattern.span,
                        "Unexpected empty array pattern.",
                    );
                }
            }
            AstKind::ArrayExpression(array) => {
                if array
                    .elements
                    .iter()
                    .any(|element| matches!(element, ArrayExpressionElement::Elision(_)))
                {
                    ctx.report(
                        "no-sparse-arrays",
                        array.span,
                        "Unexpected comma in middle of array.",
                    );
                }
            }
            AstKind::NewExpression(expression) => {
                if let Some(name) = identifier_of(&expression.callee) {
                    if (name == "Symbol" || name == "BigInt")
                        && !is_shadowed(ctx, &expression.callee)
                    {
                        ctx.report(
                            "no-new-native-nonconstructor",
                            expression.callee.span(),
                            format!("`{name}` cannot be called as a constructor."),
                        );
                    }
                    if name == "Promise" {
                        if let Some(Argument::ArrowFunctionExpression(arrow)) =
                            expression.arguments.first()
                            && arrow.r#async
                        {
                            ctx.report(
                                "no-async-promise-executor",
                                arrow.span,
                                "Promise executor functions should not be async.",
                            );
                        }
                        if let Some(Argument::FunctionExpression(function)) =
                            expression.arguments.first()
                            && function.r#async
                        {
                            ctx.report(
                                "no-async-promise-executor",
                                function.span,
                                "Promise executor functions should not be async.",
                            );
                        }
                    }
                    if ["Math", "JSON", "Reflect", "Atomics", "Intl"].contains(&name)
                        && !is_shadowed(ctx, &expression.callee)
                    {
                        ctx.report(
                            "no-obj-calls",
                            expression.span,
                            format!("'{name}' is not a function."),
                        );
                    }
                    if name == "Boolean"
                        && let Some(argument) = expression
                            .arguments
                            .first()
                            .and_then(Argument::as_expression)
                    {
                        extra_boolean_cast(ctx, argument);
                    }
                }
                if is_chain(&expression.callee) {
                    ctx.report("no-unsafe-optional-chaining", expression.callee.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                }
            }
            AstKind::CallExpression(call) => {
                if let Some(name) = identifier_of(&call.callee) {
                    if ["Math", "JSON", "Reflect", "Atomics", "Intl"].contains(&name)
                        && !is_shadowed(ctx, &call.callee)
                    {
                        ctx.report(
                            "no-obj-calls",
                            call.span,
                            format!("'{name}' is not a function."),
                        );
                    }
                    if name == "Boolean"
                        && !is_shadowed(ctx, &call.callee)
                        && let Some(argument) =
                            call.arguments.first().and_then(Argument::as_expression)
                    {
                        extra_boolean_cast(ctx, argument);
                    }
                }
                if let Expression::StaticMemberExpression(member) =
                    call.callee.without_parentheses()
                    && [
                        "hasOwnProperty",
                        "isPrototypeOf",
                        "propertyIsEnumerable",
                        "__defineGetter__",
                        "__defineSetter__",
                        "__lookupGetter__",
                        "__lookupSetter__",
                    ]
                    .contains(&member.property.name.as_str())
                {
                    let object_is_prototype = matches!(member.object.without_parentheses(), Expression::StaticMemberExpression(object) if object.property.name == "prototype");
                    if !object_is_prototype {
                        ctx.report(
                            "no-prototype-builtins",
                            call.span,
                            format!(
                                "Do not access Object.prototype method '{}' from target object.",
                                member.property.name
                            ),
                        );
                    }
                }
                if !call.optional && is_chain(&call.callee) {
                    ctx.report("no-unsafe-optional-chaining", call.callee.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                }
                let between = &ctx.source[call.callee.span().end as usize..call.span.end as usize];
                if let Some(paren) = between.find('(') {
                    let gap = &between[..paren];
                    if gap.contains('\n')
                        && !call.optional
                        && call.arguments.first().is_none_or(|argument| {
                            argument.span().start > call.callee.span().end + paren as u32
                        })
                    {
                        let gap_trimmed = gap.trim();
                        if gap_trimmed.is_empty() {
                            ctx.report(
                                "no-unexpected-multiline",
                                Span::new(
                                    call.callee.span().end + paren as u32,
                                    call.callee.span().end + paren as u32 + 1,
                                ),
                                "Unexpected newline between function and ( of function call.",
                            );
                        }
                    }
                }
            }
            AstKind::TaggedTemplateExpression(expression) => {
                let gap = &ctx.source
                    [expression.tag.span().end as usize..expression.quasi.span.start as usize];
                if gap.contains('\n') {
                    ctx.report(
                        "no-unexpected-multiline",
                        expression.quasi.span,
                        "Unexpected newline between template tag and template literal.",
                    );
                }
            }
            AstKind::ComputedMemberExpression(member) => {
                let gap = &ctx.source
                    [member.object.span().end as usize..member.expression.span().start as usize];
                if let Some(bracket) = gap.find('[')
                    && gap[..bracket].contains('\n')
                    && gap[..bracket].trim().is_empty()
                    && !member.optional
                {
                    ctx.report(
                        "no-unexpected-multiline",
                        member.span,
                        "Unexpected newline between object and [ of property access.",
                    );
                }
                if !member.optional && is_chain(&member.object) {
                    ctx.report("no-unsafe-optional-chaining", member.object.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                }
            }
            AstKind::StaticMemberExpression(member) => {
                if !member.optional && is_chain(&member.object) {
                    ctx.report("no-unsafe-optional-chaining", member.object.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                }
            }
            AstKind::SpreadElement(spread) => {
                if matches!(
                    ctx.parent(id),
                    AstKind::ArrayExpression(_)
                        | AstKind::CallExpression(_)
                        | AstKind::NewExpression(_)
                ) && is_chain(&spread.argument)
                {
                    ctx.report("no-unsafe-optional-chaining", spread.argument.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                }
            }
            AstKind::ForOfStatement(statement) => {
                if is_chain(&statement.right) {
                    ctx.report("no-unsafe-optional-chaining", statement.right.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                }
            }
            AstKind::VariableDeclarator(declarator) => {
                if !matches!(declarator.id, BindingPattern::BindingIdentifier(_))
                    && let Some(init) = &declarator.init
                    && is_chain(init)
                {
                    ctx.report("no-unsafe-optional-chaining", init.span(), "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError.");
                }
            }
            AstKind::LabeledStatement(statement) => {
                if !used_labels.contains(statement.label.name.as_str()) {
                    ctx.report(
                        "no-unused-labels",
                        statement.label.span,
                        format!("'{}:' is defined but never used.", statement.label.name),
                    );
                }
            }
            AstKind::ReturnStatement(statement) => {
                if statement.argument.is_some() {
                    let function = nodes
                        .ancestor_ids(id)
                        .find(|ancestor| nodes.kind(*ancestor).is_function_like());
                    if let Some(function) = function
                        && matches!(is_getter_or_setter(ctx, function), Some(("set", _)))
                    {
                        ctx.report(
                            "no-setter-return",
                            statement.span,
                            "Setter cannot return a value.",
                        );
                    }
                }
            }
            AstKind::RegExpLiteral(literal) => regex_checks(ctx, literal),
            AstKind::NumericLiteral(literal) => {
                if loses_precision(literal) {
                    ctx.report(
                        "no-loss-of-precision",
                        literal.span,
                        "This number literal will lose precision at runtime.",
                    );
                }
            }
            AstKind::StringLiteral(literal) => {
                useless_escapes(ctx, literal.span, false);
            }
            AstKind::TemplateLiteral(template)
                if !matches!(ctx.parent(id), AstKind::TaggedTemplateExpression(_)) =>
            {
                for quasi in &template.quasis {
                    useless_escapes(ctx, quasi.span, true);
                }
            }
            _ => {}
        }
    }
    irregular_whitespace(ctx);
}

fn is_nan(expression: &Expression) -> bool {
    match expression.without_parentheses() {
        Expression::Identifier(identifier) => identifier.name == "NaN",
        Expression::StaticMemberExpression(member) => {
            member.property.name == "NaN" && identifier_of(&member.object) == Some("Number")
        }
        _ => false,
    }
}

fn is_chain(expression: &Expression) -> bool {
    match expression.without_parentheses() {
        Expression::ChainExpression(_) => true,
        Expression::LogicalExpression(logical) => {
            is_chain(&logical.right) && logical.operator != LogicalOperator::Coalesce && false
        }
        Expression::ConditionalExpression(conditional) => {
            is_chain(&conditional.consequent) || is_chain(&conditional.alternate)
        }
        Expression::SequenceExpression(sequence) => {
            sequence.expressions.last().is_some_and(is_chain)
        }
        Expression::AwaitExpression(await_expression) => is_chain(&await_expression.argument),
        _ => false,
    }
}

fn is_shadowed(ctx: &Ctx, expression: &Expression) -> bool {
    match expression.without_parentheses() {
        Expression::Identifier(identifier) => {
            identifier.reference_id.get().is_some_and(|reference| {
                ctx.semantic
                    .scoping()
                    .get_reference(reference)
                    .symbol_id()
                    .is_some()
            })
        }
        _ => false,
    }
}

fn wrapped_twice(ctx: &Ctx, span: Span, required: usize) -> bool {
    let before = ctx.source[..span.start as usize].trim_end();
    let after = ctx.source[span.end as usize..].trim_start();
    let opens = before
        .chars()
        .rev()
        .take_while(|char| *char == '(' || char.is_whitespace())
        .filter(|char| *char == '(')
        .count();
    let closes = after
        .chars()
        .take_while(|char| *char == ')' || char.is_whitespace())
        .filter(|char| *char == ')')
        .count();
    opens.min(closes) >= required
}

fn simple_operand(expression: &Expression) -> bool {
    matches!(
        expression.without_parentheses(),
        Expression::Identifier(_)
            | Expression::StaticMemberExpression(_)
            | Expression::ComputedMemberExpression(_)
            | Expression::CallExpression(_)
            | Expression::StringLiteral(_)
            | Expression::NumericLiteral(_)
            | Expression::BooleanLiteral(_)
            | Expression::NullLiteral(_)
            | Expression::TemplateLiteral(_)
            | Expression::ParenthesizedExpression(_)
    )
}

fn cast_fix(ctx: &Ctx, whole: Span, inner: &Expression) -> Option<Vec<(u32, u32, String)>> {
    let text = ctx.text(inner.span());
    let replacement = if simple_operand(inner) {
        text.to_string()
    } else {
        format!("({text})")
    };
    Some(vec![(whole.start, whole.end, replacement)])
}

fn extra_boolean_cast(ctx: &Ctx, expression: &Expression) {
    match expression.without_parentheses() {
        Expression::UnaryExpression(unary) if unary.operator == UnaryOperator::LogicalNot => {
            if let Expression::UnaryExpression(inner) = unary.argument.without_parentheses()
                && inner.operator == UnaryOperator::LogicalNot
            {
                ctx.report_fix(
                    "no-extra-boolean-cast",
                    unary.span,
                    "Redundant double negation.",
                    cast_fix(ctx, unary.span, &inner.argument),
                );
            }
        }
        Expression::CallExpression(call)
            if identifier_of(&call.callee) == Some("Boolean")
                && !is_shadowed(ctx, &call.callee) =>
        {
            let fix = match call.arguments.as_slice() {
                [argument] => argument
                    .as_expression()
                    .and_then(|inner| cast_fix(ctx, call.span, inner)),
                _ => None,
            };
            ctx.report_fix(
                "no-extra-boolean-cast",
                call.span,
                "Redundant Boolean call.",
                fix,
            );
        }
        _ => {}
    }
}

fn namespace_member_write(ctx: &Ctx, object: &Expression, span: Span) {
    let Expression::Identifier(identifier) = object.without_parentheses() else {
        return;
    };
    let Some(reference) = identifier.reference_id.get() else {
        return;
    };
    let scoping = ctx.semantic.scoping();
    let Some(symbol) = scoping.get_reference(reference).symbol_id() else {
        return;
    };
    if !scoping.symbol_flags(symbol).contains(SymbolFlags::Import) {
        return;
    }
    let declaration = scoping.symbol_declaration(symbol);
    if matches!(
        ctx.semantic.nodes().kind(declaration),
        AstKind::ImportNamespaceSpecifier(_)
    ) {
        ctx.report(
            "no-import-assign",
            span,
            format!("The members of '{}' are read-only.", identifier.name),
        );
    }
}

fn finally_check(ctx: &Ctx, statements: &[Statement]) {
    struct Finder<'c, 's, 'a> {
        ctx: &'c Ctx<'s, 'a>,
        depth_loop: usize,
        depth_switch: usize,
    }
    impl<'a> oxc::ast_visit::Visit<'a> for Finder<'_, '_, '_> {
        fn visit_return_statement(&mut self, statement: &ReturnStatement<'a>) {
            self.ctx.report(
                "no-unsafe-finally",
                statement.span,
                "Unsafe usage of ReturnStatement.",
            );
        }
        fn visit_throw_statement(&mut self, statement: &ThrowStatement<'a>) {
            self.ctx.report(
                "no-unsafe-finally",
                statement.span,
                "Unsafe usage of ThrowStatement.",
            );
        }
        fn visit_break_statement(&mut self, statement: &BreakStatement<'a>) {
            if statement.label.is_some() || (self.depth_loop == 0 && self.depth_switch == 0) {
                self.ctx.report(
                    "no-unsafe-finally",
                    statement.span,
                    "Unsafe usage of BreakStatement.",
                );
            }
        }
        fn visit_continue_statement(&mut self, statement: &ContinueStatement<'a>) {
            if statement.label.is_some() || self.depth_loop == 0 {
                self.ctx.report(
                    "no-unsafe-finally",
                    statement.span,
                    "Unsafe usage of ContinueStatement.",
                );
            }
        }
        fn visit_for_statement(&mut self, statement: &ForStatement<'a>) {
            self.depth_loop += 1;
            oxc::ast_visit::walk::walk_for_statement(self, statement);
            self.depth_loop -= 1;
        }
        fn visit_for_of_statement(&mut self, statement: &ForOfStatement<'a>) {
            self.depth_loop += 1;
            oxc::ast_visit::walk::walk_for_of_statement(self, statement);
            self.depth_loop -= 1;
        }
        fn visit_for_in_statement(&mut self, statement: &ForInStatement<'a>) {
            self.depth_loop += 1;
            oxc::ast_visit::walk::walk_for_in_statement(self, statement);
            self.depth_loop -= 1;
        }
        fn visit_while_statement(&mut self, statement: &WhileStatement<'a>) {
            self.depth_loop += 1;
            oxc::ast_visit::walk::walk_while_statement(self, statement);
            self.depth_loop -= 1;
        }
        fn visit_do_while_statement(&mut self, statement: &DoWhileStatement<'a>) {
            self.depth_loop += 1;
            oxc::ast_visit::walk::walk_do_while_statement(self, statement);
            self.depth_loop -= 1;
        }
        fn visit_switch_statement(&mut self, statement: &SwitchStatement<'a>) {
            self.depth_switch += 1;
            oxc::ast_visit::walk::walk_switch_statement(self, statement);
            self.depth_switch -= 1;
        }
        fn visit_function(
            &mut self,
            _function: &Function<'a>,
            _flags: oxc::syntax::scope::ScopeFlags,
        ) {
        }
        fn visit_arrow_function_expression(&mut self, _arrow: &ArrowFunctionExpression<'a>) {}
        fn visit_class(&mut self, _class: &Class<'a>) {}
    }
    let mut finder = Finder {
        ctx,
        depth_loop: 0,
        depth_switch: 0,
    };
    for statement in statements {
        oxc::ast_visit::Visit::visit_statement(&mut finder, statement);
    }
}

const IRREGULAR: &[char] = &[
    '\u{000B}', '\u{000C}', '\u{00A0}', '\u{FEFF}', '\u{0085}', '\u{1680}', '\u{180E}', '\u{2000}',
    '\u{2001}', '\u{2002}', '\u{2003}', '\u{2004}', '\u{2005}', '\u{2006}', '\u{2007}', '\u{2008}',
    '\u{2009}', '\u{200A}', '\u{200B}', '\u{2028}', '\u{2029}', '\u{202F}', '\u{205F}', '\u{3000}',
];

fn irregular_whitespace(ctx: &Ctx) {
    if !ctx.source.chars().any(|char| IRREGULAR.contains(&char)) {
        return;
    }
    let mut allowed: Vec<Span> = ctx
        .semantic
        .nodes()
        .program()
        .comments
        .iter()
        .map(|comment| comment.span)
        .collect();
    for node in ctx.nodes() {
        match node.kind() {
            AstKind::StringLiteral(literal) => allowed.push(literal.span),
            AstKind::TemplateLiteral(template) => allowed.push(template.span),
            AstKind::RegExpLiteral(literal) => allowed.push(literal.span),
            _ => {}
        }
    }
    for (index, char) in ctx.source.char_indices() {
        if index == 0 && char == '\u{FEFF}' {
            continue;
        }
        if !IRREGULAR.contains(&char) {
            continue;
        }
        let offset = index as u32;
        if allowed
            .iter()
            .any(|span| offset >= span.start && offset < span.end)
        {
            continue;
        }
        ctx.report(
            "no-irregular-whitespace",
            Span::new(offset, offset + char.len_utf8() as u32),
            "Irregular whitespace not allowed.",
        );
    }
}
