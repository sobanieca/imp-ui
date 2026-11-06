use crate::library_exports::imp_module_exports;
use crate::lint_support::*;
use crate::names::{
    analytics_name_problem_of, analytics_subject, component_name_problem, http_client_name_problem,
    state_name_problem,
};
use crate::specifiers::{
    EXACT_VERSION, NPM_PREFIX, default_alias, imp_subpath_problem, is_imp_specifier,
    is_imp_std_specifier, parse_specifier,
};
use oxc::ast::AstKind;
use oxc::ast::ast::*;
use oxc::span::{GetSpan, Span};
use std::collections::{BTreeSet, HashMap, HashSet};

pub const IMP_RULES: &[&str] = &[
    "no-capital-component",
    "single-props-object",
    "state-name-namespace",
    "http-client-name-namespace",
    "analytics-name-namespace",
    "watch-with-self",
    "self-first-argument",
    "no-self-in-loading",
    "loading-with-async-setup",
    "on-remove-through-self",
    "no-self-at-module-scope",
    "abort-check-after-await",
    "no-state-as-child",
    "no-get-in-binding",
    "no-root-query-in-setup",
    "no-raw-timer",
    "component-name",
    "import-source",
    "unknown-export",
    "icons-by-name",
    "img-alt",
    "icon-button-name",
    "exact-dependency-versions",
    "app-map-unique-params",
];

const SELF_NAME: &str = "self";

fn std_specifiers() -> Vec<&'static str> {
    imp_module_exports()
        .keys()
        .copied()
        .filter(|specifier| is_imp_std_specifier(specifier))
        .collect()
}

fn api_specifiers() -> Vec<&'static str> {
    imp_module_exports()
        .keys()
        .copied()
        .filter(|specifier| !is_imp_std_specifier(specifier))
        .collect()
}

fn export_home(name: &str) -> Option<&'static str> {
    let order = crate::specifiers::IMP_MODULES
        .iter()
        .map(|(specifier, _)| *specifier)
        .filter(|specifier| !is_imp_std_specifier(specifier));
    let mut home = None;
    for specifier in order {
        if imp_module_exports()
            .get(specifier)
            .is_some_and(|names| names.contains(name))
        {
            home = Some(specifier);
        }
    }
    home
}

fn classify_factory(name: &str) -> Option<String> {
    if name == "el" {
        return Some("el".into());
    }
    let exports = imp_module_exports();
    let element_factory = name != "html"
        && exports
            .get("imp/html")
            .is_some_and(|names| names.contains(name));
    let std_component = !matches!(name, "notify" | "dismiss")
        && std_specifiers().iter().any(|specifier| {
            exports
                .get(specifier)
                .is_some_and(|names| names.contains(name))
        });
    (element_factory || std_component).then(|| "tag".into())
}

fn program_imports<'a>(ctx: &Ctx<'_, 'a>) -> Vec<&'a ImportDeclaration<'a>> {
    ctx.semantic
        .nodes()
        .program()
        .body
        .iter()
        .filter_map(|statement| match statement {
            Statement::ImportDeclaration(declaration) => Some(&**declaration),
            _ => None,
        })
        .collect()
}

struct HelperTracker {
    locals: HashMap<String, String>,
    namespaces: HashSet<String>,
    all: HashSet<String>,
}

impl HelperTracker {
    fn new(imports: &[&ImportDeclaration], by_source: &[(&str, &[&str])]) -> HelperTracker {
        let mut tracker = ImportTracker::default();
        let mut all = HashSet::new();
        for (source, helpers) in by_source {
            all.extend(helpers.iter().map(|name| name.to_string()));
            for declaration in imports {
                tracker.collect(declaration, source, |name| {
                    helpers.contains(&name).then(|| name.to_string())
                });
            }
        }
        HelperTracker {
            locals: tracker.locals,
            namespaces: tracker.namespaces,
            all,
        }
    }

    fn called(&self, callee: &Expression) -> Option<String> {
        if let Some(name) = identifier_name(callee) {
            return self.locals.get(name).cloned();
        }
        namespace_callee_name(callee, &self.namespaces)
            .filter(|name| self.all.contains(*name))
            .map(String::from)
    }
}

struct FactoryTracker {
    locals: HashMap<String, String>,
    namespaces: HashSet<String>,
}

impl FactoryTracker {
    fn new(imports: &[&ImportDeclaration]) -> FactoryTracker {
        let mut tracker = ImportTracker::default();
        let mut sources = vec!["imp/html"];
        sources.extend(std_specifiers());
        for source in sources {
            for declaration in imports {
                tracker.collect(declaration, source, classify_factory);
            }
        }
        FactoryTracker {
            locals: tracker.locals,
            namespaces: tracker.namespaces,
        }
    }

    fn kind(&self, callee: &Expression) -> Option<String> {
        if let Some(name) = identifier_name(callee) {
            return self.locals.get(name).cloned();
        }
        namespace_callee_name(callee, &self.namespaces).and_then(classify_factory)
    }

    fn name<'e>(&self, callee: &'e Expression) -> &'e str {
        match callee.without_parentheses() {
            Expression::Identifier(identifier) => identifier.name.as_str(),
            Expression::StaticMemberExpression(member) => member.property.name.as_str(),
            _ => "",
        }
    }

    fn child_arguments<'c, 'a>(
        &self,
        call: &'c CallExpression<'a>,
    ) -> Option<Vec<&'c Argument<'a>>> {
        let kind = self.kind(&call.callee)?;
        Some(
            call.arguments
                .iter()
                .skip(if kind == "el" { 1 } else { 0 })
                .collect(),
        )
    }
}

struct HandleTracker {
    creators: HelperTracker,
    names: HashSet<String>,
}

impl HandleTracker {
    fn new(ctx: &Ctx, imports: &[&ImportDeclaration]) -> HandleTracker {
        HandleTracker::from_creators(
            ctx,
            imports,
            &[
                ("imp/state", &["initState", "useState", "computed"]),
                ("imp/router", &["useRoute"]),
            ],
        )
    }

    fn http_clients(ctx: &Ctx, imports: &[&ImportDeclaration]) -> HandleTracker {
        HandleTracker::from_creators(
            ctx,
            imports,
            &[("imp/http", &["initHttpClient", "useHttpClient"])],
        )
    }

    fn from_creators(
        ctx: &Ctx,
        imports: &[&ImportDeclaration],
        by_source: &[(&str, &[&str])],
    ) -> HandleTracker {
        let creators = HelperTracker::new(imports, by_source);
        let mut names = HashSet::new();
        for declaration in imports {
            let readables: &[&str] = match import_source(declaration) {
                "imp/i18n" => &["lang", "dir"],
                "imp/theme" => &["theme"],
                _ => &[],
            };
            for specifier in declaration.specifiers.iter().flatten() {
                if let ImportDeclarationSpecifier::ImportSpecifier(specifier) = specifier
                    && readables.contains(&imported_name(specifier).as_str())
                {
                    names.insert(specifier.local.name.to_string());
                }
            }
        }
        let is_handle_call = |expression: &Expression| match expression.without_parentheses() {
            Expression::CallExpression(call) => creators.called(&call.callee).is_some(),
            _ => false,
        };
        for node in ctx.nodes() {
            match node.kind() {
                AstKind::VariableDeclarator(declarator) => {
                    if let (BindingPattern::BindingIdentifier(id), Some(init)) =
                        (&declarator.id, &declarator.init)
                        && is_handle_call(init)
                    {
                        names.insert(id.name.to_string());
                    }
                }
                AstKind::AssignmentExpression(assignment) => {
                    if assignment.operator == AssignmentOperator::Assign
                        && let AssignmentTarget::AssignmentTargetIdentifier(id) = &assignment.left
                        && is_handle_call(&assignment.right)
                    {
                        names.insert(id.name.to_string());
                    }
                }
                _ => {}
            }
        }
        HandleTracker { creators, names }
    }

    fn handle_text(&self, expression: &Expression) -> Option<String> {
        if let Some(name) = identifier_name(expression)
            && self.names.contains(name)
        {
            return Some(name.to_string());
        }
        if let Expression::CallExpression(call) = expression.without_parentheses() {
            return self
                .creators
                .called(&call.callee)
                .map(|creator| format!("{creator}()"));
        }
        None
    }

    fn method_call(&self, callee: &Expression, methods: &[&str]) -> Option<(String, String)> {
        let Expression::StaticMemberExpression(member) = callee.without_parentheses() else {
            return None;
        };
        if !methods.contains(&member.property.name.as_str()) {
            return None;
        }
        self.handle_text(&member.object)
            .map(|handle| (handle, member.property.name.to_string()))
    }
}

