#[derive(Debug, Clone)]
pub struct Attribute {
    pub name: String,
    pub value: String,
    pub value_range: Option<(usize, usize)>,
    pub line: usize,
}

#[derive(Debug, Clone)]
pub struct UrlAttribute {
    pub name: String,
    pub value: String,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone)]
pub struct Script {
    pub attributes: Vec<(String, String)>,
    pub src: Option<String>,
    pub kind: Option<String>,
    pub text: String,
    pub start: usize,
    pub end: usize,
    pub line_offset: usize,
    pub element: (usize, usize),
    pub src_attribute: Option<UrlAttribute>,
}

#[derive(Debug, Clone)]
pub struct InlineCode {
    pub line: usize,
    pub construct: String,
    pub advice: &'static str,
}

#[derive(Debug, Clone)]
pub struct HeadInsertion {
    pub offset: usize,
    pub wrap: bool,
    pub after_doctype_or_html: bool,
    pub at_start: bool,
}

#[derive(Debug, Clone)]
pub struct Document {
    pub scripts: Vec<Script>,
    pub url_attributes: Vec<UrlAttribute>,
    pub inline_code: Vec<InlineCode>,
    pub title: Option<(usize, usize)>,
    pub head: HeadInsertion,
    pub body_end: usize,
}

pub struct Edit {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

pub fn is_javascript_type(kind: Option<&str>) -> bool {
    matches!(kind, None | Some("") | Some("module") | Some("text/javascript"))
}

pub fn is_module_type(kind: Option<&str>) -> bool {
    kind == Some("module")
}

pub fn is_local_script_source(src: &str) -> bool {
    let scheme = src.find(':').is_some_and(|colon| {
        let prefix = &src[..colon];
        !prefix.is_empty()
            && prefix.chars().next().is_some_and(|char| char.is_ascii_alphabetic())
            && prefix.chars().all(|char| char.is_ascii_alphanumeric() || matches!(char, '+' | '.' | '-'))
    });
    !scheme && !src.starts_with("//")
}

const RAW_TEXT: [&str; 9] = ["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"];
const VOID: [&str; 14] = [
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "param",
];
const URL_ATTRIBUTES: [&str; 3] = ["href", "src", "poster"];
const SRCSET_ATTRIBUTES: [&str; 2] = ["srcset", "imagesrcset"];
const URL_META_NAMES: [&str; 4] = ["og:image", "og:image:url", "og:image:secure_url", "twitter:image"];
const SCRIPT_URL_ATTRIBUTES: [&str; 4] = ["href", "src", "action", "formaction"];

struct Tag {
    name: String,
    start: usize,
    end: usize,
    attributes: Vec<Attribute>,
    line: usize,
    self_closing: bool,
}

fn decode_entities(text: &str) -> String {
    if !text.contains('&') {
        return text.to_string();
    }
    let mut out = String::new();
    let mut rest = text;
    while let Some(index) = rest.find('&') {
        out.push_str(&rest[..index]);
        let after = &rest[index + 1..];
        let end = after.find(';').filter(|end| *end <= 10);
        let decoded = end.and_then(|end| {
            let entity = &after[..end];
            let value = match entity {
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "quot" => Some('"'),
                "apos" => Some('\''),
                "nbsp" => Some('\u{a0}'),
                _ if entity.starts_with("#x") || entity.starts_with("#X") => {
                    u32::from_str_radix(&entity[2..], 16).ok().and_then(char::from_u32)
                }
                _ if entity.starts_with('#') => entity[1..].parse().ok().and_then(char::from_u32),
                _ => None,
            };
            value.map(|value| (value, end))
        });
        match decoded {
            Some((value, end)) => {
                out.push(value);
                rest = &after[end + 1..];
            }
            None => {
                out.push('&');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

struct Scanner<'a> {
    source: &'a str,
    bytes: &'a [u8],
    line_starts: Vec<usize>,
}

impl<'a> Scanner<'a> {
    fn new(source: &'a str) -> Scanner<'a> {
        let mut line_starts = vec![0];
        for (index, byte) in source.bytes().enumerate() {
            if byte == b'\n' {
                line_starts.push(index + 1);
            }
        }
        Scanner { source, bytes: source.as_bytes(), line_starts }
    }

    fn line_of(&self, offset: usize) -> usize {
        match self.line_starts.binary_search(&offset) {
            Ok(index) => index + 1,
            Err(index) => index,
        }
    }

    fn parse_tag(&self, start: usize) -> Option<Tag> {
        let bytes = self.bytes;
        let mut index = start + 1;
        let name_start = index;
        while index < bytes.len() && !bytes[index].is_ascii_whitespace() && bytes[index] != b'>' && bytes[index] != b'/' {
            index += 1;
        }
        let name = self.source[name_start..index].to_ascii_lowercase();
        if name.is_empty() || !name.as_bytes()[0].is_ascii_alphabetic() {
            return None;
        }
        let mut attributes = Vec::new();
        let mut self_closing = false;
        loop {
            while index < bytes.len() && (bytes[index].is_ascii_whitespace() || bytes[index] == b'/') {
                if bytes[index] == b'/' && bytes.get(index + 1) == Some(&b'>') {
                    self_closing = true;
                }
                index += 1;
            }
            if index >= bytes.len() {
                return Some(Tag { name, start, end: bytes.len(), attributes, line: self.line_of(start), self_closing });
            }
            if bytes[index] == b'>' {
                return Some(Tag { name, start, end: index + 1, attributes, line: self.line_of(start), self_closing });
            }
            let attribute_start = index;
            while index < bytes.len()
                && !bytes[index].is_ascii_whitespace()
                && !matches!(bytes[index], b'=' | b'>')
                && !(bytes[index] == b'/' && bytes.get(index + 1) == Some(&b'>'))
            {
                index += 1;
            }
            let attribute_name = self.source[attribute_start..index].to_string();
            let mut cursor = index;
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            let mut value = String::new();
            let mut value_range = None;
            if bytes.get(cursor) == Some(&b'=') {
                cursor += 1;
                while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                    cursor += 1;
                }
                if let Some(&quote @ (b'"' | b'\'')) = bytes.get(cursor) {
                    let value_start = cursor + 1;
                    let value_end = self.source[value_start..].find(quote as char).map_or(bytes.len(), |end| value_start + end);
                    value = decode_entities(&self.source[value_start..value_end]);
                    value_range = Some((value_start, value_end));
                    index = (value_end + 1).min(bytes.len());
                } else {
                    let value_start = cursor;
                    while cursor < bytes.len() && !bytes[cursor].is_ascii_whitespace() && bytes[cursor] != b'>' {
                        cursor += 1;
                    }
                    value = decode_entities(&self.source[value_start..cursor]);
                    value_range = Some((value_start, cursor));
                    index = cursor;
                }
            }
            if !attribute_name.is_empty() && !attributes.iter().any(|existing: &Attribute| existing.name.eq_ignore_ascii_case(&attribute_name)) {
                attributes.push(Attribute { name: attribute_name, value, value_range, line: self.line_of(attribute_start) });
            }
        }
    }
}

fn srcset_candidates(text: &str) -> Vec<(usize, String)> {
    let bytes = text.as_bytes();
    let mut candidates = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        while index < bytes.len() && (bytes[index].is_ascii_whitespace() || bytes[index] == b',') {
            index += 1;
        }
        let start = index;
        while index < bytes.len() && !bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        let url = &text[start..index];
        if url.is_empty() {
            break;
        }
        let trimmed = url.trim_end_matches(',');
        candidates.push((start, trimmed.to_string()));
        if trimmed != url {
            continue;
        }
        let mut depth = 0i32;
        while index < bytes.len() {
            let char = bytes[index];
            index += 1;
            if char == b'(' {
                depth += 1;
            } else if char == b')' {
                depth -= 1;
            } else if char == b',' && depth <= 0 {
                break;
            }
        }
    }
    candidates
}

fn attribute<'t>(tag: &'t Tag, name: &str) -> Option<&'t Attribute> {
    tag.attributes.iter().find(|attribute| attribute.name.eq_ignore_ascii_case(name))
}

fn url_attributes_of(source: &str, tag: &Tag) -> Vec<UrlAttribute> {
    let meta_url = tag.name == "meta" && {
        let name = attribute(tag, "property").or_else(|| attribute(tag, "name")).map(|attribute| attribute.value.to_lowercase());
        name.is_some_and(|name| URL_META_NAMES.contains(&name.as_str()))
    };
    let mut found = Vec::new();
    for attribute in &tag.attributes {
        let lower = attribute.name.to_lowercase();
        let is_srcset = SRCSET_ATTRIBUTES.contains(&lower.as_str());
        let holds_url = URL_ATTRIBUTES.contains(&lower.as_str()) || (lower == "content" && meta_url);
        if !is_srcset && !holds_url {
            continue;
        }
        let Some((start, end)) = attribute.value_range else { continue };
        if !is_srcset {
            found.push(UrlAttribute { name: attribute.name.clone(), value: attribute.value.clone(), start, end });
            continue;
        }
        for (offset, value) in srcset_candidates(&source[start..end]) {
            let begin = start + offset;
            found.push(UrlAttribute { name: attribute.name.clone(), end: begin + value.len(), value, start: begin });
        }
    }
    found
}

fn inline_code_of(tag: &Tag, text: Option<&str>) -> Vec<InlineCode> {
    let mut found = Vec::new();
    if tag.name == "style" {
        found.push(InlineCode { line: tag.line, construct: "a <style> element".into(), advice: "move the CSS into a file in public/" });
    }
    if tag.name == "script" {
        let kind = attribute(tag, "type").map(|attribute| attribute.value.to_lowercase());
        if attribute(tag, "src").is_none()
            && is_javascript_type(kind.as_deref())
            && !is_module_type(kind.as_deref())
            && text.is_some_and(|text| !text.trim().is_empty())
        {
            found.push(InlineCode { line: tag.line, construct: "an inline classic <script>".into(), advice: "move the code into a module" });
        }
    }
    for attribute in &tag.attributes {
        let lower = attribute.name.to_lowercase();
        if lower.starts_with("on") && lower.len() > 2 {
            found.push(InlineCode {
                line: attribute.line,
                construct: format!("an inline event handler {lower}="),
                advice: "add the listener in a module",
            });
        } else if lower == "style" {
            found.push(InlineCode { line: attribute.line, construct: "a style attribute".into(), advice: "move the style into a CSS file in public/" });
        } else if SCRIPT_URL_ATTRIBUTES.contains(&lower.as_str()) && attribute.value.trim_start().to_lowercase().starts_with("javascript:") {
            found.push(InlineCode {
                line: attribute.line,
                construct: format!("a javascript: URL in {lower}="),
                advice: "handle the event in a module",
            });
        }
    }
    found
}

const HEAD_ELEMENTS: [&str; 8] = ["meta", "title", "link", "style", "script", "base", "noscript", "template"];

pub fn read_html(source: &str) -> Document {
    let scanner = Scanner::new(source);
    let bytes = source.as_bytes();
    let mut scripts = Vec::new();
    let mut url_attributes = Vec::new();
    let mut inline_code = Vec::new();
    let mut title = None;
    let mut template_depth = 0usize;
    let mut doctype_end = None;
    let mut html_start_end = None;
    let mut head_start_end = None;
    let mut head_closed = false;
    let mut in_body = false;
    let mut charset_end = None;
    let mut body_end_tag = None;
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'<' {
            index += 1;
            continue;
        }
        if source[index..].starts_with("<!--") {
            index = source[index + 4..].find("-->").map_or(bytes.len(), |end| index + 4 + end + 3);
            continue;
        }
        if source[index..].starts_with("<!") || source[index..].starts_with("<?") {
            let end = source[index..].find('>').map_or(bytes.len(), |end| index + end + 1);
            if source[index..].to_ascii_lowercase().starts_with("<!doctype") {
                doctype_end = Some(end);
            }
            index = end;
            continue;
        }
        if bytes.get(index + 1) == Some(&b'/') {
            let end = source[index..].find('>').map_or(bytes.len(), |end| index + end + 1);
            let name: String = source[index + 2..end.saturating_sub(1)]
                .trim()
                .chars()
                .take_while(|char| !char.is_whitespace())
                .collect::<String>()
                .to_ascii_lowercase();
            match name.as_str() {
                "template" => template_depth = template_depth.saturating_sub(1),
                "head" => head_closed = true,
                "body" if body_end_tag.is_none() => body_end_tag = Some(index),
                _ => {}
            }
            index = end;
            continue;
        }
        let Some(tag) = scanner.parse_tag(index) else {
            index += 1;
            continue;
        };
        let mut content: Option<(usize, usize)> = None;
        let mut next = tag.end;
        if RAW_TEXT.contains(&tag.name.as_str()) && !tag.self_closing {
            let closing = format!("</{}", tag.name);
            let lower_rest = source[tag.end..].to_ascii_lowercase();
            let end = lower_rest.find(&closing).map_or(bytes.len(), |end| tag.end + end);
            content = Some((tag.end, end));
            next = source[end..].find('>').map_or(bytes.len(), |close| end + close + 1);
        }
        match tag.name.as_str() {
            "html" if html_start_end.is_none() => html_start_end = Some(tag.end),
            "head" if head_start_end.is_none() => head_start_end = Some(tag.end),
            "body" => in_body = true,
            "template" if !tag.self_closing => template_depth += 1,
            name if !in_body && !head_closed && !HEAD_ELEMENTS.contains(&name) && name != "html" => in_body = true,
            _ => {}
        }
        if tag.name == "meta" && !in_body && charset_end.is_none() && attribute(&tag, "charset").is_some() {
            charset_end = Some(tag.end);
        }
        let urls = url_attributes_of(source, &tag);
        let text = content.map(|(start, end)| &source[start..end]);
        inline_code.extend(inline_code_of(&tag, text));
        if tag.name == "script" && template_depth == 0 {
            let (start, end) = content.unwrap_or((tag.end, tag.end));
            let attributes: Vec<(String, String)> =
                tag.attributes.iter().map(|attribute| (attribute.name.to_lowercase(), attribute.value.clone())).collect();
            scripts.push(Script {
                src: attribute(&tag, "src").map(|attribute| attribute.value.clone()),
                kind: attribute(&tag, "type").map(|attribute| attribute.value.to_lowercase()),
                text: source[start..end].to_string(),
                start,
                end,
                line_offset: scanner.line_of(start) - 1,
                element: (tag.start, next),
                src_attribute: urls.iter().find(|url| url.name.eq_ignore_ascii_case("src")).cloned(),
                attributes,
            });
        }
        if tag.name == "title" && title.is_none() {
            title = Some((tag.start, next));
        }
        url_attributes.extend(urls);
        let _ = VOID;
        index = next;
    }
    let head = if let Some(offset) = charset_end {
        HeadInsertion { offset, wrap: false, after_doctype_or_html: false, at_start: false }
    } else if let Some(offset) = head_start_end {
        HeadInsertion { offset, wrap: false, after_doctype_or_html: false, at_start: false }
    } else if let Some(offset) = html_start_end {
        HeadInsertion { offset, wrap: true, after_doctype_or_html: true, at_start: false }
    } else if let Some(offset) = doctype_end {
        HeadInsertion { offset, wrap: true, after_doctype_or_html: true, at_start: false }
    } else {
        HeadInsertion { offset: 0, wrap: true, after_doctype_or_html: false, at_start: true }
    };
    Document { scripts, url_attributes, inline_code, title, head, body_end: body_end_tag.unwrap_or(source.len()) }
}

pub fn apply_edits(source: &str, edits: &mut [Edit]) -> String {
    edits.sort_by(|a, b| b.start.cmp(&a.start).then(b.end.cmp(&a.end)));
    let mut result = source.to_string();
    for edit in edits.iter() {
        result.replace_range(edit.start..edit.end, &edit.text);
    }
    result
}

pub fn head_edit(document: &Document, tags: &str) -> Edit {
    let head = &document.head;
    let text = if head.at_start {
        format!("<head>{tags}</head>\n")
    } else if head.wrap {
        format!("\n<head>{tags}</head>")
    } else {
        format!("\n{tags}")
    };
    Edit { start: head.offset, end: head.offset, text }
}
