import { languageNameOf, languageSpec } from './code-languages.js'

const NUMBER =
  /^(?:\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?|0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[a-zA-Z%]*)/

const OPERATOR =
  /^(?:=>|->|<-|::|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\?\.|\+\+|--|\*\*|<<|>>>|>>|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\|>|[-+*/%=<>!&|^~?:])/

const PUNCTUATION = /^[()[\]{},;.]/

const WHITESPACE = /^[ \t\r\f\v]+/

const DECORATOR = /^@[\p{L}_][\p{L}\p{N}_.]*/u

const FLAG = /^--?[\p{L}][\p{L}\p{N}_-]*/u

const DIRECTIVE = /^#\s*[a-z]+/

const REGEX_LITERAL = /^\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[a-z]*/

const IDENTIFIER_TAIL = /[\p{L}\p{N}_$]$/u

const UPPERCASE_START = /^\p{Lu}/u

const TRIPLE_QUOTES = ['"""', "'''"]

const LINE_START_MARKERS = new Set(['-'])

const KEY_OPENERS = new Set(['{', ','])

const CLOSING_BRACKETS = new Set([')', ']'])

const createEmitter = () => {
  const lines = [[]]
  let last = null
  let lineHasContent = false
  const pushPart = (type, part) => {
    if (part === '') return
    const line = lines.at(-1)
    const previous = line.at(-1)
    if (type === null && previous !== undefined && previous.type === null) previous.text += part
    else line.push({ type, text: part })
  }
  const emit = (type, text, shown = true) => {
    if (text === '') return
    const parts = text.split('\n')
    parts.forEach((part, index) => {
      if (index > 0) {
        lines.push([])
        lineHasContent = false
      }
      pushPart(shown ? type : null, part)
    })
    if (WHITESPACE.test(text) && text.trim() === '') return
    if (text === '\n') return
    last = { type, text }
    if (!(LINE_START_MARKERS.has(text) && !lineHasContent)) lineHasContent = true
  }
  return {
    emit,
    lines,
    lastToken: () => last,
    atKeyPosition: () => !lineHasContent || (last !== null && KEY_OPENERS.has(last.text)),
  }
}

const nextNonSpace = (source, from) => {
  let index = from
  while (index < source.length && (source[index] === ' ' || source[index] === '\t')) index++
  return index
}

const findEnd = (source, from, closer) => {
  const index = source.indexOf(closer, from)
  return index === -1 ? source.length : index + closer.length
}

const lineEnd = (source, from) => {
  const index = source.indexOf('\n', from)
  return index === -1 ? source.length : index
}

const quotedEnd = (source, start, quote, multiline) => {
  let index = start + quote.length
  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (source.startsWith(quote, index)) return index + quote.length
    if (char === '\n' && !multiline) return index
    index++
  }
  return source.length
}

const regexAllowedAfter = (last) =>
  last === null || last.type === 'keyword' || last.type === 'operator' ||
  (last.type === 'punctuation' && !CLOSING_BRACKETS.has(last.text))

const followsKeyValue = (source, from, keyValue) => {
  const index = nextNonSpace(source, from)
  if (source[index] !== keyValue) return false
  const after = source[index + 1]
  return after !== keyValue && !(keyValue === '=' && after === '>') && after !== ':'
}

const classifyWord = (source, text, end, spec, emitter) => {
  const word = spec.caseInsensitive ? text.toLowerCase() : text
  if (spec.keywords.has(word)) return 'keyword'
  if (spec.literals.has(word)) return 'literal'
  if (spec.types.has(word)) return 'type'
  if (spec.builtins.has(word)) return 'function'
  if (source[end] === '(') return 'function'
  if (spec.keyValue && emitter.atKeyPosition() && followsKeyValue(source, end, spec.keyValue)) {
    return 'property'
  }
  if (spec.capitalTypes && UPPERCASE_START.test(text)) return 'type'
  return null
}

const scanString = (source, index, spec, emitter) => {
  const prefix = spec.stringPrefix?.exec(source.slice(index))?.[0] ?? ''
  const start = index + prefix.length
  let end = -1
  if (spec.tripleStrings) {
    const triple = TRIPLE_QUOTES.find((quotes) => source.startsWith(quotes, start))
    if (triple) end = quotedEnd(source, start, triple, true)
  }
  if (end === -1) {
    const quote = spec.strings.find((candidate) => source[start] === candidate)
    if (quote === undefined) return index
    end = quotedEnd(source, start, quote, spec.multilineStrings.includes(quote))
  }
  const text = source.slice(index, end)
  if (spec.stringKeys && followsKeyValue(source, end, ':')) emitter.emit('property', text)
  else if (spec.variables && text.startsWith('"')) emitInterpolated(text, spec, emitter)
  else emitter.emit('string', text)
  return end
}

