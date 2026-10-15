use crate::config::{Config, get_path, get_strings, load_imp_config};
use crate::paths::relative_posix;
use crate::walk::{Collect, collect_files};
use anyhow::{Result, anyhow};
use oxc::allocator::Allocator;
use oxc::parser::Parser;
use oxc::span::{GetSpan, SourceType};
use oxc_formatter::{JsFormatOptions, OperatorPosition, QuoteStyle, Semicolons};
use oxc_formatter_core::{IndentStyle, IndentWidth, LineWidth};
use std::borrow::Cow;
use std::path::Path;

const IGNORE_NODE: &str = "imp-fmt-ignore";
const IGNORE_FILE: &str = "imp-fmt-ignore-file";
const SCRIPT_IGNORE_NODE: &str = "oxfmt-ignore";

pub const FMT_EXTENSIONS: &[&str] = &[
    "js", "mjs", "cjs", "json", "jsonc", "md", "markdown", "css", "scss", "sass", "less", "html",
    "svg", "xml", "sql", "yaml", "yml",
];

pub struct Formatter {
    script: JsFormatOptions,
    json: dprint_plugin_json::configuration::Configuration,
    markdown: dprint_plugin_markdown::configuration::Configuration,
    css: malva::config::FormatOptions,
    markup: markup_fmt::config::FormatOptions,
    yaml: pretty_yaml::config::FormatOptions,
    sql: lax_sql::configuration::Configuration,
    line_width: u32,
}

fn number(config: &Config, key: &str) -> Option<f64> {
    get_path(config, &["fmt", key]).and_then(|value| value.as_f64())
}

fn boolean(config: &Config, key: &str) -> Option<bool> {
    get_path(config, &["fmt", key]).and_then(|value| value.as_bool())
}

impl Formatter {
    pub fn new(config: &Config) -> Formatter {
        let line_width = number(config, "lineWidth").unwrap_or(100.0) as u32;
        let indent_width = number(config, "indentWidth").unwrap_or(2.0) as u8;
        let use_tabs = boolean(config, "useTabs").unwrap_or(false);
        let single_quote = boolean(config, "singleQuote").unwrap_or(true);
        let semicolons = boolean(config, "semiColons").unwrap_or(false);

        let script = JsFormatOptions {
            indent_style: if use_tabs {
                IndentStyle::Tab
            } else {
                IndentStyle::Space
            },
            indent_width: IndentWidth::try_from(indent_width).unwrap_or_default(),
            line_width: script_line_width(line_width),
            quote_style: if single_quote {
                QuoteStyle::Single
            } else {
                QuoteStyle::Double
            },
            semicolons: if semicolons {
                Semicolons::Always
            } else {
                Semicolons::AsNeeded
            },
            operator_position: OperatorPosition::Start,
            ..JsFormatOptions::default()
        };
        let json = dprint_plugin_json::configuration::ConfigurationBuilder::new()
            .line_width(line_width)
            .indent_width(indent_width)
            .use_tabs(use_tabs)
            .ignore_node_comment_text(IGNORE_NODE)
            .build();
        let markdown = dprint_plugin_markdown::configuration::ConfigurationBuilder::new()
            .line_width(line_width)
            .ignore_directive(IGNORE_NODE)
            .ignore_file_directive(IGNORE_FILE)
            .ignore_start_directive("imp-fmt-ignore-start")
            .ignore_end_directive("imp-fmt-ignore-end")
            .build();
        let mut css = malva::config::FormatOptions::default();
        css.layout.print_width = line_width as usize;
        css.layout.indent_width = indent_width as usize;
        css.layout.use_tabs = use_tabs;
        css.language.quotes = if single_quote {
            malva::config::Quotes::PreferSingle
        } else {
            malva::config::Quotes::PreferDouble
        };
        css.language.operator_linebreak = malva::config::OperatorLineBreak::Before;
        css.language.linebreak_in_pseudo_parens = true;
        css.language.ignore_comment_directive = IGNORE_NODE.into();
        css.language.ignore_file_comment_directive = IGNORE_FILE.into();
        let mut markup = markup_fmt::config::FormatOptions::default();
        markup.layout.print_width = line_width as usize;
        markup.layout.indent_width = indent_width as usize;
        markup.layout.use_tabs = use_tabs;
        markup.language.doctype_keyword_case = markup_fmt::config::DoctypeKeywordCase::Ignore;
        markup.language.ignore_comment_directive = IGNORE_NODE.into();
        markup.language.ignore_file_comment_directive = IGNORE_FILE.into();
        let mut yaml = pretty_yaml::config::FormatOptions::default();
        yaml.layout.print_width = line_width as usize;
        yaml.layout.indent_width = indent_width as usize;
        yaml.language.ignore_comment_directive = IGNORE_NODE.into();
        let mut sql =
            lax_sql::configuration::resolve_config(Default::default(), &Default::default()).config;
        sql.line_width = line_width;
        sql.indent_width = indent_width;
        sql.use_tabs = use_tabs;
        Formatter {
            script,
            json,
            markdown,
            css,
            markup,
            yaml,
            sql,
            line_width,
        }
    }

