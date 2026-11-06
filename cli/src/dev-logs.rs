//! Removes the developer messages of the imp library from a production bundle.
//!
//! A developer message of the library is a call `impLogger.warn(...)` or `impLogger.debug(...)`.
//! It returns `undefined` and only writes to the console. So `imp build` replaces each call with
//! `void 0`, arguments included. The minifier then drops the `void 0` and every helper that only a
//! message used. `impLogger.error(...)` reports a problem of a running app, so it stays.
//!
//! The pass works on the syntax tree, because the bundler cannot do it. Its `manualPureFunctions`
//! option drops the call but keeps each `${...}` of the message and each condition in front of the
//! call, since turning a value into text may run code.

use oxc::allocator::Allocator;
use oxc::ast::ast::*;
use oxc::ast_visit::{Visit, walk};
use oxc::span::GetSpan;

const LOGGER: &str = "impLogger";

const STRIPPED: [&str; 2] = ["warn", "debug"];

struct Calls {
    spans: Vec<(u32, u32)>,
}

impl<'a> Visit<'a> for Calls {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if is_developer_message(&call.callee) {
            let span = call.span();
            self.spans.push((span.start, span.end));
            return;
        }
        walk::walk_call_expression(self, call);
    }
}

fn is_developer_message(callee: &Expression) -> bool {
    let Expression::StaticMemberExpression(member) = callee.get_inner_expression() else {
        return false;
    };
    matches!(&member.object, Expression::Identifier(object) if object.name == LOGGER)
        && STRIPPED.contains(&member.property.name.as_str())
}

/// The source with every developer message of the library replaced by `void 0`. The source comes
/// back unchanged when it does not name the logger or does not parse.
pub fn strip(source: &str) -> String {
    if !source.contains(LOGGER) {
        return source.to_string();
    }
    let allocator = Allocator::default();
    let parsed = oxc::parser::Parser::new(&allocator, source, oxc::span::SourceType::mjs()).parse();
    if parsed.diagnostics.has_errors() {
        return source.to_string();
    }
    let mut calls = Calls { spans: Vec::new() };
    calls.visit_program(&parsed.program);
    if calls.spans.is_empty() {
        return source.to_string();
    }
    let mut out = String::with_capacity(source.len());
    let mut at = 0;
    for (start, end) in calls.spans {
        out.push_str(&source[at..start as usize]);
        out.push_str("void 0");
        at = end as usize;
    }
    out.push_str(&source[at..]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_warnings_and_debug_messages_and_keeps_errors() {
        let source = "if (x) impLogger.warn(`bad ${x}`, y)\nimpLogger.debug(`a ${f(x)}`)\nimpLogger.error('kept')\nconst f = () => impLogger.warn('b')\n";
        assert_eq!(
            strip(source),
            "if (x) void 0\nvoid 0\nimpLogger.error('kept')\nconst f = () => void 0\n"
        );
    }

    /// Counts the references to the logger, and the ones that are the object of a direct call
    /// `impLogger.<level>(...)`.
    struct References {
        all: usize,
        direct: usize,
    }

    impl<'a> Visit<'a> for References {
        fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
            if let Expression::StaticMemberExpression(member) = call.callee.get_inner_expression()
                && matches!(&member.object, Expression::Identifier(object) if object.name == LOGGER)
            {
                self.direct += 1;
            }
            walk::walk_call_expression(self, call);
        }

        fn visit_identifier_reference(&mut self, identifier: &IdentifierReference<'a>) {
            if identifier.name == LOGGER {
                self.all += 1;
            }
        }
    }

    #[test]
    fn the_library_calls_its_logger_only_directly() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../lib/src");
        let mut stack = vec![root];
        let mut misses = Vec::new();
        while let Some(dir) = stack.pop() {
            for entry in std::fs::read_dir(&dir).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    stack.push(path);
                    continue;
                }
                if path.extension().is_none_or(|ext| ext != "js")
                    || path.file_name().is_some_and(|name| name == "logger.js")
                {
                    continue;
                }
                let source = std::fs::read_to_string(&path).unwrap();
                if !source.contains(LOGGER) {
                    continue;
                }
                let allocator = Allocator::default();
                let parsed =
                    oxc::parser::Parser::new(&allocator, &source, oxc::span::SourceType::mjs())
                        .parse();
                let mut references = References { all: 0, direct: 0 };
                references.visit_program(&parsed.program);
                if references.all != references.direct {
                    misses.push(path.display().to_string());
                }
            }
        }
        assert!(
            misses.is_empty(),
            "these modules use impLogger other than as impLogger.<level>(...), so imp build cannot remove their messages: {misses:?}"
        );
    }

    #[test]
    fn leaves_other_loggers_and_unparsable_code_alone() {
        assert_eq!(strip("log.warn('x')\n"), "log.warn('x')\n");
        assert_eq!(strip("impLogger.warn(\n"), "impLogger.warn(\n");
    }
}