const emitInterpolated = (text, spec, emitter) => {
  let index = 0
  let plainFrom = 0
  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2
      continue
    }
    const variable = text[index] === '$' ? spec.variables.exec(text.slice(index))?.[0] : undefined
    if (variable === undefined) {
      index++
      continue
    }
    emitter.emit('string', text.slice(plainFrom, index))
    emitter.emit('variable', variable)
    index += variable.length
    plainFrom = index
  }
  emitter.emit('string', text.slice(plainFrom))
}

const scanGeneric = (source, spec, emitter) => {
  const { emit } = emitter
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    const char = source[index]
    if (char === '\n') {
      emit(null, '\n')
      index++
      continue
    }
    const space = WHITESPACE.exec(rest)?.[0]
    if (space) {
      emit(null, space)
      index += space.length
      continue
    }
    const extra = spec.extraTokens.find(([pattern]) => pattern.test(rest))
    if (extra) {
      const [pattern, type] = extra
      const text = pattern.exec(rest)[0]
      emit(type, text)
      index += text.length
      continue
    }
    const variable = spec.variables?.exec(rest)?.[0]
    if (variable) {
      emit('variable', variable)
      index += variable.length
      continue
    }
    const block = spec.blockComments.find(([opener]) => rest.startsWith(opener))
    if (block) {
      const end = findEnd(source, index + block[0].length, block[1])
      emit('comment', source.slice(index, end))
      index = end
      continue
    }
    if (spec.lineComments.some((marker) => rest.startsWith(marker))) {
      const end = lineEnd(source, index)
      emit('comment', source.slice(index, end))
      index = end
      continue
    }
    const afterString = scanString(source, index, spec, emitter)
    if (afterString !== index) {
      index = afterString
      continue
    }
    if (spec.regex && char === '/' && regexAllowedAfter(emitter.lastToken())) {
      const text = REGEX_LITERAL.exec(rest)?.[0]
      if (text) {
        emit('string', text)
        index += text.length
        continue
      }
    }
    if (spec.directive && char === spec.directive) {
      const text = DIRECTIVE.exec(rest)?.[0]
      if (text) {
        emit('keyword', text)
        index += text.length
        continue
      }
    }
    if (spec.decorators && char === '@') {
      const text = DECORATOR.exec(rest)?.[0]
      if (text) {
        emit('attribute', text)
        index += text.length
        continue
      }
    }
    if (spec.flags && char === '-' && (index === 0 || /\s/.test(source[index - 1]))) {
      const text = FLAG.exec(rest)?.[0]
      if (text) {
        emit('attribute', text)
        index += text.length
        continue
      }
    }
    const number = NUMBER.exec(rest)?.[0]
    if (number && (index === 0 || !IDENTIFIER_TAIL.test(source[index - 1]))) {
      emit('number', number)
      index += number.length
      continue
    }
    const word = spec.identifier.exec(rest)?.[0]
    if (word) {
      let end = index + word.length
      let type = classifyWord(source, word, end, spec, emitter)
      if (spec.macros && source[end] === '!' && /[([{]/.test(source[end + 1] ?? '')) {
        type = 'function'
        end++
      }
      emit(type, source.slice(index, end))
      index = end
      continue
    }
    const operator = OPERATOR.exec(rest)?.[0]
    if (operator) {
      emit('operator', operator, false)
      index += operator.length
      continue
    }
    const punctuation = PUNCTUATION.exec(rest)?.[0]
    if (punctuation) {
      emit('punctuation', punctuation, false)
      index += punctuation.length
      continue
    }
    emit(null, char)
    index++
  }
}

const HTML_TAG_NAME = /^[A-Za-z][\w:.-]*/

const HTML_ATTRIBUTE = /^[^\s"'=<>/]+/

const HTML_UNQUOTED_VALUE = /^[^\s>]+/

const EMBEDDED_LANGUAGES = { script: 'javascript', style: 'css' }

const scanHtml = (source, emitter, embed) => {
  const { emit } = emitter
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    if (rest.startsWith('<!--')) {
      const end = findEnd(source, index + 4, '-->')
      emit('comment', source.slice(index, end))
      index = end
      continue
    }
    if (rest.startsWith('<!') || rest.startsWith('<?')) {
      const end = findEnd(source, index + 2, '>')
      emit('keyword', source.slice(index, end))
      index = end
      continue
    }
    if (rest[0] === '<' && HTML_TAG_NAME.test(rest.slice(rest[1] === '/' ? 2 : 1))) {
      const closing = rest[1] === '/'
      const opener = closing ? '</' : '<'
      emit('punctuation', opener, false)
      index += opener.length
      const name = HTML_TAG_NAME.exec(source.slice(index))[0]
      emit('tag', name)
      index += name.length
      index = scanHtmlAttributes(source, index, emitter)
      const embedded = EMBEDDED_LANGUAGES[name.toLowerCase()]
      if (!closing && embedded) {
        const closer = new RegExp(`</${name}\\s*>`, 'i')
        const found = closer.exec(source.slice(index))
        const bodyEnd = found ? index + found.index : source.length
        embed(source.slice(index, bodyEnd), embedded)
        index = bodyEnd
      }
      continue
    }
    const next = source.indexOf('<', index + 1)
    const end = next === -1 ? source.length : next
    emit(null, source.slice(index, end))
    index = end
  }
}

const scanHtmlAttributes = (source, start, emitter) => {
  const { emit } = emitter
  let index = start
  let expectValue = false
  while (index < source.length) {
    const rest = source.slice(index)
    const space = /^\s+/.exec(rest)?.[0]
    if (space) {
      emit(null, space)
      index += space.length
      continue
    }
    if (rest.startsWith('/>') || rest.startsWith('>')) {
      const closer = rest.startsWith('/>') ? '/>' : '>'
      emit('punctuation', closer, false)
      return index + closer.length
    }
    if (rest[0] === '=') {
      emit('operator', '=', false)
      expectValue = true
      index++
      continue
    }
    if (expectValue) {
      expectValue = false
      const quote = rest[0] === '"' || rest[0] === "'" ? rest[0] : null
      const end = quote
        ? findEnd(source, index + 1, quote)
        : index + (HTML_UNQUOTED_VALUE.exec(rest)?.[0].length ?? 1)
      emit('string', source.slice(index, end))
      index = end
      continue
    }
    const name = HTML_ATTRIBUTE.exec(rest)?.[0]
    if (name) {
      emit('attribute', name)
      index += name.length
      continue
    }
    emit(null, rest[0])
    index++
  }
  return index
}

const CSS_PROPERTY = /^(--[\w-]+|-?[a-zA-Z_][\w-]*)(\s*):/

const CSS_HEX_COLOR = /^#[\da-fA-F]{3,8}\b/

const CSS_WORD = /^-?[a-zA-Z_][\w-]*/

const CSS_SELECTOR_PIECE = /^[.#%][\w-]+/

const CSS_PSEUDO = /^::?[\w-]+/

const CSS_ATTRIBUTE_SELECTOR = /^\[[^\]\n]*\]/

const cssStatementEnd = (source, from) => {
  let index = from
  let depth = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '"' || char === "'") {
      index = quotedEnd(source, index, char, false)
      continue
    }
    if (source.startsWith('/*', index)) {
      index = findEnd(source, index + 2, '*/')
      continue
    }
    if (char === '(') depth++
    else if (char === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0 && (char === ';' || char === '{' || char === '}')) return index
    index++
  }
  return source.length
}

