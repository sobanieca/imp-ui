use crate::bundler::resolve_module_file;
use crate::config::{Config, get_path, get_strings, public_directory};
use crate::html_document::{is_javascript_type, is_local_script_source, is_module_type, read_html};
use crate::lint_support::{binding_names, line_column, parse};
use crate::paths::{normalize, relative_posix};
use crate::project_files::{is_mock_file, is_preview_file, is_test_file};
use crate::walk::{Collect, collect_files, is_within_prefix};
use anyhow::Result;
use oxc::allocator::Allocator;
use oxc::ast::ast::*;
use oxc::ast_visit::Visit;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};

pub const UNREACHABLE_MODULE_RULE: &str = "imp/unreachable-module";
pub const UNUSED_EXPORT_RULE: &str = "imp/unused-export";
pub const COMPUTED_IMPORT_RULE: &str = "imp/computed-import";

#[derive(Clone, Debug)]
enum Names {
    All,
    Some(Vec<String>),
}

#[derive(Default)]
struct Record {
    imports: Vec<(String, Names)>,
    exports: Vec<(String, (usize, usize))>,
    star_exports: Vec<String>,
    folder_imports: Vec<String>,
    computed_imports: Vec<(usize, usize)>,
}

struct Collector<'s> {
    source: &'s str,
    record: Record,
}

impl Collector<'_> {
    fn at(&self, offset: u32) -> (usize, usize) {
        line_column(self.source, offset)
    }
}

impl<'a> Visit<'a> for Collector<'_> {
    fn visit_import_declaration(&mut self, declaration: &ImportDeclaration<'a>) {
        let mut names = Vec::new();
        for specifier in declaration.specifiers.iter().flatten() {
            match specifier {
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => {
                    self.record
                        .imports
                        .push((declaration.source.value.to_string(), Names::All));
                    return;
                }
                ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => {
                    names.push("default".to_string())
                }
                ImportDeclarationSpecifier::ImportSpecifier(specifier) => {
                    names.push(specifier.imported.name().to_string())
                }
            }
        }
        self.record
            .imports
            .push((declaration.source.value.to_string(), Names::Some(names)));
    }

    fn visit_export_named_declaration(&mut self, declaration: &ExportNamedDeclaration<'a>) {
        for specifier in &declaration.specifiers {
            let at = self.at(specifier.exported.span().start);
            self.record
                .exports
                .push((specifier.exported.name().to_string(), at));
        }
    }

    fn visit_export_from_declaration(&mut self, declaration: &ExportFromDeclaration<'a>) {
        let names = declaration
            .specifiers
            .iter()
            .map(|specifier| specifier.local.name().to_string())
            .collect();
        self.record
            .imports
            .push((declaration.source.value.to_string(), Names::Some(names)));
        for specifier in &declaration.specifiers {
            let at = self.at(specifier.exported.span().start);
            self.record
                .exports
                .push((specifier.exported.name().to_string(), at));
        }
    }

    fn visit_export_declaration(&mut self, declaration: &ExportDeclaration<'a>) {
        match &declaration.declaration {
            Declaration::VariableDeclaration(variables) => {
                for declarator in &variables.declarations {
                    let mut found = Vec::new();
                    binding_names(&declarator.id, &mut found);
                    for identifier in found {
                        let at = self.at(identifier.span.start);
                        self.record.exports.push((identifier.name.to_string(), at));
                    }
                }
            }
            Declaration::FunctionDeclaration(function) => {
                if let Some(id) = &function.id {
                    let at = self.at(id.span.start);
                    self.record.exports.push((id.name.to_string(), at));
                }
            }
            Declaration::ClassDeclaration(class) => {
                if let Some(id) = &class.id {
                    let at = self.at(id.span.start);
                    self.record.exports.push((id.name.to_string(), at));
                }
            }
            _ => {}
        }
        oxc::ast_visit::walk::walk_export_declaration(self, declaration);
    }

    fn visit_export_all_declaration(&mut self, declaration: &ExportAllDeclaration<'a>) {
        match &declaration.exported {
            Some(exported) => {
                self.record
                    .imports
                    .push((declaration.source.value.to_string(), Names::All));
                let at = self.at(exported.span().start);
                self.record.exports.push((exported.name().to_string(), at));
            }
            None => self
                .record
                .star_exports
                .push(declaration.source.value.to_string()),
        }
    }

    fn visit_export_default_declaration(&mut self, declaration: &ExportDefaultDeclaration<'a>) {
        let at = self.at(declaration.span.start);
        self.record.exports.push(("default".into(), at));
        oxc::ast_visit::walk::walk_export_default_declaration(self, declaration);
    }

    fn visit_import_expression(&mut self, expression: &ImportExpression<'a>) {
        match &expression.source {
            Expression::StringLiteral(literal) => self
                .record
                .imports
                .push((literal.value.to_string(), Names::All)),
            Expression::TemplateLiteral(template) => {
                let head = template
                    .quasis
                    .first()
                    .and_then(|quasi| quasi.value.cooked.as_ref())
                    .map(|cooked| cooked.to_string())
                    .unwrap_or_default();
                if template.expressions.is_empty() {
                    self.record.imports.push((head, Names::All));
                } else if let Some(cut) = head.rfind('/') {
                    self.record.folder_imports.push(head[..=cut].to_string());
                } else {
                    let at = self.at(expression.span.start);
                    self.record.computed_imports.push(at);
                }
            }
            _ => {
                let at = self.at(expression.span.start);
                self.record.computed_imports.push(at);
            }
        }
        oxc::ast_visit::walk::walk_import_expression(self, expression);
    }
}

