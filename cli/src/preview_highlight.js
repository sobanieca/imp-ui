const KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

const LITERAL_WORDS = new Set(['Infinity', 'NaN', 'false', 'null', 'true', 'undefined'])

const VALUE_KEYWORDS = new Set(['super', 'this'])

const CLOSING_PUNCTUATION = new Set([')', ']', '}'])

const whitespacePattern = /\s+/y
const identifierPattern = /[A-Za-z_$][\w$]*/y
const numberPattern =
  /0[xXbBoO][0-9a-fA-F_]+n?|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?\d+)?n?/y

const matchAt = (pattern, source, index) => {
  pattern.lastIndex = index
  return pattern.exec(source)?.[0] ?? null
}

const regexCanStartAfter = (previous) => {
  if (!previous) return true
  if (previous.kind === 'keyword') return !VALUE_KEYWORDS.has(previous.text)
  if (previous.kind === 'punctuation') return !CLOSING_PUNCTUATION.has(previous.text)
  return false
}

const endOfQuoted = (source, start) => {
  const quote = source[start]
  let index = start + 1
  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === quote) return index + 1
    if (char === '\n') return index
    index++
  }
  return index
}

const endOfTemplateChunk = (source, start) => {
  let index = start
  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '`') return { end: index + 1, interpolated: false }
    if (char === '$' && source[index + 1] === '{') return { end: index + 2, interpolated: true }
    index++
  }
  return { end: index, interpolated: false }
}

const endOfRegex = (source, start) => {
  let index = start + 1
  let inCharacterClass = false
  while (index < source.length) {
    const char = source[index]
    if (char === '\n') return -1
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '[') inCharacterClass = true
    else if (char === ']') inCharacterClass = false
    else if (char === '/' && !inCharacterClass) {
      index++
      while (index < source.length && /[a-z]/i.test(source[index])) index++
      return index
    }
    index++
  }
  return -1
}

const merged = (tokens) => {
  const runs = []
  for (const token of tokens) {
    const last = runs.at(-1)
    if (last?.kind === token.kind) last.text += token.text
    else runs.push({ ...token })
  }
  return runs
}

export function tokenizeJs(source) {
  const tokens = []
  const openBraces = []
  let previous = null
  let index = 0

  const take = (kind, end, { significant = true } = {}) => {
    const token = { kind, text: source.slice(index, end) }
    tokens.push(token)
    if (significant) previous = token
    index = end
  }

  const takeTemplateChunk = (from) => {
    const { end, interpolated } = endOfTemplateChunk(source, from)
    take('string', end)
    if (interpolated) openBraces.push('template')
  }

  while (index < source.length) {
    const char = source[index]

    const spacing = matchAt(whitespacePattern, source, index)
    if (spacing) {
      take('plain', index + spacing.length, { significant: false })
      continue
    }

    if (char === '/' && source[index + 1] === '/') {
      const lineEnd = source.indexOf('\n', index)
      take('comment', lineEnd === -1 ? source.length : lineEnd, { significant: false })
      continue
    }

    if (char === '/' && source[index + 1] === '*') {
      const commentEnd = source.indexOf('*/', index + 2)
      take('comment', commentEnd === -1 ? source.length : commentEnd + 2, { significant: false })
      continue
    }

    if (char === '"' || char === "'") {
      take('string', endOfQuoted(source, index))
      continue
    }

    if (char === '`') {
      takeTemplateChunk(index + 1)
      continue
    }

    if (char === '}' && openBraces.at(-1) === 'template') {
      openBraces.pop()
      takeTemplateChunk(index + 1)
      continue
    }

    if (char === '/' && regexCanStartAfter(previous)) {
      const regexEnd = endOfRegex(source, index)
      if (regexEnd !== -1) {
        take('regexp', regexEnd)
        continue
      }
    }

    const identifier = matchAt(identifierPattern, source, index)
    if (identifier) {
      const kind = KEYWORDS.has(identifier)
        ? 'keyword'
        : LITERAL_WORDS.has(identifier)
        ? 'number'
        : 'plain'
      take(kind, index + identifier.length)
      continue
    }

    const number = matchAt(numberPattern, source, index)
    if (number) {
      take('number', index + number.length)
      continue
    }

    if (char === '{') openBraces.push('brace')
    else if (char === '}') openBraces.pop()
    take('punctuation', index + 1)
  }

  return merged(tokens)
}