const scanCssValue = (text, spec, emitter) => {
  const { emit } = emitter
  let index = 0
  while (index < text.length) {
    const rest = text.slice(index)
    const space = /^\s+/.exec(rest)?.[0]
    if (space) {
      emit(null, space)
      index += space.length
      continue
    }
    if (rest.startsWith('/*')) {
      const end = findEnd(text, index + 2, '*/')
      emit('comment', text.slice(index, end))
      index = end
      continue
    }
    if (spec.scss && rest.startsWith('//')) {
      const end = lineEnd(text, index)
      emit('comment', text.slice(index, end))
      index = end
      continue
    }
    const char = rest[0]
    if (char === '"' || char === "'") {
      const end = quotedEnd(text, index, char, false)
      emit('string', text.slice(index, end))
      index = end
      continue
    }
    const match = (pattern, type) => {
      const found = pattern.exec(rest)?.[0]
      if (!found) return false
      emit(type, found)
      index += found.length
      return true
    }
    if (match(CSS_HEX_COLOR, 'number')) continue
    if (match(/^!important\b/, 'keyword')) continue
    if (match(/^--[\w-]+/, 'variable')) continue
    if (spec.scss && match(/^[$@][\w-]+/, 'variable')) continue
    if (match(NUMBER, 'number')) continue
    if (rest.startsWith('url(')) {
      const end = findEnd(text, index + 4, ')')
      emit('function', 'url')
      emit(null, '(')
      emit('string', text.slice(index + 4, end - 1))
      emit(null, ')')
      index = end
      continue
    }
    const word = CSS_WORD.exec(rest)?.[0]
    if (word) {
      emit(text[index + word.length] === '(' ? 'function' : null, word)
      index += word.length
      continue
    }
    emit(null, char)
    index++
  }
}