struct Definitions {
    locals: HashSet<String>,
    namespaces: HashSet<String>,
}

impl Definitions {
    fn new(imports: &[&ImportDeclaration]) -> Definitions {
        let mut tracker = ImportTracker::default();
        for declaration in imports {
            tracker.collect(declaration, "imp", |name| {
                (name == "component").then(|| name.to_string())
            });
            tracker.collect(declaration, "imp/router", |name| {
                (name == "router").then(|| name.to_string())
            });
        }
        Definitions {
            locals: tracker.locals.into_keys().collect(),
            namespaces: tracker.namespaces,
        }
    }

    fn is_definition_callee(&self, callee: &Expression) -> bool {
        if let Some(name) = identifier_name(callee) {
            return self.locals.contains(name);
        }
        namespace_callee_name(callee, &self.namespaces)
            .is_some_and(|name| name == "component" || name == "router")
    }

    fn hook_property<'a>(
        &self,
        ctx: &Ctx<'_, 'a>,
        function_id: oxc::semantic::NodeId,
        span: Span,
        hooks: &[&str],
    ) -> Option<(&'a ObjectProperty<'a>, &'a ObjectExpression<'a>)> {
        let AstKind::ObjectProperty(property) = ctx.parent(function_id) else {
            return None;
        };
        if property.value.span() != span {
            return None;
        }
        let key = property_key_name(property)?;
        if !hooks.contains(&key.as_str()) {
            return None;
        }
        let AstKind::ObjectExpression(definition) = ctx.parent(property.node_id()) else {
            return None;
        };
        let AstKind::CallExpression(call) = ctx.parent(definition.node_id()) else {
            return None;
        };
        let is_argument = call
            .arguments
            .iter()
            .any(|argument| argument.span() == definition.span);
        (is_argument && self.is_definition_callee(&call.callee)).then_some((property, definition))
    }
}

#[derive(Clone, Copy)]
struct FunctionInfo<'a> {
    id: oxc::semantic::NodeId,
    span: Span,
    params: &'a FormalParameters<'a>,
    is_async: bool,
}

fn function_info<'a>(kind: AstKind<'a>, id: oxc::semantic::NodeId) -> Option<FunctionInfo<'a>> {
    match kind {
        AstKind::Function(function) => Some(FunctionInfo {
            id,
            span: function.span,
            params: &function.params,
            is_async: function.r#async,
        }),
        AstKind::ArrowFunctionExpression(arrow) => Some(FunctionInfo {
            id,
            span: arrow.span,
            params: &arrow.params,
            is_async: arrow.r#async,
        }),
        _ => None,
    }
}

struct Frames<T> {
    stack: Vec<(Span, Option<T>)>,
}

impl<T: Clone> Frames<T> {
    fn new() -> Frames<T> {
        Frames { stack: Vec::new() }
    }

    fn leave_before(&mut self, start: u32, mut on_exit: impl FnMut(Option<T>)) {
        while let Some((span, _)) = self.stack.last() {
            if start >= span.end {
                let (_, frame) = self.stack.pop().unwrap();
                on_exit(frame);
            } else {
                break;
            }
        }
    }

    fn current(&self) -> Option<&T> {
        self.stack.last().and_then(|(_, frame)| frame.as_ref())
    }

    fn current_mut(&mut self) -> Option<&mut T> {
        self.stack.last_mut().and_then(|(_, frame)| frame.as_mut())
    }

    fn push(&mut self, span: Span, frame: Option<T>) {
        self.stack.push((span, frame));
    }

    fn inherited(&self) -> Option<T> {
        self.current().cloned()
    }
}

fn self_name_of(params: &FormalParameters) -> String {
    first_param_name(params).unwrap_or_else(|| SELF_NAME.into())
}

fn is_self_argument(argument: Option<&Argument>, self_name: &str) -> bool {
    argument
        .and_then(Argument::as_expression)
        .and_then(identifier_name)
        .is_some_and(|name| name == self_name || name == SELF_NAME)
}

fn is_watch_callee(callee: &Expression) -> bool {
    matches!(callee.without_parentheses(), Expression::StaticMemberExpression(member) if member.property.name == "watch")
}

fn describe_literal(value: &LiteralValue) -> Option<String> {
    match value {
        LiteralValue::Str(text) => Some(text.clone()),
        _ => None,
    }
}

struct NameRule {
    rule: &'static str,
    source: &'static str,
    helpers: &'static [(&'static str, usize)],
    problem: fn(&str) -> Option<String>,
    label: &'static str,
    example: &'static str,
}

fn name_rule(ctx: &Ctx, imports: &[&ImportDeclaration], name_rule: &NameRule) {
    let NameRule {
        rule,
        source,
        helpers,
        problem,
        label,
        example,
    } = *name_rule;
    let names: Vec<&str> = helpers.iter().map(|(name, _)| *name).collect();
    let tracker = HelperTracker::new(imports, &[(source, &names)]);
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some(helper) = tracker.called(&call.callee) else {
            continue;
        };
        let index = helpers
            .iter()
            .find(|(name, _)| *name == helper)
            .map(|(_, index)| *index)
            .unwrap_or(0);
        let argument = call.arguments.get(index);
        let Some(value) = literal_argument(argument) else {
            continue;
        };
        let message = match &value {
            LiteralValue::Str(name) => problem(name),
            _ => Some(format!(
                "{label} must be a namespaced string like '{example}'"
            )),
        };
        if let Some(message) = message {
            ctx.report(
                rule,
                argument.map(GetSpan::span).unwrap_or(call.span),
                message,
            );
        }
    }
}

fn component_name_rule(ctx: &Ctx, imports: &[&ImportDeclaration]) {
    let tracker = HelperTracker::new(imports, &[("imp", &["component"])]);
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        if tracker.called(&call.callee).is_none() {
            continue;
        }
        let argument = call.arguments.first();
        let Some(value) = literal_argument(argument) else {
            continue;
        };
        let message = match &value {
            LiteralValue::Str(name) => component_name_problem(name),
            _ => {
                Some("component name must be a dash-separated string like 'my-app-profile'".into())
            }
        };
        if let Some(message) = message {
            ctx.report(
                "component-name",
                argument.map(GetSpan::span).unwrap_or(call.span),
                message,
            );
        }
    }
}

pub struct AnalyticsUse<'a> {
    pub helper: String,
    pub name: Option<String>,
    pub literal: bool,
    pub span: Span,
    pub _node: std::marker::PhantomData<&'a ()>,
}

pub fn analytics_uses<'a>(ctx: &Ctx<'_, 'a>) -> Vec<AnalyticsUse<'a>> {
    let imports = program_imports(ctx);
    let tracker = HelperTracker::new(&imports, &[("imp/analytics", &["zone", "track"])]);
    let mut uses = Vec::new();
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some(helper) = tracker.called(&call.callee) else {
            continue;
        };
        let first = call.arguments.first();
        let found: Option<(Option<&Argument>, Option<Span>)> =
            if helper == "track" {
                Some((first, first.map(GetSpan::span)))
            } else {
                match first
                    .and_then(Argument::as_expression)
                    .map(Expression::without_parentheses)
                {
                    Some(Expression::ObjectExpression(object)) => {
                        if object.properties.iter().any(|property| {
                            matches!(property, ObjectPropertyKind::SpreadProperty(_))
                        }) {
                            None
                        } else {
                            let property =
                                object
                                    .properties
                                    .iter()
                                    .find_map(|property| match property {
                                        ObjectPropertyKind::ObjectProperty(property)
                                            if property_key_name(property).as_deref()
                                                == Some("name") =>
                                        {
                                            Some(property)
                                        }
                                        _ => None,
                                    });
                            match property {
                                Some(property) => {
                                    let literal = literal_expression(&property.value);
                                    uses.push(AnalyticsUse {
                                        helper: helper.clone(),
                                        name: literal.as_ref().and_then(describe_literal),
                                        literal: literal.is_some(),
                                        span: property.value.span(),
                                        _node: Default::default(),
                                    });
                                    continue;
                                }
                                None => Some((None, None)),
                            }
                        }
                    }
                    _ => None,
                }
            };
        match found {
            None => uses.push(AnalyticsUse {
                helper,
                name: None,
                literal: false,
                span: call.span,
                _node: Default::default(),
            }),
            Some((argument, span)) => {
                let literal = literal_argument(argument);
                uses.push(AnalyticsUse {
                    helper,
                    name: literal.as_ref().and_then(describe_literal),
                    literal: literal.is_some(),
                    span: span.unwrap_or(call.span),
                    _node: Default::default(),
                });
            }
        }
    }
    uses
}

