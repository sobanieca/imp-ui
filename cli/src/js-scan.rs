fn is_ident_char(char: Option<u8>) -> bool {
    char.is_some_and(|char| char.is_ascii_alphanumeric() || char == b'_' || char == b'$')
}

pub fn skip_string_literal(source: &[u8], mut index: usize) -> usize {
    let quote = source[index];
    index += 1;
    while index < source.len() {
        let char = source[index];
        if char == b'\\' {
            index += 2;
            continue;
        }
        if quote == b'`' && char == b'$' && source.get(index + 1) == Some(&b'{') {
            index += 2;
            let mut depth = 1;
            while index < source.len() && depth > 0 {
                let inner = source[index];
                if inner == b'{' {
                    depth += 1;
                } else if inner == b'}' {
                    depth -= 1;
                } else if matches!(inner, b'"' | b'\'' | b'`') {
                    index = skip_string_literal(source, index);
                    continue;
                }
                index += 1;
            }
            continue;
        }
        if char == quote {
            return index + 1;
        }
        index += 1;
    }
    source.len()
}

fn skip_comment(source: &[u8], index: usize) -> Option<usize> {
    if source[index] != b'/' {
        return None;
    }
    match source.get(index + 1) {
        Some(b'/') => {
            let mut cursor = index;
            while cursor < source.len() && source[cursor] != b'\n' {
                cursor += 1;
            }
            Some(cursor)
        }
        Some(b'*') => {
            let mut cursor = index + 2;
            while cursor < source.len()
                && !(source[cursor] == b'*' && source.get(cursor + 1) == Some(&b'/'))
            {
                cursor += 1;
            }
            Some(cursor + 2)
        }
        _ => None,
    }
}

fn first_top_level_comma(source: &[u8]) -> Option<usize> {
    let mut depth: i32 = 0;
    let mut index = 0;
    while index < source.len() {
        if let Some(next) = skip_comment(source, index) {
            index = next;
            continue;
        }
        let char = source[index];
        if matches!(char, b'"' | b'\'' | b'`') {
            index = skip_string_literal(source, index);
            continue;
        }
        if b"([{".contains(&char) {
            depth += 1;
        } else if b")]}".contains(&char) {
            depth -= 1;
        } else if char == b',' && depth == 0 {
            return Some(index);
        }
        index += 1;
    }
    None
}

pub fn split_first_argument(argument_source: &str) -> (String, String) {
    match first_top_level_comma(argument_source.as_bytes()) {
        None => (argument_source.to_string(), String::new()),
        Some(comma) => (
            argument_source[..comma].to_string(),
            argument_source[comma + 1..].trim().to_string(),
        ),
    }
}

pub fn parse_string_literal(text: &str) -> Option<String> {
    let trimmed = text.trim();
    let quote = trimmed.chars().next()?;
    if matches!(quote, '"' | '\'' | '`') && trimmed.len() >= 2 && trimmed.ends_with(quote) {
        let inner = &trimmed[1..trimmed.len() - 1];
        let json = format!("\"{}\"", inner.replace("\\'", "'").replace('"', "\\\""));
        return Some(serde_json::from_str::<String>(&json).unwrap_or_else(|_| inner.to_string()));
    }
    None
}

pub struct Call {
    pub start: usize,
    pub end: usize,
    pub argument_source: String,
}

fn parse_call_arguments(source: &[u8], paren: usize) -> Option<(String, usize)> {
    let start = paren + 1;
    let mut index = start;
    let mut depth = 0;
    while index < source.len() {
        if let Some(next) = skip_comment(source, index) {
            index = next;
            continue;
        }
        let char = source[index];
        if matches!(char, b'"' | b'\'' | b'`') {
            index = skip_string_literal(source, index);
            continue;
        }
        if b"([{".contains(&char) {
            depth += 1;
        } else if b")]}".contains(&char) {
            if depth == 0 && char == b')' {
                return Some((
                    String::from_utf8_lossy(&source[start..index]).into_owned(),
                    index + 1,
                ));
            }
            depth -= 1;
        }
        index += 1;
    }
    None
}

pub fn extract_calls(source: &str, function_name: &str) -> Vec<Call> {
    let bytes = source.as_bytes();
    let mut calls = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        if let Some(next) = skip_comment(bytes, index) {
            index = next;
            continue;
        }
        let char = bytes[index];
        if matches!(char, b'"' | b'\'' | b'`') {
            index = skip_string_literal(bytes, index);
            continue;
        }
        if is_ident_char(Some(char)) && !(index > 0 && is_ident_char(Some(bytes[index - 1]))) {
            let mut end = index;
            while end < bytes.len() && is_ident_char(Some(bytes[end])) {
                end += 1;
            }
            if &source[index..end] == function_name {
                let mut cursor = end;
                while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                    cursor += 1;
                }
                if bytes.get(cursor) == Some(&b'(')
                    && let Some((argument_source, call_end)) = parse_call_arguments(bytes, cursor)
                {
                    calls.push(Call {
                        start: index,
                        end: call_end,
                        argument_source,
                    });
                    index = call_end;
                    continue;
                }
            }
            index = end;
            continue;
        }
        index += 1;
    }
    calls
}