const scanCssSelector = (text, spec, emitter) => {
  const { emit } = emitter
  let index = 0
  while (index < text.length) {
    const rest = text.slice(index)
    const space = /^\s+/.exec(rest)?.[0]
    if (space) {
      emit(null, space)
      index += space.length
      continue
    }
    if (rest.startsWith('/*')) {
      const end = findEnd(text, index + 2, '*/')
      emit('comment', text.slice(index, end))
      index = end
      continue
    }
    if (rest[0] === '@') {
      const word = /^@[\w-]+/.exec(rest)[0]
      emit('keyword', word)
      scanCssValue(text.slice(index + word.length), spec, emitter)
      return
    }
    const match = (pattern, type) => {
      const found = pattern.exec(rest)?.[0]
      if (!found) return false
      emit(type, found)
      index += found.length
      return true
    }
    if (match(CSS_SELECTOR_PIECE, 'type')) continue
    if (match(CSS_PSEUDO, 'attribute')) continue
    if (match(CSS_ATTRIBUTE_SELECTOR, 'attribute')) continue
    if (spec.scss && match(/^[$][\w-]+/, 'variable')) continue
    if (match(CSS_WORD, 'tag')) continue
    if (match(NUMBER, 'number')) continue
    emit(null, rest[0])
    index++
  }
}

const scanCssDeclaration = (text, spec, emitter) => {
  const { emit } = emitter
  const leading = /^\s*/.exec(text)[0]
  emit(null, leading)
  const body = text.slice(leading.length)
  if (body[0] === '@') {
    scanCssSelector(body, spec, emitter)
    return
  }
  const property = CSS_PROPERTY.exec(body)
  if (!property) {
    scanCssValue(body, spec, emitter)
    return
  }
  const [head, name, gap] = property
  emit(name.startsWith('--') ? 'variable' : 'property', name)
  emit(null, gap)
  emit('punctuation', ':', false)
  scanCssValue(body.slice(head.length), spec, emitter)
}

const scanCss = (source, spec, emitter) => {
  const { emit } = emitter
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    const space = /^\s+/.exec(rest)?.[0]
    if (space) {
      emit(null, space)
      index += space.length
      continue
    }
    if (rest.startsWith('/*')) {
      const end = findEnd(source, index + 2, '*/')
      emit('comment', source.slice(index, end))
      index = end
      continue
    }
    if (spec.scss && rest.startsWith('//')) {
      const end = lineEnd(source, index)
      emit('comment', source.slice(index, end))
      index = end
      continue
    }
    if (rest[0] === '}' || rest[0] === ';') {
      emit('punctuation', rest[0], false)
      index++
      continue
    }
    const end = cssStatementEnd(source, index)
    const statement = source.slice(index, end)
    if (source[end] === '{') scanCssSelector(statement, spec, emitter)
    else scanCssDeclaration(statement, spec, emitter)
    index = end
    if (source[end] === '{') {
      emit('punctuation', '{', false)
      index++
    }
  }
}

const MARKDOWN_FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/

const MARKDOWN_HEADING = /^#{1,6}(\s|$)/

const MARKDOWN_RULE = /^\s*([-*_])(\s*\1){2,}\s*$/

const MARKDOWN_LIST = /^(\s*)([-*+]|\d+[.)])(\s+)/

const MARKDOWN_QUOTE = /^(\s*>\s?)/