pub fn unreadable_analytics_name_problem(helper: &str) -> String {
    let (subject, example) = analytics_subject(helper).unwrap_or(("zone", "myapp.invoice-summary"));
    let call = if helper == "zone" {
        format!("zone({{ name: '{example}' }})")
    } else {
        format!("track('{example}')")
    };
    format!(
        "{subject} name is not a literal - imp build lists every {subject} name for the analytics store, so write the name as a string, like {call}"
    )
}

fn analytics_rule(ctx: &Ctx) {
    for usage in analytics_uses(ctx) {
        let problem = if usage.literal {
            match &usage.name {
                Some(name) => analytics_name_problem_of(&usage.helper, name),
                None => {
                    let (subject, example) = analytics_subject(&usage.helper).unwrap();
                    Some(format!(
                        "{subject} name must be a namespaced string like '{example}'"
                    ))
                }
            }
        } else {
            Some(unreadable_analytics_name_problem(&usage.helper))
        };
        if let Some(problem) = problem {
            ctx.report("analytics-name-namespace", usage.span, problem);
        }
    }
}

fn no_capital_component(ctx: &Ctx) {
    let report = |span: Span, name: &str| {
        if name
            .chars()
            .next()
            .is_some_and(|char| char.is_ascii_uppercase())
        {
            let mut chars = name.chars();
            let first = chars.next().unwrap().to_ascii_lowercase();
            ctx.report(
                "no-capital-component",
                span,
                format!("'{name}' starts with a capital letter - imp components are lowercase functions (write '{first}{}')", chars.as_str()),
            );
        }
    };
    for node in ctx.nodes() {
        match node.kind() {
            AstKind::Function(function) if function.r#type == FunctionType::FunctionDeclaration => {
                if let Some(id) = &function.id {
                    report(id.span, &id.name);
                }
            }
            AstKind::VariableDeclarator(declarator) => {
                if let (BindingPattern::BindingIdentifier(id), Some(init)) =
                    (&declarator.id, &declarator.init)
                    && matches!(
                        init.without_parentheses(),
                        Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)
                    )
                {
                    report(id.span, &id.name);
                }
            }
            _ => {}
        }
    }
}

fn single_props_object(ctx: &Ctx, factories: &FactoryTracker) {
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some(children) = factories.child_arguments(call) else {
            continue;
        };
        let objects: Vec<&Argument> = children
            .into_iter()
            .filter(|argument| matches!(argument, Argument::ObjectExpression(_)))
            .collect();
        if objects.len() < 2 {
            continue;
        }
        ctx.report(
            "single-props-object",
            objects[1].span(),
            format!("multiple props objects passed to '{}' - pass a single props object; later keys win", factories.name(&call.callee)),
        );
    }
}

const HTTP_VERBS: &[&str] = &["get", "post", "put", "patch", "delete", "head", "request"];

const RESOLUTION: &[(&str, &[&str])] = &[
    ("imp/state", &["initState", "useState"]),
    ("imp/http", &["initHttpClient", "useHttpClient"]),
];

fn resolution_example(helper: &str) -> &'static str {
    match helper {
        "initState" => "initState(self, 'myapp.user', value)",
        "useState" => "useState(self, 'myapp.user')",
        "initHttpClient" => "initHttpClient(self, 'myapp.api', { baseUrl })",
        _ => "useHttpClient(self, 'myapp.api')",
    }
}

fn resolution_kind(helper: &str) -> &'static str {
    if helper.ends_with("State") {
        "state"
    } else {
        "http client"
    }
}

fn self_first_argument(ctx: &Ctx, imports: &[&ImportDeclaration]) {
    let helpers = HelperTracker::new(imports, RESOLUTION);
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some(helper) = helpers.called(&call.callee) else {
            continue;
        };
        let first = call.arguments.first();
        let given = match first {
            None => "missing",
            Some(argument) => match argument
                .as_expression()
                .map(Expression::without_parentheses)
            {
                Some(
                    Expression::StringLiteral(_)
                    | Expression::NumericLiteral(_)
                    | Expression::BooleanLiteral(_)
                    | Expression::NullLiteral(_)
                    | Expression::BigIntLiteral(_)
                    | Expression::RegExpLiteral(_),
                ) => "a literal",
                Some(Expression::TemplateLiteral(_)) => "a template",
                Some(Expression::ObjectExpression(_)) => "an object",
                Some(Expression::ArrayExpression(_)) => "an array",
                Some(
                    Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_),
                ) => "a function",
                _ => continue,
            },
        };
        ctx.report(
            "self-first-argument",
            first.map(GetSpan::span).unwrap_or(call.span),
            format!(
                "'{helper}' takes self as its first argument, and here that argument is {given} - write {}; self is the first parameter of setup, error, onMount and onRemove",
                resolution_example(&helper)
            ),
        );
    }
}

fn watch_with_self(ctx: &Ctx, definitions: &Definitions, handles: &HandleTracker) {
    let mut frames: Frames<String> = Frames::new();
    for node in ctx.nodes() {
        let span = node.kind().span();
        frames.leave_before(span.start, |_| {});
        if let Some(info) = function_info(node.kind(), node.id()) {
            let frame = if definitions
                .hook_property(ctx, info.id, info.span, &["setup", "error", "onMount"])
                .is_some()
            {
                Some(self_name_of(info.params))
            } else {
                frames.inherited()
            };
            frames.push(info.span, frame);
            continue;
        }
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some(self_name) = frames.current() else {
            continue;
        };
        if !matches!(ctx.parent(node.id()), AstKind::ExpressionStatement(_)) {
            continue;
        }
        let Some((handle, _)) = handles.method_call(&call.callee, &["watch"]) else {
            continue;
        };
        if is_self_argument(call.arguments.first(), self_name) {
            continue;
        }
        ctx.report(
            "watch-with-self",
            call.span,
            format!(
                "'{handle}.watch' runs in a component without self, so nothing stops it when the component unmounts and the subscriber keeps running - pass self first ({handle}.watch(self, fn)), or keep the stop that watch(fn) returns and call it in onRemove"
            ),
        );
    }
}

fn no_self_in_loading(
    ctx: &Ctx,
    imports: &[&ImportDeclaration],
    definitions: &Definitions,
    handles: &HandleTracker,
) {
    let helpers = HelperTracker::new(
        imports,
        &[
            ("imp/state", &["initState", "useState"]),
            ("imp/http", &["initHttpClient", "useHttpClient"]),
            ("imp/router", &["useRoute"]),
        ],
    );
    let mut frames: Frames<bool> = Frames::new();
    for node in ctx.nodes() {
        let span = node.kind().span();
        frames.leave_before(span.start, |_| {});
        if let Some(info) = function_info(node.kind(), node.id()) {
            let frame = if definitions
                .hook_property(ctx, info.id, info.span, &["loading"])
                .is_some()
            {
                Some(true)
            } else {
                frames.inherited()
            };
            frames.push(info.span, frame);
            continue;
        }
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        if frames.current().is_none() {
            continue;
        }
        if let Some(helper) = helpers.called(&call.callee) {
            ctx.report(
                "no-self-in-loading",
                call.span,
                format!("'{helper}' runs in loading, which imp builds before the component mounts and without self, so the call throws - loading takes the factory arguments only; move the call into setup"),
            );
            continue;
        }
        let bound = handles
            .method_call(&call.callee, &["text", "view", "each", "watch"])
            .map(|(handle, method)| format!("{handle}.{method}"))
            .or_else(|| {
                call.arguments.iter().find_map(|argument| match argument {
                    Argument::ObjectExpression(object) => {
                        object
                            .properties
                            .iter()
                            .find_map(|property| match property {
                                ObjectPropertyKind::ObjectProperty(property) => {
                                    handles.handle_text(&property.value)
                                }
                                _ => None,
                            })
                    }
                    other => other
                        .as_expression()
                        .and_then(|expression| handles.handle_text(expression)),
                })
            });
        if let Some(subject) = bound {
            ctx.report(
                "no-self-in-loading",
                call.span,
                format!("'{subject}' binds state in loading, which imp builds before the component mounts, so the binding renders empty and never updates - pass a plain value here, and keep text, view, each, watch and a state-bound prop in setup"),
            );
        }
    }
}