    fn format_script(&self, extension: &str, text: &str, line_width: u32) -> Result<String> {
        let source_type =
            SourceType::from_extension(extension).map_err(|error| anyhow!("{error}"))?;
        let mut source = Cow::Borrowed(text);
        let mut renamed_ignore = false;
        if text.contains(IGNORE_NODE) {
            let directives = ScriptDirectives::scan(text, source_type);
            if directives.ignore_file {
                return Ok(text.to_string());
            }
            if let Some(renamed) = directives.rename(text, IGNORE_NODE, SCRIPT_IGNORE_NODE) {
                source = Cow::Owned(renamed);
                renamed_ignore = true;
            }
        }
        let options = JsFormatOptions {
            line_width: script_line_width(line_width),
            ..self.script.clone()
        };
        let allocator = Allocator::default();
        let formatted = oxc_formatter::format(&allocator, &source, source_type, options)
            .map_err(|error| anyhow!("{error}"))?
            .print()
            .map_err(|error| anyhow!("{error}"))?
            .into_code();
        if !renamed_ignore {
            return Ok(formatted);
        }
        let directives = ScriptDirectives::scan(&formatted, source_type);
        Ok(directives
            .rename(&formatted, SCRIPT_IGNORE_NODE, IGNORE_NODE)
            .unwrap_or(formatted))
    }

    fn format_css(&self, text: &str, extension: &str) -> Result<String> {
        let syntax = match extension {
            "scss" => malva::Syntax::Scss,
            "sass" => malva::Syntax::Sass,
            "less" => malva::Syntax::Less,
            _ => malva::Syntax::Css,
        };
        malva::format_text(text, syntax, &self.css).map_err(|error| anyhow!("{error}"))
    }

    fn format_embedded<'a>(
        &self,
        text: &'a str,
        extension: &str,
        print_width: usize,
    ) -> Cow<'a, str> {
        let path = Path::new("embedded").with_extension(extension);
        let formatted = match extension {
            "js" | "mjs" | "cjs" | "ts" | "jsx" | "tsx" => {
                self.format_script(extension, text, print_width as u32).ok()
            }
            "css" | "scss" | "sass" | "less" => {
                let mut options = self.css.clone();
                options.layout.print_width = print_width;
                let syntax = match extension {
                    "scss" => malva::Syntax::Scss,
                    "sass" => malva::Syntax::Sass,
                    "less" => malva::Syntax::Less,
                    _ => malva::Syntax::Css,
                };
                malva::format_text(text, syntax, &options).ok()
            }
            "json" | "jsonc" => dprint_plugin_json::format_text(&path, text, &self.json)
                .ok()
                .flatten(),
            _ => None,
        };
        match formatted {
            Some(formatted) => Cow::Owned(formatted),
            None => Cow::Borrowed(text),
        }
    }

    fn code_block_extension(tag: &str) -> Option<&'static str> {
        Some(match tag.trim().to_lowercase().as_str() {
            "js" | "javascript" | "mjs" | "cjs" => "js",
            "ts" | "typescript" => "ts",
            "jsx" => "jsx",
            "tsx" => "tsx",
            "json" => "json",
            "jsonc" => "jsonc",
            "css" => "css",
            "scss" => "scss",
            "less" => "less",
            "html" => "html",
            "yaml" | "yml" => "yaml",
            _ => return None,
        })
    }

    pub fn format(&self, path: &Path, text: &str) -> Result<String> {
        let extension = crate::paths::extension(path);
        let formatted = match extension.as_str() {
            "js" | "mjs" | "cjs" => Some(self.format_script(&extension, text, self.line_width)?),
            "json" | "jsonc" => dprint_plugin_json::format_text(path, text, &self.json)
                .map_err(|error| anyhow!("{error}"))?,
            "md" | "markdown" => {
                dprint_plugin_markdown::format_text(text, &self.markdown, |tag, code, width| {
                    let Some(extension) = Self::code_block_extension(tag) else {
                        return Ok(None);
                    };
                    let formatted = self.format_embedded(code, extension, width as usize);
                    Ok(if formatted == code {
                        None
                    } else {
                        Some(formatted.into_owned())
                    })
                })
                .map_err(|error| anyhow!("{error}"))?
            }
            "css" | "scss" | "sass" | "less" => Some(self.format_css(text, &extension)?),
            "html" | "svg" | "xml" => {
                let language = if extension == "html" {
                    markup_fmt::Language::Html
                } else {
                    markup_fmt::Language::Xml
                };
                Some(
                    markup_fmt::format_text(text, language, &self.markup, |code, hints| {
                        Ok::<_, anyhow::Error>(self.format_embedded(
                            code,
                            hints.ext,
                            hints.print_width,
                        ))
                    })
                    .map_err(|error| anyhow!("{error:?}"))?,
                )
            }
            "yaml" | "yml" => Some(
                pretty_yaml::format_text(text, &self.yaml).map_err(|error| anyhow!("{error}"))?,
            ),
            "sql" => {
                lax_sql::format_text(path, text, &self.sql).map_err(|error| anyhow!("{error}"))?
            }
            _ => None,
        };
        Ok(formatted.unwrap_or_else(|| text.to_string()))
    }
}