use oxc::span::GetSpan;

fn collect_module(source: &str) -> Option<Record> {
    let allocator = Allocator::default();
    let options = oxc::parser::ParseOptions {
        preserve_parens: false,
        ..Default::default()
    };
    let parsed = oxc::parser::Parser::new(&allocator, source, oxc::span::SourceType::mjs())
        .with_options(options)
        .parse();
    if parsed.diagnostics.has_errors() {
        return None;
    }
    let mut collector = Collector {
        source,
        record: Record::default(),
    };
    collector.visit_program(&parsed.program);
    let _ = parse;
    Some(collector.record)
}

fn is_development_entry(path: &str) -> bool {
    is_test_file(path) || is_preview_file(path) || is_mock_file(path)
}

fn is_relative(specifier: &str) -> bool {
    specifier.starts_with("./") || specifier.starts_with("../")
}

fn preview_modules(config: &Config) -> Vec<String> {
    let mut modules = get_strings(config, &["preview", "themes"]);
    if let Some(translations) =
        get_path(config, &["preview", "translations"]).and_then(Value::as_object)
    {
        modules.extend(
            translations
                .values()
                .filter_map(|value| value.as_str().map(String::from)),
        );
    }
    if let Some(groups) = get_path(config, &["preview", "groups"]).and_then(Value::as_str) {
        modules.push(groups.to_string());
    }
    modules
}

struct Finding {
    rule: &'static str,
    path: String,
    line: usize,
    column: usize,
    message: String,
}