fn returns_plain_dom(
    expression: Option<&Expression>,
    factories: &FactoryTracker,
    handles: &HandleTracker,
) -> bool {
    let Some(expression) = expression else {
        return true;
    };
    match expression.without_parentheses() {
        Expression::StringLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_)
        | Expression::BigIntLiteral(_)
        | Expression::RegExpLiteral(_)
        | Expression::TemplateLiteral(_) => true,
        Expression::ArrayExpression(array) => array.elements.iter().all(|element| match element {
            ArrayExpressionElement::SpreadElement(_) | ArrayExpressionElement::Elision(_) => false,
            other => returns_plain_dom(other.as_expression(), factories, handles),
        }),
        Expression::ConditionalExpression(conditional) => {
            returns_plain_dom(Some(&conditional.consequent), factories, handles)
                && returns_plain_dom(Some(&conditional.alternate), factories, handles)
        }
        Expression::CallExpression(call) => {
            factories.kind(&call.callee).is_some()
                || handles
                    .method_call(&call.callee, &["text", "view", "each", "watch"])
                    .is_some()
        }
        _ => false,
    }
}

fn loading_with_async_setup(
    ctx: &Ctx,
    definitions: &Definitions,
    factories: &FactoryTracker,
    handles: &HandleTracker,
) {
    struct Build<'a> {
        info: FunctionInfo<'a>,
        definition: &'a ObjectExpression<'a>,
        returns: Vec<Option<&'a Expression<'a>>>,
        body: Option<&'a Expression<'a>>,
    }
    let mut stack: Vec<(Span, Option<usize>)> = Vec::new();
    let mut builds: Vec<Build> = Vec::new();
    for node in ctx.nodes() {
        let span = node.kind().span();
        while stack
            .last()
            .is_some_and(|(frame, _)| span.start >= frame.end)
        {
            stack.pop();
        }
        if let Some(info) = function_info(node.kind(), node.id()) {
            let frame = definitions
                .hook_property(ctx, info.id, info.span, &["setup"])
                .map(|(_, definition)| {
                    let body = match node.kind() {
                        AstKind::ArrowFunctionExpression(arrow) => match &arrow.body {
                            ArrowFunctionBody::FunctionBody(_) => None,
                            body => body.as_expression(),
                        },
                        _ => None,
                    };
                    builds.push(Build {
                        info,
                        definition,
                        returns: Vec::new(),
                        body,
                    });
                    builds.len() - 1
                });
            stack.push((info.span, frame));
            continue;
        }
        if let AstKind::ReturnStatement(statement) = node.kind()
            && let Some((_, Some(index))) = stack.last()
        {
            builds[*index].returns.push(statement.argument.as_ref());
        }
    }
    for build in builds {
        if build.info.is_async {
            continue;
        }
        let loading = build
            .definition
            .properties
            .iter()
            .find_map(|property| match property {
                ObjectPropertyKind::ObjectProperty(property)
                    if property_key_name(property).as_deref() == Some("loading") =>
                {
                    Some(property)
                }
                _ => None,
            });
        let Some(loading) = loading else { continue };
        let returned: Vec<Option<&Expression>> = match build.body {
            Some(body) => vec![Some(body)],
            None => build.returns.clone(),
        };
        if !returned
            .iter()
            .all(|expression| returns_plain_dom(*expression, factories, handles))
        {
            continue;
        }
        ctx.report(
            "loading-with-async-setup",
            loading.key.span(),
            "loading is set, but setup returns synchronously, so imp swaps the loading content out before paint and nobody sees it - make setup async, or return a promise from it, or remove loading",
        );
    }
}

fn on_remove_through_self(ctx: &Ctx, imports: &[&ImportDeclaration], definitions: &Definitions) {
    #[derive(Clone)]
    struct Frame {
        hook: String,
        definition: Span,
        self_name: String,
    }
    #[derive(Default)]
    struct Resolved {
        names: HashSet<String>,
        open: bool,
    }
    struct Removal {
        span: Span,
        callee: Span,
        helper: String,
        literal: Option<LiteralValue>,
        argument: Option<Span>,
        definition: Span,
    }
    let helpers = HelperTracker::new(imports, RESOLUTION);
    let mut frames: Frames<Frame> = Frames::new();
    let mut resolved: HashMap<Span, Resolved> = HashMap::new();
    let mut closed: HashMap<Span, bool> = HashMap::new();
    let mut removals: Vec<Removal> = Vec::new();
    for node in ctx.nodes() {
        let kind = node.kind();
        let span = kind.span();
        frames.leave_before(span.start, |_| {});
        if let Some(info) = function_info(kind, node.id()) {
            let frame = match definitions.hook_property(
                ctx,
                info.id,
                info.span,
                &["setup", "error", "onMount", "onRemove"],
            ) {
                Some((property, definition)) => {
                    let is_closed =
                        definition.properties.iter().all(|property| {
                            matches!(property, ObjectPropertyKind::ObjectProperty(_))
                        }) && definition.properties.iter().any(|property| match property {
                            ObjectPropertyKind::ObjectProperty(property) => {
                                property_key_name(property).as_deref() == Some("setup")
                                    && matches!(
                                        property.value,
                                        Expression::ArrowFunctionExpression(_)
                                            | Expression::FunctionExpression(_)
                                    )
                            }
                            _ => false,
                        });
                    closed.insert(definition.span, is_closed);
                    Some(Frame {
                        hook: property_key_name(property).unwrap_or_default(),
                        definition: definition.span,
                        self_name: self_name_of(info.params),
                    })
                }
                None => frames.inherited(),
            };
            frames.push(info.span, frame);
            continue;
        }
        let Some(frame) = frames.current().cloned() else {
            continue;
        };
        let resolving = frame.hook == "setup" || frame.hook == "error";
        match kind {
            AstKind::IdentifierReference(identifier)
                if resolving && identifier.name == frame.self_name.as_str() =>
            {
                let parent = ctx.parent(node.id());
                let stays = match parent {
                    AstKind::StaticMemberExpression(_)
                    | AstKind::ComputedMemberExpression(_)
                    | AstKind::PrivateFieldExpression(_) => true,
                    AstKind::ObjectProperty(property) => {
                        property.key.span() == identifier.span && !property.shorthand
                    }
                    AstKind::ArrowFunctionExpression(_) | AstKind::Function(_) => true,
                    AstKind::CallExpression(call) => {
                        call.arguments
                            .first()
                            .is_some_and(|argument| argument.span() == identifier.span)
                            && (helpers.called(&call.callee).is_some()
                                || is_watch_callee(&call.callee))
                    }
                    _ => false,
                };
                if !stays {
                    resolved.entry(frame.definition).or_default().open = true;
                }
            }
            AstKind::CallExpression(call) => {
                if let Some(helper) = helpers
                    .called(&call.callee)
                    .filter(|_| is_self_argument(call.arguments.first(), &frame.self_name))
                {
                    let literal = literal_argument(call.arguments.get(1));
                    if resolving {
                        let entry = resolved.entry(frame.definition).or_default();
                        match &literal {
                            Some(LiteralValue::Str(name)) => {
                                entry
                                    .names
                                    .insert(format!("{}:{name}", resolution_kind(&helper)));
                            }
                            Some(LiteralValue::Other(name)) => {
                                entry
                                    .names
                                    .insert(format!("{}:{name}", resolution_kind(&helper)));
                            }
                            _ => entry.open = true,
                        }
                    } else if frame.hook == "onRemove" {
                        removals.push(Removal {
                            span: call.span,
                            callee: call.callee.span(),
                            helper,
                            literal,
                            argument: call.arguments.get(1).map(GetSpan::span),
                            definition: frame.definition,
                        });
                    }
                    continue;
                }
                if frame.hook == "onRemove"
                    && is_watch_callee(&call.callee)
                    && is_self_argument(call.arguments.first(), &frame.self_name)
                {
                    removals.push(Removal {
                        span: call.span,
                        callee: call.callee.span(),
                        helper: "watch".into(),
                        literal: None,
                        argument: None,
                        definition: frame.definition,
                    });
                }
            }
            _ => {}
        }
    }
    for removal in removals {
        if removal.helper == "watch" {
            ctx.report(
                "on-remove-through-self",
                removal.span,
                format!("'{}(self, fn)' runs in onRemove, after the host has left the page, so nothing owns the subscription and the call throws - watch in setup, or hold the stop that watch(fn) returns", ctx.text(removal.callee)),
            );
            continue;
        }
        let kind = resolution_kind(&removal.helper);
        if removal.helper == "initState" || removal.helper == "initHttpClient" {
            ctx.report(
                "on-remove-through-self",
                removal.span,
                format!(
                    "'{}' runs in onRemove, after the host has left the page, so the call throws - initialize the {kind} in setup, and reach it here with {}(self, name)",
                    removal.helper,
                    if removal.helper == "initState" { "useState" } else { "useHttpClient" }
                ),
            );
            continue;
        }
        let name = match &removal.literal {
            Some(LiteralValue::Str(name)) | Some(LiteralValue::Other(name)) => name.clone(),
            _ => continue,
        };
        let entry = resolved.entry(removal.definition).or_default();
        if !closed.get(&removal.definition).copied().unwrap_or(false)
            || entry.open
            || entry.names.contains(&format!("{kind}:{name}"))
        {
            continue;
        }
        ctx.report(
            "on-remove-through-self",
            removal.argument.unwrap_or(removal.span),
            format!(
                "'{}' in onRemove reaches {kind} '{name}', which setup never resolved - in onRemove, {} returns only a handle that setup resolved through self, and a new name throws because the host has left the page; resolve '{name}' in setup, then reach it again here",
                removal.helper, removal.helper
            ),
        );
    }
}