fn script_line_width(line_width: u32) -> LineWidth {
    LineWidth::try_from(line_width.min(u32::from(LineWidth::MAX)) as u16).unwrap_or_default()
}

struct ScriptDirectives {
    ignore_file: bool,
    comment_bodies: Vec<(usize, usize)>,
}

impl ScriptDirectives {
    fn scan(text: &str, source_type: SourceType) -> ScriptDirectives {
        let allocator = Allocator::default();
        let program = Parser::new(&allocator, text, source_type).parse().program;
        let first_code = program
            .directives
            .first()
            .map(|directive| directive.span.start)
            .or_else(|| program.body.first().map(|statement| statement.span().start))
            .unwrap_or(u32::MAX);
        let mut ignore_file = false;
        let mut comment_bodies = Vec::new();
        for comment in &program.comments {
            let body = comment.content_span();
            let (start, end) = (body.start as usize, body.end as usize);
            if comment.span.start < first_code && text[start..end].trim() == IGNORE_FILE {
                ignore_file = true;
            }
            comment_bodies.push((start, end));
        }
        ScriptDirectives {
            ignore_file,
            comment_bodies,
        }
    }

    fn rename(&self, text: &str, from: &str, to: &str) -> Option<String> {
        let mut renamed = String::with_capacity(text.len());
        let mut copied = 0;
        for &(start, end) in &self.comment_bodies {
            let body = &text[start..end];
            if body.trim() != from {
                continue;
            }
            let marker = start + body.find(from).unwrap_or(0);
            renamed.push_str(&text[copied..marker]);
            renamed.push_str(to);
            copied = marker + from.len();
        }
        if copied == 0 {
            return None;
        }
        renamed.push_str(&text[copied..]);
        Some(renamed)
    }
}

fn line_diff(before: &str, after: &str) -> String {
    let before_lines: Vec<&str> = before.split('\n').collect();
    let after_lines: Vec<&str> = after.split('\n').collect();
    let mut lines = Vec::new();
    for index in 0..before_lines.len().max(after_lines.len()) {
        if before_lines.get(index) == after_lines.get(index) {
            continue;
        }
        if let Some(line) = before_lines.get(index) {
            lines.push(format!("{} | -{line}", index + 1));
        }
        if let Some(line) = after_lines.get(index) {
            lines.push(format!("{} | +{line}", index + 1));
        }
    }
    lines.join("\n")
}

fn file_count(count: usize) -> String {
    format!("{count} {}", if count == 1 { "file" } else { "files" })
}

pub fn fmt(root: &Path, paths: &[String], check: bool) -> Result<i32> {
    let config = load_imp_config(root)?;
    let exclude = get_strings(&config, &["fmt", "exclude"]);
    let files = collect_files(Collect {
        root,
        paths,
        extensions: FMT_EXTENSIONS,
        exclude: &exclude,
    })?;
    let formatter = Formatter::new(&config);
    let mut changed = 0;
    let mut failed = 0;
    for file in &files {
        let original = std::fs::read_to_string(file)?;
        let formatted = match formatter.format(file, &original) {
            Ok(formatted) => formatted,
            Err(error) => {
                failed += 1;
                let reason = error.to_string();
                eprintln!(
                    "error formatting {}: {}",
                    relative_posix(root, file),
                    reason.lines().next().unwrap_or("")
                );
                continue;
            }
        };
        if formatted == original {
            continue;
        }
        changed += 1;
        if check {
            eprintln!("\nfrom {}:", relative_posix(root, file));
            eprintln!("{}", line_diff(&original, &formatted));
        } else {
            std::fs::write(file, &formatted)?;
            println!("{}", relative_posix(root, file));
        }
    }
    if check && changed > 0 {
        eprintln!(
            "\nerror: Found {changed} not formatted {} in {}",
            if changed == 1 { "file" } else { "files" },
            file_count(files.len())
        );
        return Ok(1);
    }
    eprintln!("Checked {}", file_count(files.len()));
    Ok(if failed > 0 { 1 } else { 0 })
}