const MARKDOWN_INLINE = [
  [/^`+[^`\n]*`+/, 'string'],
  [/^(?:\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|\b_[^_\n]+_\b)/, 'emphasis'],
  [/^<https?:[^>\n]+>|^https?:\/\/\S+/, 'string'],
  [/^<\/?[A-Za-z][^>\n]*>/, 'tag'],
]

const MARKDOWN_LINK = /^(!?\[)([^\]\n]*)(\]\()([^)\n]*)(\))/

const scanMarkdownInline = (text, emitter) => {
  const { emit } = emitter
  let index = 0
  while (index < text.length) {
    const rest = text.slice(index)
    const link = MARKDOWN_LINK.exec(rest)
    if (link) {
      const [, open, label, middle, target, close] = link
      emit('punctuation', open)
      emit('attribute', label)
      emit('punctuation', middle)
      emit('string', target)
      emit('punctuation', close)
      index += link[0].length
      continue
    }
    const inline = MARKDOWN_INLINE.find(([pattern]) => pattern.test(rest))
    if (inline) {
      const text = inline[0].exec(rest)[0]
      emit(inline[1], text)
      index += text.length
      continue
    }
    const plain = /^[^`*_<![h]+|^./.exec(rest)[0]
    emit(null, plain)
    index += plain.length
  }
}

const scanMarkdown = (source, emitter, embed) => {
  const { emit } = emitter
  const lines = source.split('\n')
  let index = 0
  while (index < lines.length) {
    if (index > 0) emit(null, '\n')
    const line = lines[index]
    const fence = MARKDOWN_FENCE.exec(line)
    if (fence) {
      const [, indent, marker, info] = fence
      emit(null, indent)
      emit('punctuation', marker)
      emit('attribute', info)
      const closes = (candidate) => {
        const match = MARKDOWN_FENCE.exec(candidate)
        return match !== null && match[2][0] === marker[0] && match[2].length >= marker.length &&
          match[3].trim() === ''
      }
      let close = index + 1
      while (close < lines.length && !closes(lines[close])) close++
      if (close > index + 1) {
        emit(null, '\n')
        embed(lines.slice(index + 1, close).join('\n'), info.trim().split(/\s+/)[0])
      }
      if (close < lines.length) {
        emit(null, '\n')
        emit('punctuation', lines[close])
      }
      index = close + 1
      continue
    }
    if (MARKDOWN_HEADING.test(line) || MARKDOWN_RULE.test(line)) {
      emit(MARKDOWN_HEADING.test(line) ? 'title' : 'punctuation', line)
    } else {
      const quote = MARKDOWN_QUOTE.exec(line)
      const list = MARKDOWN_LIST.exec(line)
      const marker = quote?.[0] ?? list?.[0] ?? ''
      if (marker !== '') emit('punctuation', marker)
      scanMarkdownInline(line.slice(marker.length), emitter)
    }
    index++
  }
}

const DIFF_META =
  /^(?:\+\+\+ |--- |diff |index |new file|deleted file|similarity|rename |old mode|new mode)/

const DIFF_HUNK = /^@@[^@\n]*@@/

const scanDiff = (source, emitter) => {
  const { emit } = emitter
  source.split('\n').forEach((line, index) => {
    if (index > 0) emit(null, '\n')
    if (DIFF_META.test(line)) emit('comment', line)
    else if (DIFF_HUNK.test(line)) {
      const hunk = DIFF_HUNK.exec(line)[0]
      emit('title', hunk)
      emit(null, line.slice(hunk.length))
    } else if (line[0] === '+') emit('inserted', line)
    else if (line[0] === '-') emit('deleted', line)
    else emit(null, line)
  })
}

const scanInto = (source, name, emitter) => {
  const spec = languageSpec(name)
  const embed = (body, language) => {
    const resolved = language ? languageNameOf(language) : null
    scanInto(body, resolved ?? 'text', emitter)
  }
  if (spec.scanner === 'html') scanHtml(source, emitter, embed)
  else if (spec.scanner === 'css') scanCss(source, spec, emitter)
  else if (spec.scanner === 'markdown') scanMarkdown(source, emitter, embed)
  else if (spec.scanner === 'diff') scanDiff(source, emitter)
  else if (spec.scanner === 'text') emitter.emit(null, source)
  else scanGeneric(source, spec, emitter)
}

export const tokenizeLines = (source, name) => {
  const emitter = createEmitter()
  scanInto(source, name, emitter)
  return emitter.lines
}