fn no_self_at_module_scope(ctx: &Ctx, imports: &[&ImportDeclaration], definitions: &Definitions) {
    let helpers = HelperTracker::new(imports, RESOLUTION);
    let mut frames: Frames<String> = Frames::new();
    let scoping = ctx.semantic.scoping();
    for node in ctx.nodes() {
        let kind = node.kind();
        frames.leave_before(kind.span().start, |_| {});
        if let Some(info) = function_info(kind, node.id()) {
            let frame = if definitions
                .hook_property(
                    ctx,
                    info.id,
                    info.span,
                    &["setup", "error", "onMount", "onRemove"],
                )
                .is_some()
            {
                Some(self_name_of(info.params))
            } else {
                frames.inherited()
            };
            frames.push(info.span, frame);
            continue;
        }
        let AstKind::AssignmentExpression(assignment) = kind else {
            continue;
        };
        let Some(self_name) = frames.current() else {
            continue;
        };
        let carries = match assignment.right.without_parentheses() {
            right @ (Expression::Identifier(_)
            | Expression::StaticMemberExpression(_)
            | Expression::ComputedMemberExpression(_)) => {
                root_identifier(right).is_some_and(|root| root.name == self_name.as_str())
            }
            Expression::CallExpression(call) => {
                helpers.called(&call.callee).is_some()
                    && is_self_argument(call.arguments.first(), self_name)
            }
            _ => false,
        };
        if !carries {
            continue;
        }
        let target = match &assignment.left {
            AssignmentTarget::AssignmentTargetIdentifier(identifier) => Some(&**identifier),
            AssignmentTarget::StaticMemberExpression(member) => root_identifier(&member.object),
            AssignmentTarget::ComputedMemberExpression(member) => root_identifier(&member.object),
            _ => None,
        };
        let Some(target) = target else { continue };
        if target.name == self_name.as_str() {
            continue;
        }
        let module_scoped = match target
            .reference_id
            .get()
            .and_then(|reference| scoping.get_reference(reference).symbol_id())
        {
            Some(symbol) => {
                let scope = scoping.symbol_scope_id(symbol);
                scope == scoping.root_scope_id()
            }
            None => true,
        };
        if !module_scoped {
            continue;
        }
        let left_text = ctx.text(assignment.left.span());
        let field = match &assignment.left {
            AssignmentTarget::AssignmentTargetIdentifier(identifier) => identifier.name.to_string(),
            _ => "field".into(),
        };
        ctx.report(
            "no-self-at-module-scope",
            assignment.span,
            format!(
                "'{left_text}' at module scope stores what belongs to one mount - the module outlives every mount, so the next mount overwrites the value and an unmounted component stays reachable; store a per-mount resource on self instead (self.{field} = ...)"
            ),
        );
    }
}

fn abort_check_after_await(ctx: &Ctx, imports: &[&ImportDeclaration], definitions: &Definitions) {
    #[derive(Clone)]
    struct Frame {
        self_name: String,
        awaited: bool,
        checked: bool,
        await_ends: Vec<u32>,
        signal_in_await: bool,
    }
    let helpers = HelperTracker::new(imports, RESOLUTION);
    let clients = HandleTracker::http_clients(ctx, imports);
    let mut frames: Frames<Frame> = Frames::new();
    for node in ctx.nodes() {
        let kind = node.kind();
        let start = kind.span().start;
        frames.leave_before(start, |_| {});
        if let Some(frame) = frames.current_mut() {
            while frame.await_ends.last().is_some_and(|end| start >= *end) {
                frame.await_ends.pop();
                if frame.await_ends.is_empty() {
                    frame.awaited = true;
                    frame.checked = frame.signal_in_await;
                }
            }
        }
        if let Some(info) = function_info(kind, node.id()) {
            let frame = (info.is_async
                && definitions
                    .hook_property(ctx, info.id, info.span, &["setup"])
                    .is_some())
            .then(|| Frame {
                self_name: self_name_of(info.params),
                awaited: false,
                checked: false,
                await_ends: Vec::new(),
                signal_in_await: false,
            });
            frames.push(info.span, frame);
            continue;
        }
        let Some(frame) = frames.current_mut() else {
            continue;
        };
        match kind {
            AstKind::AwaitExpression(expression) => {
                if frame.await_ends.is_empty() {
                    frame.signal_in_await = false;
                }
                frame.await_ends.push(expression.span.end);
            }
            AstKind::StaticMemberExpression(member) => {
                let is_signal = member.property.name == "abortSignal"
                    && identifier_name(&member.object) == Some(frame.self_name.as_str());
                if is_signal {
                    if frame.await_ends.is_empty() {
                        frame.checked = true;
                    } else {
                        frame.signal_in_await = true;
                    }
                }
            }
            AstKind::CallExpression(call) => {
                if !frame.await_ends.is_empty()
                    && clients.method_call(&call.callee, HTTP_VERBS).is_some()
                {
                    frame.signal_in_await = true;
                    continue;
                }
                if !frame.awaited || frame.checked {
                    continue;
                }
                let Some(helper) = helpers.called(&call.callee) else {
                    continue;
                };
                if !is_self_argument(call.arguments.first(), &frame.self_name) {
                    continue;
                }
                ctx.report(
                    "abort-check-after-await",
                    call.span,
                    format!("'{helper}' runs after an await in an async setup with no check of self.abortSignal - the component can leave the page while setup waits, and a resolution after that throws; await an http call of the component, which an unmount cancels, test self.abortSignal.aborted after the await and return, or resolve before the first await"),
                );
            }
            _ => {}
        }
    }
}

fn no_state_as_child(ctx: &Ctx, factories: &FactoryTracker, handles: &HandleTracker) {
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some(children) = factories.child_arguments(call) else {
            continue;
        };
        for child in children {
            let Some(handle) = child
                .as_expression()
                .and_then(|expression| handles.handle_text(expression))
            else {
                continue;
            };
            ctx.report(
                "no-state-as-child",
                child.span(),
                format!(
                    "'{handle}' is a state passed as a child of '{}', and imp skips it - render it with {handle}.text(), {handle}.view(fn) or {handle}.each(fn), or bind a prop with {{ class: {handle} }}",
                    factories.name(&call.callee)
                ),
            );
        }
    }
}

fn no_get_in_binding(ctx: &Ctx, factories: &FactoryTracker, handles: &HandleTracker) {
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some(children) = factories.child_arguments(call) else {
            continue;
        };
        for argument in children {
            let Argument::ObjectExpression(object) = argument else {
                continue;
            };
            for property in &object.properties {
                let ObjectPropertyKind::ObjectProperty(property) = property else {
                    continue;
                };
                let Expression::CallExpression(value) = property.value.without_parentheses() else {
                    continue;
                };
                if !value.arguments.is_empty() {
                    continue;
                }
                let Some((handle, _)) = handles.method_call(&value.callee, &["get"]) else {
                    continue;
                };
                let key = property_key_name(property).unwrap_or_else(|| "prop".into());
                ctx.report(
                    "no-get-in-binding",
                    value.span,
                    format!(
                        "'{handle}.get()' as the '{key}' prop of '{}' copies the value once, and the prop never follows the state - pass the state itself: {{ {key}: {handle} }}",
                        factories.name(&call.callee)
                    ),
                );
            }
        }
    }
}