pub fn report_dead_code(root: &Path, config: &Config, config_name: &str) -> Result<usize> {
    let grants: Vec<(String, Option<String>)> = get_strings(config, &["lint", "publicExports"])
        .iter()
        .map(|entry| match entry.split_once('#') {
            Some((path, name)) => (
                path.trim_end_matches('/').to_string(),
                Some(name.to_string()),
            ),
            None => (entry.trim_end_matches('/').to_string(), None),
        })
        .collect();
    let exclude = get_strings(config, &["lint", "exclude"]);
    let project_root = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let files = collect_files(Collect {
        root: &project_root,
        paths: &[],
        extensions: &["js", "mjs", "cjs", "html"],
        exclude: &[],
    })?;
    let scripts: Vec<PathBuf> = files
        .iter()
        .filter(|file| crate::paths::extension(file) != "html")
        .cloned()
        .collect();
    if scripts.is_empty() {
        return Ok(0);
    }
    let public_folder = public_directory(&project_root);
    let relative_to = |file: &Path| relative_posix(&project_root, file);
    let grants_for = |file: &Path| -> Vec<&(String, Option<String>)> {
        let relative = relative_to(file);
        grants
            .iter()
            .filter(|(path, _)| is_within_prefix(&relative, path))
            .collect()
    };
    let is_excluded = |relative: &str| {
        exclude
            .iter()
            .any(|entry| is_within_prefix(relative, entry))
    };
    let hint = format!(
        "add it to \"publicExports\" in {config_name} if it is used from outside the project"
    );
    let computed_message = format!(
        "import() takes a computed specifier, so imp cannot tell which module it loads - name the folder in a template like import(`./pages/${{name}}.js`), or list the modules it loads in \"publicExports\" in {config_name}"
    );
    let mut findings: Vec<Finding> = Vec::new();
    let mut modules: BTreeMap<PathBuf, Record> = BTreeMap::new();
    let mut roots: BTreeSet<PathBuf> = BTreeSet::new();
    let skip = |file: &Path| {
        eprintln!(
            "note: the dead code checks are skipped - {} does not parse, so imp cannot tell what it imports\n",
            relative_to(file)
        );
        Ok(0)
    };
    for file in &scripts {
        let Some(record) = collect_module(&std::fs::read_to_string(file)?) else {
            return skip(file);
        };
        let relative = relative_to(file);
        if is_development_entry(&file.to_string_lossy())
            || file.starts_with(&public_folder)
            || !grants_for(file).is_empty()
        {
            roots.insert(file.clone());
        }
        if !is_excluded(&relative) {
            for (line, column) in &record.computed_imports {
                findings.push(Finding {
                    rule: COMPUTED_IMPORT_RULE,
                    path: relative.clone(),
                    line: *line,
                    column: *column,
                    message: computed_message.clone(),
                });
            }
        }
        modules.insert(file.clone(), record);
    }
    for path in preview_modules(config) {
        if let Some(target) = resolve_module_file(&normalize(&project_root.join(path)))
            && modules.contains_key(&target)
        {
            roots.insert(target);
        }
    }
    let resolve_edge = |directory: &Path, specifier: &str| -> Option<PathBuf> {
        if !is_relative(specifier) {
            return None;
        }
        resolve_module_file(&normalize(&directory.join(specifier)))
            .filter(|target| modules.contains_key(target))
    };
    let edges_of = |record: &Record, directory: &Path| -> Vec<(PathBuf, Names)> {
        let mut edges = Vec::new();
        for (specifier, names) in &record.imports {
            if let Some(target) = resolve_edge(directory, specifier) {
                edges.push((target, names.clone()));
            }
        }
        for prefix in &record.folder_imports {
            let folder = normalize(&directory.join(prefix));
            for other in &scripts {
                if other.starts_with(&folder) {
                    edges.push((other.clone(), Names::All));
                }
            }
        }
        edges
    };
    let mut edges: HashMap<PathBuf, Vec<(PathBuf, Names)>> = HashMap::new();
    let mut star_targets: HashMap<PathBuf, Vec<PathBuf>> = HashMap::new();
    for (file, record) in &modules {
        let directory = file.parent().unwrap();
        let mut file_edges = edges_of(record, directory);
        let mut stars = Vec::new();
        for specifier in &record.star_exports {
            if let Some(target) = resolve_edge(directory, specifier) {
                stars.push(target.clone());
                file_edges.push((target, Names::Some(Vec::new())));
            }
        }
        edges.insert(file.clone(), file_edges);
        star_targets.insert(file.clone(), stars);
    }
    let mut page_edges: Vec<(PathBuf, Names)> = Vec::new();
    for file in files
        .iter()
        .filter(|file| crate::paths::extension(file) == "html")
    {
        let html = std::fs::read_to_string(file)?;
        let directory = file.parent().unwrap();
        for script in read_html(&html).scripts {
            if !is_javascript_type(script.kind.as_deref()) {
                continue;
            }
            if let Some(src) = &script.src {
                if src.is_empty() || !is_local_script_source(src) {
                    continue;
                }
                let path =
                    crate::http_server::percent_decode(src.split(['?', '#']).next().unwrap_or(""));
                let candidate = if let Some(stripped) = path.strip_prefix('/') {
                    project_root.join(stripped)
                } else {
                    directory.join(&path)
                };
                if let Some(target) = resolve_module_file(&normalize(&candidate))
                    && modules.contains_key(&target)
                {
                    roots.insert(target);
                }
                continue;
            }
            if !is_module_type(script.kind.as_deref()) || script.text.trim().is_empty() {
                continue;
            }
            let Some(record) = collect_module(&script.text) else {
                return skip(file);
            };
            let relative = relative_to(file);
            if !is_excluded(&relative) {
                for (line, column) in &record.computed_imports {
                    findings.push(Finding {
                        rule: COMPUTED_IMPORT_RULE,
                        path: relative.clone(),
                        line: line + script.line_offset,
                        column: *column,
                        message: computed_message.clone(),
                    });
                }
            }
            for (target, names) in edges_of(&record, directory) {
                roots.insert(target.clone());
                page_edges.push((target, names));
            }
        }
    }
    if roots.is_empty() {
        return Ok(print(findings));
    }
    #[derive(Default)]
    struct Used {
        all: bool,
        names: HashSet<String>,
    }
    let mut used: HashMap<PathBuf, Used> = HashMap::new();
    fn mark(
        file: &Path,
        names: &Names,
        used: &mut HashMap<PathBuf, Used>,
        modules: &BTreeMap<PathBuf, Record>,
        stars: &HashMap<PathBuf, Vec<PathBuf>>,
    ) {
        match names {
            Names::All => {
                let entry = used.entry(file.to_path_buf()).or_default();
                if entry.all {
                    return;
                }
                entry.all = true;
                for target in stars.get(file).cloned().unwrap_or_default() {
                    mark(&target, &Names::All, used, modules, stars);
                }
            }
            Names::Some(list) => {
                for name in list {
                    let entry = used.entry(file.to_path_buf()).or_default();
                    if !entry.names.insert(name.clone()) {
                        continue;
                    }
                    let declares = modules.get(file).is_some_and(|record| {
                        record.exports.iter().any(|(export, _)| export == name)
                    });
                    if name == "default" || declares {
                        continue;
                    }
                    for target in stars.get(file).cloned().unwrap_or_default() {
                        mark(
                            &target,
                            &Names::Some(vec![name.clone()]),
                            used,
                            modules,
                            stars,
                        );
                    }
                }
            }
        }
    }
    for (target, names) in &page_edges {
        mark(target, names, &mut used, &modules, &star_targets);
    }
    for file in &roots {
        for (_, name) in grants_for(file) {
            let names = match name {
                None => Names::All,
                Some(name) => Names::Some(vec![name.clone()]),
            };
            mark(file, &names, &mut used, &modules, &star_targets);
        }
    }
    let mut reachable: HashSet<PathBuf> = HashSet::new();
    let mut queue: Vec<PathBuf> = roots.iter().cloned().collect();
    while let Some(file) = queue.pop() {
        if !reachable.insert(file.clone()) {
            continue;
        }
        for (target, names) in edges.get(&file).cloned().unwrap_or_default() {
            mark(&target, &names, &mut used, &modules, &star_targets);
            queue.push(target);
        }
    }
    for file in &scripts {
        let relative = relative_to(file);
        if is_excluded(&relative) {
            continue;
        }
        if !reachable.contains(file) {
            findings.push(Finding {
                rule: UNREACHABLE_MODULE_RULE,
                path: relative.clone(),
                line: 1,
                column: 1,
                message: format!("nothing imports {relative} - no entry page, test, preview setting or public export reaches it; delete it, or {hint}"),
            });
            continue;
        }
        if roots.contains(file) && grants_for(file).is_empty() {
            continue;
        }
        let entry = used.get(file);
        if entry.is_some_and(|entry| entry.all) {
            continue;
        }
        for (name, (line, column)) in &modules[file].exports {
            if entry.is_some_and(|entry| entry.names.contains(name)) {
                continue;
            }
            findings.push(Finding {
                rule: UNUSED_EXPORT_RULE,
                path: relative.clone(),
                line: *line,
                column: *column,
                message: format!("'{name}' is exported by {relative} but nothing imports it - delete it, or {hint}"),
            });
        }
    }
    Ok(print(findings))
}

fn print(mut findings: Vec<Finding>) -> usize {
    findings.sort_by(|a, b| {
        a.path
            .cmp(&b.path)
            .then(a.line.cmp(&b.line))
            .then(a.column.cmp(&b.column))
    });
    for finding in &findings {
        eprintln!("error[{}]: {}", finding.rule, finding.message);
        eprintln!(
            " --> {}:{}:{}\n",
            finding.path, finding.line, finding.column
        );
    }
    findings.len()
}