fn no_root_query_in_setup(ctx: &Ctx, definitions: &Definitions) {
    #[derive(Clone)]
    enum Spec {
        SelfName(String),
        Host(String),
    }
    let mut frames: Frames<Spec> = Frames::new();
    for node in ctx.nodes() {
        let kind = node.kind();
        frames.leave_before(kind.span().start, |_| {});
        let is_function_expression = matches!(kind, AstKind::Function(function) if function.r#type == FunctionType::FunctionExpression)
            || matches!(kind, AstKind::ArrowFunctionExpression(_));
        if is_function_expression {
            let info = function_info(kind, node.id()).unwrap();
            let spec = if definitions
                .hook_property(ctx, info.id, info.span, &["setup"])
                .is_some()
            {
                match info.params.items.first().map(|param| &param.pattern) {
                    Some(BindingPattern::BindingIdentifier(identifier)) => {
                        Some(Spec::SelfName(identifier.name.to_string()))
                    }
                    Some(BindingPattern::ObjectPattern(object)) => {
                        object.properties.iter().find_map(|property| {
                            let key = match &property.key {
                                PropertyKey::StaticIdentifier(identifier) if !property.computed => {
                                    identifier.name.as_str()
                                }
                                _ => return None,
                            };
                            match (&property.value, key) {
                                (BindingPattern::BindingIdentifier(value), "host") => {
                                    Some(Spec::Host(value.name.to_string()))
                                }
                                _ => None,
                            }
                        })
                    }
                    _ => None,
                }
            } else {
                None
            };
            frames.push(info.span, spec);
            continue;
        }
        if matches!(kind, AstKind::Function(_)) {
            frames.push(kind.span(), frames.inherited());
            continue;
        }
        let AstKind::CallExpression(call) = kind else {
            continue;
        };
        let Some(spec) = frames.current() else {
            continue;
        };
        let Expression::StaticMemberExpression(callee) = call.callee.without_parentheses() else {
            continue;
        };
        if !["querySelector", "querySelectorAll", "getElementById"]
            .contains(&callee.property.name.as_str())
        {
            continue;
        }
        let Expression::StaticMemberExpression(shadow) = callee.object.without_parentheses() else {
            continue;
        };
        if shadow.property.name != "shadowRoot" {
            continue;
        }
        let is_host = match spec {
            Spec::Host(name) => identifier_name(&shadow.object) == Some(name.as_str()),
            Spec::SelfName(name) => {
                matches!(shadow.object.without_parentheses(), Expression::StaticMemberExpression(member)
                if member.property.name == "host" && identifier_name(&member.object) == Some(name.as_str()))
            }
        };
        if is_host {
            ctx.report(
                "no-root-query-in-setup",
                call.span,
                "the shadow root is queried in setup before the returned DOM is placed - setup's output fills the shadow root only after setup returns (after the awaited promise resolves, for an async setup), so this finds the loading content, not your own; keep a reference to the node you build and use it directly, or query self.host.shadowRoot in onMount, which imp runs on the next frame once your DOM is laid out on the page",
            );
        }
    }
}

const COMPONENT_HOOKS: &[&str] = &["setup", "onMount", "onRemove", "error", "loading"];

// The global timer that `callee` names: `setInterval`, or `window.setTimeout` and the like, when no
// local binding shadows the name.
fn raw_timer_name<'e>(ctx: &Ctx, callee: &'e Expression) -> Option<&'e str> {
    let timers = ["setInterval", "setTimeout"];
    match callee.without_parentheses() {
        Expression::Identifier(identifier) if timers.contains(&identifier.name.as_str()) => {
            let scoping = ctx.semantic.scoping();
            let local = identifier
                .reference_id
                .get()
                .and_then(|reference| scoping.get_reference(reference).symbol_id())
                .is_some();
            (!local).then_some(identifier.name.as_str())
        }
        Expression::StaticMemberExpression(member)
            if timers.contains(&member.property.name.as_str())
                && matches!(
                    identifier_name(&member.object),
                    Some("window" | "globalThis" | "self")
                ) =>
        {
            Some(member.property.name.as_str())
        }
        _ => None,
    }
}

fn no_raw_timer(ctx: &Ctx, definitions: &Definitions) {
    let mut frames: Frames<()> = Frames::new();
    for node in ctx.nodes() {
        let kind = node.kind();
        frames.leave_before(kind.span().start, |_| {});
        let is_function = matches!(kind, AstKind::Function(_))
            || matches!(kind, AstKind::ArrowFunctionExpression(_));
        if is_function {
            let info = function_info(kind, node.id()).unwrap();
            let hook = definitions
                .hook_property(ctx, info.id, info.span, COMPONENT_HOOKS)
                .is_some();
            frames.push(info.span, if hook { Some(()) } else { frames.inherited() });
            continue;
        }
        let AstKind::CallExpression(call) = kind else {
            continue;
        };
        if frames.current().is_none() {
            continue;
        }
        let Some(name) = raw_timer_name(ctx, &call.callee) else {
            continue;
        };
        let (replacement, behaviour) = if name == "setInterval" {
            (
                "interval(self, ms, run)",
                "it stops when the component unmounts, never overlaps a slow async run, and takes { whenVisible: true } for a poll",
            )
        } else {
            (
                "delay(self, ms, run)",
                "an unmount before the wait cancels it",
            )
        };
        ctx.report(
            "no-raw-timer",
            call.span,
            format!(
                "'{name}' in a component keeps running after the component unmounts unless you clear it yourself - use {replacement} from 'imp': {behaviour}"
            ),
        );
    }
}

fn sorts_after(existing: &str, added: &str) -> bool {
    existing.to_lowercase() > added.to_lowercase()
}

fn import_source_rule(ctx: &Ctx, imports: &[&ImportDeclaration]) {
    let apis = api_specifiers();
    let named_only = |declaration: &ImportDeclaration| {
        declaration.specifiers.as_ref().is_some_and(|specifiers| {
            !specifiers.is_empty()
                && specifiers.iter().all(|specifier| {
                    matches!(specifier, ImportDeclarationSpecifier::ImportSpecifier(_))
                })
        })
    };
    let mut first = true;
    for declaration in imports {
        let source = import_source(declaration);
        if !apis.contains(&source) {
            continue;
        }
        let specifiers = declaration
            .specifiers
            .as_ref()
            .map(|list| list.iter().collect::<Vec<_>>())
            .unwrap_or_default();
        for specifier in &specifiers {
            let ImportDeclarationSpecifier::ImportSpecifier(named) = specifier else {
                continue;
            };
            let name = imported_name(named);
            let Some(home) = export_home(&name) else {
                continue;
            };
            if home == source {
                continue;
            }
            let fix = if first {
                first = false;
                let text = ctx.text(named.span).to_string();
                let target = imports.iter().find(|other| {
                    other.span != declaration.span
                        && import_source(other) == home
                        && named_only(other)
                });
                let remaining: Vec<&&ImportDeclarationSpecifier> = specifiers
                    .iter()
                    .filter(|other| other.span() != named.span)
                    .collect();
                let mut edits: Vec<(u32, u32, String)> = Vec::new();
                if remaining.is_empty() && target.is_none() {
                    edits.push((
                        declaration.span.start,
                        declaration.span.end,
                        format!("import {{ {text} }} from '{home}'"),
                    ));
                } else {
                    if remaining.is_empty() {
                        let mut end = declaration.span.end as usize;
                        let bytes = ctx.source.as_bytes();
                        while end < bytes.len() && (bytes[end] == b' ' || bytes[end] == b'\t') {
                            end += 1;
                        }
                        if bytes.get(end) == Some(&b'\n') {
                            end += 1;
                        }
                        edits.push((declaration.span.start, end as u32, String::new()));
                    } else {
                        let joined = remaining
                            .iter()
                            .map(|other| ctx.text(other.span()))
                            .collect::<Vec<_>>()
                            .join(", ");
                        edits.push((
                            specifiers[0].span().start,
                            specifiers[specifiers.len() - 1].span().end,
                            joined,
                        ));
                    }
                    match target {
                        Some(target) => {
                            let target_specifiers: Vec<&ImportDeclarationSpecifier> =
                                target.specifiers.iter().flatten().collect();
                            let follower = target_specifiers.iter().find(|other| match other {
                                ImportDeclarationSpecifier::ImportSpecifier(other) => {
                                    sorts_after(&imported_name(other), &name)
                                }
                                _ => false,
                            });
                            match follower {
                                Some(follower) => edits.push((
                                    follower.span().start,
                                    follower.span().start,
                                    format!("{text}, "),
                                )),
                                None => {
                                    let last = target_specifiers.last().unwrap().span().end;
                                    edits.push((last, last, format!(", {text}")));
                                }
                            }
                        }
                        None => {
                            let line_start = ctx.source[..declaration.span.start as usize]
                                .rfind('\n')
                                .map_or(0, |index| index + 1);
                            let prefix = &ctx.source[line_start..declaration.span.start as usize];
                            let indentation =
                                if prefix.chars().all(|char| char == ' ' || char == '\t') {
                                    prefix
                                } else {
                                    ""
                                };
                            edits.push((
                                declaration.span.end,
                                declaration.span.end,
                                format!("\n{indentation}import {{ {text} }} from '{home}'"),
                            ));
                        }
                    }
                }
                Some(edits)
            } else {
                None
            };
            ctx.report_fix(
                "import-source",
                named.span,
                format!("'{name}' is not exported by '{source}' - it comes from '{home}': import {{ {name} }} from '{home}'"),
                fix,
            );
        }
    }
}

fn edit_distance(a: &str, b: &str) -> usize {
    let b: Vec<char> = b.chars().collect();
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for (i, left) in a.chars().enumerate() {
        let mut diagonal = row[0];
        row[0] = i + 1;
        for (j, right) in b.iter().enumerate() {
            let above = row[j + 1];
            row[j + 1] = if left.eq_ignore_ascii_case(right) {
                diagonal
            } else {
                1 + diagonal.min(above).min(row[j])
            };
            diagonal = above;
        }
    }
    row[b.len()]
}

// The export of `names` closest to `name`, when it is close enough to be a typo or a rename.
fn closest_export<'n>(name: &str, names: &'n BTreeSet<String>) -> Option<&'n str> {
    let limit = (name.len() / 4).max(1);
    names
        .iter()
        .map(|candidate| (edit_distance(name, candidate), candidate))
        .filter(|(distance, _)| *distance <= limit)
        .min_by_key(|(distance, _)| *distance)
        .map(|(_, candidate)| candidate.as_str())
}

fn unknown_export(ctx: &Ctx, imports: &[&ImportDeclaration]) {
    let exports = imp_module_exports();
    for declaration in imports {
        let source = import_source(declaration);
        let Some(names) = exports.get(source).filter(|names| !names.is_empty()) else {
            continue;
        };
        for specifier in declaration.specifiers.iter().flatten() {
            let ImportDeclarationSpecifier::ImportSpecifier(named) = specifier else {
                continue;
            };
            let name = imported_name(named);
            if names.contains(&name) {
                continue;
            }
            if !is_imp_std_specifier(source) && export_home(&name).is_some() {
                continue;
            }
            let elsewhere = exports
                .iter()
                .find(|(_, other)| other.contains(&name))
                .map(|(specifier, _)| *specifier);
            let hint = match (elsewhere, closest_export(&name, names)) {
                (Some(home), _) => {
                    format!(" - it comes from '{home}': import {{ {name} }} from '{home}'")
                }
                (None, Some(close)) => format!(" - did you mean '{close}'?"),
                (None, None) if source == "imp/icons" => {
                    " - no icon has that name; find the current name at https://lucide.dev/icons"
                        .into()
                }
                (None, None) => String::new(),
            };
            ctx.report(
                "unknown-export",
                named.span,
                format!("'{name}' is not exported by '{source}'{hint}"),
            );
        }
    }
}

fn icons_by_name(ctx: &Ctx) {
    let count = imp_module_exports()
        .get("imp/icons")
        .map(|names| names.len())
        .unwrap_or(0);
    let whole_set = |how: String| {
        format!(
            "{how} reaches for the whole 'imp/icons' set ({count} icons) - the build drops only the icons an app never names, so import each one you draw: import {{ luHouse }} from 'imp/icons'"
        )
    };
    for node in ctx.nodes() {
        match node.kind() {
            AstKind::ImportDeclaration(declaration)
                if import_source(declaration) == "imp/icons" =>
            {
                for specifier in declaration.specifiers.iter().flatten() {
                    if let ImportDeclarationSpecifier::ImportNamespaceSpecifier(namespace) =
                        specifier
                    {
                        ctx.report(
                            "icons-by-name",
                            namespace.span,
                            whole_set(format!("'import * as {}'", namespace.local.name)),
                        );
                    }
                }
            }
            AstKind::ExportAllDeclaration(declaration)
                if declaration.source.value == "imp/icons" =>
            {
                let how = match &declaration.exported {
                    Some(exported) => format!("'export * as {}'", exported.name()),
                    None => "'export *'".into(),
                };
                ctx.report("icons-by-name", declaration.span, whole_set(how));
            }
            AstKind::ImportExpression(expression) => {
                if matches!(&expression.source, Expression::StringLiteral(literal) if literal.value == "imp/icons")
                {
                    ctx.report(
                        "icons-by-name",
                        expression.span,
                        whole_set("'import()'".into()),
                    );
                }
            }
            _ => {}
        }
    }
}

fn repeated_params<'a>(ctx: &Ctx, nodes: &ObjectExpression<'a>, above: &mut Vec<String>) {
    for property in &nodes.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            continue;
        };
        if property.computed {
            continue;
        }
        let Some(name) = property.key.static_name() else {
            continue;
        };
        let param = name.as_js_str().starts_with('$');
        if param && above.iter().any(|outer| name == outer.as_str()) {
            ctx.report(
                "app-map-unique-params",
                property.key.span(),
                format!(
                    "'{name}' repeats the param '{name}' above it in this map - a param name names one param of a chain, so give each param its own name, like $orgId and $teamId",
                    name = name.display(),
                ),
            );
        }
        if let Expression::ObjectExpression(children) = property.value.without_parentheses() {
            if param {
                above.push(name.display().to_string());
            }
            repeated_params(ctx, children, above);
            if param {
                above.pop();
            }
        }
    }
}

fn app_map_unique_params(ctx: &Ctx, imports: &[&ImportDeclaration]) {
    let tracker = HelperTracker::new(imports, &[("imp", &["appMap"])]);
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        if tracker.called(&call.callee).as_deref() != Some("appMap") {
            continue;
        }
        let nodes = call
            .arguments
            .get(if call.arguments.len() == 2 { 1 } else { 0 });
        if let Some(Argument::ObjectExpression(nodes)) = nodes {
            repeated_params(ctx, nodes, &mut Vec::new());
        }
    }
}

struct NameTracker {
    locals: HashMap<String, &'static str>,
    namespaces: HashMap<String, &'static [(&'static str, &'static str)]>,
}

const HTML_NAMED: &[(&str, &str)] = &[("el", "el"), ("img", "img"), ("button", "button")];
const STD_NAMED: &[(&str, &str)] = &[("button", "std-button"), ("icon", "icon")];

impl NameTracker {
    fn new(imports: &[&ImportDeclaration]) -> NameTracker {
        let mut locals = HashMap::new();
        let mut namespaces = HashMap::new();
        for declaration in imports {
            let kinds: &'static [(&str, &str)] = match import_source(declaration) {
                "imp/html" => HTML_NAMED,
                "imp/std" => STD_NAMED,
                _ => continue,
            };
            for specifier in declaration.specifiers.iter().flatten() {
                match specifier {
                    ImportDeclarationSpecifier::ImportSpecifier(specifier) => {
                        if let Some((_, kind)) = kinds
                            .iter()
                            .find(|(name, _)| *name == imported_name(specifier))
                        {
                            locals.insert(specifier.local.name.to_string(), *kind);
                        }
                    }
                    ImportDeclarationSpecifier::ImportNamespaceSpecifier(specifier) => {
                        namespaces.insert(specifier.local.name.to_string(), kinds);
                    }
                    _ => {}
                }
            }
        }
        NameTracker { locals, namespaces }
    }

    fn callee_kind(&self, callee: &Expression) -> Option<&'static str> {
        match callee.without_parentheses() {
            Expression::Identifier(identifier) => {
                self.locals.get(identifier.name.as_str()).copied()
            }
            Expression::StaticMemberExpression(member) => {
                let object = identifier_name(&member.object)?;
                self.namespaces
                    .get(object)?
                    .iter()
                    .find(|(name, _)| *name == member.property.name.as_str())
                    .map(|(_, kind)| *kind)
            }
            _ => None,
        }
    }

    fn element<'c, 'a>(
        &self,
        call: &'c CallExpression<'a>,
    ) -> Option<(&'static str, Vec<&'c Argument<'a>>)> {
        let kind = self.callee_kind(&call.callee)?;
        if kind != "el" {
            return Some((kind, call.arguments.iter().collect()));
        }
        let tag = match literal_argument(call.arguments.first())? {
            LiteralValue::Str(tag) | LiteralValue::Other(tag) => tag.to_lowercase(),
            LiteralValue::Missing => "undefined".into(),
        };
        let kind = match tag.as_str() {
            "img" => "img",
            "button" => "button",
            _ => return None,
        };
        Some((kind, call.arguments.iter().skip(1).collect()))
    }

    fn is_icon_call(&self, expression: &Expression) -> bool {
        matches!(expression.without_parentheses(), Expression::CallExpression(call) if self.callee_kind(&call.callee) == Some("icon"))
    }
}

fn props_objects<'c, 'a>(arguments: &[&'c Argument<'a>]) -> Vec<&'c ObjectExpression<'a>> {
    arguments
        .iter()
        .filter_map(|argument| match argument {
            Argument::ObjectExpression(object) => Some(&**object),
            _ => None,
        })
        .collect()
}

fn has_spread(objects: &[&ObjectExpression]) -> bool {
    objects.iter().any(|object| {
        object
            .properties
            .iter()
            .any(|property| matches!(property, ObjectPropertyKind::SpreadProperty(_)))
    })
}

fn has_prop_key(objects: &[&ObjectExpression], keys: &[&str]) -> bool {
    objects.iter().any(|object| {
        object.properties.iter().any(|property| match property {
            ObjectPropertyKind::ObjectProperty(property) => {
                property_key_name(property).is_some_and(|key| keys.contains(&key.as_str()))
            }
            _ => false,
        })
    })
}

fn accessible_names(ctx: &Ctx, imports: &[&ImportDeclaration]) {
    let tracker = NameTracker::new(imports);
    for node in ctx.nodes() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };
        let Some((kind, arguments)) = tracker.element(call) else {
            continue;
        };
        if kind == "img" {
            if arguments
                .iter()
                .any(|argument| !matches!(argument, Argument::ObjectExpression(_)))
            {
                continue;
            }
            let props = props_objects(&arguments);
            if has_spread(&props) || has_prop_key(&props, &["alt"]) {
                continue;
            }
            ctx.report("img-alt", call.span, "'img' has no alt - a screen reader then reads the file name or nothing; describe the image in alt, or write alt: '' for an image that only decorates");
            continue;
        }
        let (keys, example): (&[&str], &str) = match kind {
            "button" => (
                &["aria-label", "ariaLabel", "aria-labelledby", "title"],
                "button({ 'aria-label': 'Delete' }, icon(luTrash))",
            ),
            "std-button" => (&["label"], "button({ label: 'Delete' }, icon(luTrash))"),
            _ => continue,
        };
        let children: Vec<&&Argument> = arguments
            .iter()
            .filter(|argument| !matches!(argument, Argument::ObjectExpression(_)))
            .collect();
        let unnamed_icon = |child: &&&Argument| {
            child.as_expression().is_some_and(|expression| {
                tracker.is_icon_call(expression) && {
                    let Expression::CallExpression(icon) = expression.without_parentheses() else {
                        return false;
                    };
                    let icon_arguments: Vec<&Argument> = icon.arguments.iter().collect();
                    let props = props_objects(&icon_arguments);
                    !(has_spread(&props) || has_prop_key(&props, &["label"]))
                }
            })
        };
        if children.is_empty() || !children.iter().all(unnamed_icon) {
            continue;
        }
        let props = props_objects(&arguments);
        if has_spread(&props) || has_prop_key(&props, keys) {
            continue;
        }
        ctx.report(
            "icon-button-name",
            call.span,
            format!("'button' shows only an icon and has no accessible name - a screen reader announces it as \"button\" and nothing more; name the button itself: {example}"),
        );
    }
}

fn is_relative_or_url(specifier: &str) -> bool {
    if specifier.starts_with('.') || specifier.starts_with('/') {
        return true;
    }
    let Some(colon) = specifier.find(':') else {
        return false;
    };
    let scheme = &specifier[..colon];
    scheme
        .chars()
        .next()
        .is_some_and(|char| char.is_ascii_alphabetic())
        && scheme
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || matches!(char, '_' | '+' | '.' | '-'))
}

fn exact_dependency_versions(ctx: &Ctx) {
    let aliases: HashSet<&str> = ctx.dependency_aliases.iter().map(String::as_str).collect();
    let check = |literal: &StringLiteral| {
        let specifier = literal.value.as_str().unwrap_or_default();
        if let Some(install) = specifier.strip_prefix(NPM_PREFIX) {
            let alias = parse_specifier(specifier)
                .map(|parsed| default_alias(&parsed))
                .unwrap_or_else(|| "the-alias".into());
            ctx.report(
                "exact-dependency-versions",
                literal.span,
                format!("'{specifier}' is an inline dependency specifier - dependencies are vendored: run 'imp install {install}' and import '{alias}' instead"),
            );
            return;
        }
        if is_imp_specifier(specifier)
            || is_relative_or_url(specifier)
            || aliases.contains(specifier)
        {
            return;
        }
        if specifier.starts_with("imp/") {
            ctx.report(
                "exact-dependency-versions",
                literal.span,
                imp_subpath_problem(specifier),
            );
            return;
        }
        ctx.report(
            "exact-dependency-versions",
            literal.span,
            format!("'{specifier}' is not a declared dependency - run 'imp install {specifier}' to vendor it and add it to 'dependencies' in imp.json"),
        );
    };
    for node in ctx.nodes() {
        match node.kind() {
            AstKind::ImportDeclaration(declaration) => check(&declaration.source),
            AstKind::ExportFromDeclaration(declaration) => check(&declaration.source),
            AstKind::ExportAllDeclaration(declaration) => check(&declaration.source),
            AstKind::ImportExpression(expression) => {
                if let Expression::StringLiteral(literal) = &expression.source {
                    check(literal);
                }
            }
            _ => {}
        }
    }
}

pub fn dependency_pin_problem(specifier: &str) -> Option<String> {
    let parsed = parse_specifier(specifier).filter(|parsed| parsed.npm_prefix);
    let Some(parsed) = parsed else {
        return Some(format!(
            "'{specifier}' must be an 'npm:' specifier (e.g. 'npm:mitt@3.0.1') - run 'imp install' to declare dependencies"
        ));
    };
    if parsed
        .version
        .as_deref()
        .is_some_and(|version| EXACT_VERSION.is_match(version))
    {
        return None;
    }
    let example_version = {
        let digits: String = parsed
            .version
            .as_deref()
            .and_then(|version| {
                regex::Regex::new(r"\d+(\.\d+){0,2}")
                    .unwrap()
                    .find(version)
                    .map(|found| found.as_str().to_string())
            })
            .unwrap_or_default();
        if digits.is_empty() {
            "1.2.3".to_string()
        } else {
            let mut parts: Vec<&str> = digits.split('.').collect();
            while parts.len() < 3 {
                parts.push("0");
            }
            parts.join(".")
        }
    };
    let example = format!("{NPM_PREFIX}{}@{example_version}", parsed.name);
    let reason = match &parsed.version {
        Some(version) => format!("'{version}' is not an exact version"),
        None => "no version is given".into(),
    };
    Some(format!(
        "'{specifier}' must pin an exact version ({reason}) - the vendored bundle in dependencies/ is built from this pin (e.g. '{example}'); run 'imp install' to re-resolve and re-pin it"
    ))
}

pub fn run(ctx: &Ctx) {
    let imports = program_imports(ctx);
    let definitions = Definitions::new(&imports);
    let factories = FactoryTracker::new(&imports);
    let handles = HandleTracker::new(ctx, &imports);
    no_capital_component(ctx);
    single_props_object(ctx, &factories);
    name_rule(
        ctx,
        &imports,
        &NameRule {
            rule: "state-name-namespace",
            source: "imp/state",
            helpers: &[("initState", 1), ("useState", 1)],
            problem: state_name_problem,
            label: "state name",
            example: "myapp.user",
        },
    );
    name_rule(
        ctx,
        &imports,
        &NameRule {
            rule: "http-client-name-namespace",
            source: "imp/http",
            helpers: &[
                ("createHttpClient", 0),
                ("initHttpClient", 1),
                ("useHttpClient", 1),
            ],
            problem: http_client_name_problem,
            label: "http client name",
            example: "myapp.api",
        },
    );
    analytics_rule(ctx);
    watch_with_self(ctx, &definitions, &handles);
    self_first_argument(ctx, &imports);
    no_self_in_loading(ctx, &imports, &definitions, &handles);
    loading_with_async_setup(ctx, &definitions, &factories, &handles);
    on_remove_through_self(ctx, &imports, &definitions);
    no_self_at_module_scope(ctx, &imports, &definitions);
    abort_check_after_await(ctx, &imports, &definitions);
    no_state_as_child(ctx, &factories, &handles);
    no_get_in_binding(ctx, &factories, &handles);
    no_root_query_in_setup(ctx, &definitions);
    no_raw_timer(ctx, &definitions);
    component_name_rule(ctx, &imports);
    import_source_rule(ctx, &imports);
    unknown_export(ctx, &imports);
    icons_by_name(ctx);
    accessible_names(ctx, &imports);
    exact_dependency_versions(ctx);
    app_map_unique_params(ctx, &imports);
}
