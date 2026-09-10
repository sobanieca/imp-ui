import { isIdentChar, parseStringLiteral, skipStringLiteral } from './bundling.js'
import { GROUP_EXPORT, GROUPS_EXPORT, isPreviewMetadataExport } from './preview-metadata.js'

const EXPRESSION_CONTINUES = new Set([...'.?+-*/%<>=&|^:`'])
const LINE_ENDS_OPEN = new Set([...'=+-*/%<>&|^?:'])
const IMPORT_LINE_WIDTH = 100

const OPENERS = '([{'
const CLOSERS = ')]}'

const isQuote = (char) => char === '"' || char === "'" || char === '`'

const isLineComment = (source, index) => source[index] === '/' && source[index + 1] === '/'

const isBlockComment = (source, index) => source[index] === '/' && source[index + 1] === '*'

function skipLineComment(source, index) {
  while (index < source.length && source[index] !== '\n') index++
  return index
}

function skipBlockComment(source, index) {
  index += 2
  while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
  return index + 2
}

function skipTrivia(source, index) {
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) index++
    else if (isLineComment(source, index)) index = skipLineComment(source, index)
    else if (isBlockComment(source, index)) index = skipBlockComment(source, index)
    else return index
  }
  return index
}

function readWord(source, index) {
  let end = index
  while (end < source.length && isIdentChar(source[end])) end++
  return { word: source.slice(index, end), end }
}

function readExpressionEnd(source, start) {
  let index = start
  let depth = 0
  while (index < source.length) {
    const char = source[index]
    if (isLineComment(source, index)) {
      index = skipLineComment(source, index)
      continue
    }
    if (isBlockComment(source, index)) {
      index = skipBlockComment(source, index)
      continue
    }
    if (isQuote(char)) {
      index = skipStringLiteral(source, index)
      continue
    }
    if (OPENERS.includes(char)) {
      depth++
      index++
      continue
    }
    if (CLOSERS.includes(char)) {
      if (depth === 0) return index
      depth--
      index++
      continue
    }
    if (depth === 0 && (char === ';' || char === ',')) return index
    if (depth === 0 && char === '\n') {
      const next = skipTrivia(source, index)
      if (next >= source.length) return index
      const open = LINE_ENDS_OPEN.has(source[previousCode(source, index)])
      if (!open && !EXPRESSION_CONTINUES.has(source[next])) return index
      index = next
      continue
    }
    index++
  }
  return source.length
}

function readBlockEnd(source, start) {
  let index = start
  let depth = 0
  while (index < source.length) {
    const char = source[index]
    if (isLineComment(source, index)) {
      index = skipLineComment(source, index)
      continue
    }
    if (isBlockComment(source, index)) {
      index = skipBlockComment(source, index)
      continue
    }
    if (isQuote(char)) {
      index = skipStringLiteral(source, index)
      continue
    }
    if (OPENERS.includes(char)) depth++
    else if (CLOSERS.includes(char)) {
      depth--
      if (depth === 0) return index + 1
    }
    index++
  }
  return source.length
}

const previousCode = (source, index) => {
  let cursor = index - 1
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor--
  return cursor
}

const isPropertyName = (source, index) => {
  const before = previousCode(source, index)
  if (source[before] !== '.') return false
  return !(source[before - 1] === '.' && source[before - 2] === '.')
}

const isObjectKey = (source, index, end) => {
  const after = skipTrivia(source, end)
  if (source[after] !== ':') return false
  const before = source[previousCode(source, index)]
  return before === '{' || before === ','
}

function collectTemplateIdentifiers(source, index, found) {
  index++
  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '`') return index + 1
    if (char === '$' && source[index + 1] === '{') {
      const inner = index + 2
      const close = readBlockEnd(source, index + 1)
      collectIdentifiers(source, inner, close - 1, found)
      index = close
      continue
    }
    index++
  }
  return index
}

function collectIdentifiers(source, start, end, found) {
  let index = start
  while (index < end) {
    const char = source[index]
    if (isLineComment(source, index)) {
      index = skipLineComment(source, index)
      continue
    }
    if (isBlockComment(source, index)) {
      index = skipBlockComment(source, index)
      continue
    }
    if (char === '`') {
      index = collectTemplateIdentifiers(source, index, found)
      continue
    }
    if (isQuote(char)) {
      index = skipStringLiteral(source, index)
      continue
    }
    if (isIdentChar(char) && !isIdentChar(source[index - 1])) {
      const { word, end: wordEnd } = readWord(source, index)
      if (
        !/^[0-9]/.test(word) && !isPropertyName(source, index) &&
        !isObjectKey(source, index, wordEnd)
      ) found.add(word)
      index = wordEnd
      continue
    }
    index++
  }
  return found
}

const identifiersIn = (source, start, end) => collectIdentifiers(source, start, end, new Set())

function readDeclarators(source, start) {
  const declarators = []
  let cursor = start
  let end = start
  while (cursor < source.length) {
    let names
    let afterPattern
    if (source[cursor] === '{' || source[cursor] === '[') {
      afterPattern = readBlockEnd(source, cursor)
      names = [...identifiersIn(source, cursor, afterPattern)]
    } else {
      const declared = readWord(source, cursor)
      if (!declared.word) return { declarators, end }
      names = [declared.word]
      afterPattern = declared.end
    }
    const afterName = skipTrivia(source, afterPattern)
    if (source[afterName] !== '=') {
      declarators.push({ names, valueStart: null, valueEnd: null })
      return { declarators, end: afterPattern }
    }
    const valueStart = skipTrivia(source, afterName + 1)
    const valueEnd = readExpressionEnd(source, valueStart)
    declarators.push({ names, valueStart, valueEnd })
    end = valueEnd
    cursor = skipTrivia(source, valueEnd)
    if (source[cursor] !== ',') return { declarators, end }
    cursor = skipTrivia(source, cursor + 1)
  }
  return { declarators, end }
}

function readImportStatement(source, start, afterKeyword, statements) {
  const clauseStart = skipTrivia(source, afterKeyword)
  if (source[clauseStart] === '(' || source[clauseStart] === '.') return afterKeyword
  let quote = clauseStart
  while (quote < source.length && !isQuote(source[quote])) quote++
  if (quote >= source.length) return afterKeyword
  const end = skipStringLiteral(source, quote)
  const clause = source.slice(clauseStart, quote).replace(/\bfrom\s*$/, '').trim()
  const statement = {
    kind: 'import',
    start,
    end,
    specifier: source.slice(quote, end),
    default: null,
    namespace: null,
    named: [],
  }
  const braceStart = clause.indexOf('{')
  const head = braceStart === -1 ? clause : clause.slice(0, braceStart)
  for (const part of head.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const namespace = trimmed.match(/^\*\s*as\s+(\w+)$/)
    if (namespace) statement.namespace = namespace[1]
    else statement.default = trimmed
  }
  if (braceStart !== -1) {
    const braceEnd = clause.indexOf('}', braceStart)
    for (const part of clause.slice(braceStart + 1, braceEnd).split(',')) {
      const text = part.trim()
      if (!text) continue
      statement.named.push({ text, local: text.split(/\s+as\s+/).at(-1).trim() })
    }
  }
  statements.push(statement)
  return end
}

function readDeclarationStatement(source, start, afterKeyword, statements) {
  const { declarators, end } = readDeclarators(source, skipTrivia(source, afterKeyword))
  if (!declarators.length) return afterKeyword
  statements.push({
    kind: 'declaration',
    names: declarators.flatMap(({ names }) => names),
    start,
    end,
  })
  return end
}

function readFunctionStatement(source, start, afterKeyword) {
  let cursor = skipTrivia(source, afterKeyword)
  if (source[cursor] === '*') cursor = skipTrivia(source, cursor + 1)
  const named = readWord(source, cursor)
  if (!named.word) return null
  const bodyStart = source.indexOf('{', named.end)
  if (bodyStart === -1) return null
  return { name: named.word, start, end: readBlockEnd(source, bodyStart) }
}

function readNamedFunction(source, start, afterKeyword, statements) {
  const read = readFunctionStatement(source, start, afterKeyword)
  if (read === null) return afterKeyword
  statements.push({ kind: 'declaration', names: [read.name], start: read.start, end: read.end })
  return read.end
}

function readAsyncStatement(source, start, afterKeyword, statements) {
  const next = readWord(source, skipTrivia(source, afterKeyword))
  if (next.word !== 'function') return afterKeyword
  return readNamedFunction(source, start, next.end, statements)
}

function readGroupedExport(source, start, statements) {
  const close = source.indexOf('}', start)
  const end = close === -1 ? source.length : close
  for (const entry of source.slice(start + 1, end).split(',')) {
    const parts = entry.trim().split(/\s+as\s+/)
    const name = (parts.at(-1) ?? '').trim()
    if (name) statements.push({ kind: 'export', name, start, end: end + 1, valueStart: null })
  }
  return end + 1
}

function readExportStatement(source, start, afterKeyword, statements) {
  const clauseStart = skipTrivia(source, afterKeyword)
  if (source[clauseStart] === '{') return readGroupedExport(source, clauseStart, statements)
  const first = readWord(source, clauseStart)
  if (first.word === 'default') return first.end
  let keyword = first
  if (first.word === 'async') keyword = readWord(source, skipTrivia(source, first.end))
  if (keyword.word === 'function' || keyword.word === 'class') {
    const read = readFunctionStatement(source, start, keyword.end)
    if (read === null) return keyword.end
    statements.push({
      kind: 'export',
      name: read.name,
      start,
      end: read.end,
      valueStart: null,
      bodyStart: clauseStart,
    })
    return read.end
  }
  if (keyword.word === 'const' || keyword.word === 'let' || keyword.word === 'var') {
    const { declarators, end } = readDeclarators(source, skipTrivia(source, keyword.end))
    for (const { names, valueStart, valueEnd } of declarators) {
      for (const name of names) {
        statements.push({ kind: 'export', name, start, end, valueStart, valueEnd })
      }
    }
    return end
  }
  return keyword.end
}

const STATEMENT_READERS = {
  import: readImportStatement,
  export: readExportStatement,
  const: readDeclarationStatement,
  let: readDeclarationStatement,
  var: readDeclarationStatement,
  function: readNamedFunction,
  class: readNamedFunction,
  async: readAsyncStatement,
}

function readStatements(source) {
  const statements = []
  let index = 0
  let depth = 0
  while (index < source.length) {
    const char = source[index]
    if (isLineComment(source, index)) {
      index = skipLineComment(source, index)
      continue
    }
    if (isBlockComment(source, index)) {
      index = skipBlockComment(source, index)
      continue
    }
    if (isQuote(char)) {
      index = skipStringLiteral(source, index)
      continue
    }
    if (OPENERS.includes(char)) {
      depth++
      index++
      continue
    }
    if (CLOSERS.includes(char)) {
      depth = Math.max(0, depth - 1)
      index++
      continue
    }
    if (isIdentChar(char) && !isIdentChar(source[index - 1])) {
      const { word, end } = readWord(source, index)
      if (depth === 0 && Object.hasOwn(STATEMENT_READERS, word) && source[index - 1] !== '.') {
        index = STATEMENT_READERS[word](source, index, end, statements)
        continue
      }
      index = end
      continue
    }
    index++
  }
  return statements
}

const ZERO_ARGUMENT_ARROW = /^\(\s*\)\s*=>\s*(?=[^\s{])/

const callSiteOf = (expression) => expression.replace(ZERO_ARGUMENT_ARROW, '')

const renderImport = (statement, locals) => {
  const parts = []
  if (statement.default !== null && locals.has(statement.default)) parts.push(statement.default)
  if (statement.namespace !== null && locals.has(statement.namespace)) {
    parts.push(`* as ${statement.namespace}`)
  }
  const named = statement.named.filter(({ local }) => locals.has(local)).map(({ text }) => text)
  if (named.length) parts.push(`{ ${named.join(', ')} }`)
  const line = `import ${parts.join(', ')} from ${statement.specifier}`
  if (line.length <= IMPORT_LINE_WIDTH || !named.length) return line
  const head = parts.slice(0, -1).map((part) => `${part}, `).join('')
  return `import ${head}{\n${
    named.map((text) => `  ${text},\n`).join('')
  }} from ${statement.specifier}`
}

const renderDeclaration = (source, statement) => {
  if (statement.kind === 'declaration') return source.slice(statement.start, statement.end)
  const value = source.slice(statement.valueStart, statement.valueEnd).trim()
  return `const ${statement.name} = ${value}`
}

const spanOf = (statement) =>
  statement.kind === 'export'
    ? [statement.valueStart, statement.valueEnd]
    : [statement.start, statement.end]

function bindingsOf(statements) {
  const bindings = new Map()
  for (const statement of statements) {
    if (statement.kind === 'import') {
      for (const local of [statement.default, statement.namespace]) {
        if (local !== null) bindings.set(local, statement)
      }
      for (const { local } of statement.named) bindings.set(local, statement)
    } else if (statement.kind === 'declaration') {
      for (const name of statement.names) bindings.set(name, statement)
    } else if (statement.valueStart !== null) {
      bindings.set(statement.name, statement)
    }
  }
  return bindings
}

const COMPONENT_KEY = 'component'

function objectEntries(source, start, end) {
  const open = skipTrivia(source, start)
  if (source[open] !== '{') return null
  const entries = []
  let index = open + 1
  while (index < end) {
    const char = source[index]
    if (isLineComment(source, index)) {
      index = skipLineComment(source, index)
      continue
    }
    if (isBlockComment(source, index)) {
      index = skipBlockComment(source, index)
      continue
    }
    if (isQuote(char)) {
      index = skipStringLiteral(source, index)
      continue
    }
    if (OPENERS.includes(char)) {
      index = readBlockEnd(source, index)
      continue
    }
    if (char === '}') return entries
    if (isIdentChar(char) && !isIdentChar(source[index - 1])) {
      const { word, end: wordEnd } = readWord(source, index)
      const afterKey = skipTrivia(source, wordEnd)
      if (source[afterKey] === ':') {
        const valueStart = skipTrivia(source, afterKey + 1)
        const valueEnd = readExpressionEnd(source, valueStart)
        entries.push({ key: word, valueStart, valueEnd })
        index = valueEnd
        continue
      }
      index = wordEnd
      continue
    }
    index++
  }
  return entries
}

const propertySpanOf = (source, start, end, key) => {
  const entry = (objectEntries(source, start, end) ?? []).find((candidate) => candidate.key === key)
  return entry === undefined ? null : [entry.valueStart, entry.valueEnd]
}

const ownSpanOf = (source, statement) => {
  if (statement.valueStart !== null) {
    return propertySpanOf(source, statement.valueStart, statement.valueEnd, COMPONENT_KEY) ??
      [statement.valueStart, statement.valueEnd]
  }
  return statement.bodyStart === undefined ? null : [statement.bodyStart, statement.end]
}

function exportCode(source, statement, bindings) {
  const span = ownSpanOf(source, statement)
  if (span === null) return null
  const usedImports = new Map()
  const declarations = new Set()
  const seen = new Set()
  const queue = [...identifiersIn(source, ...span)]
  while (queue.length) {
    const name = queue.pop()
    if (seen.has(name)) continue
    seen.add(name)
    const bound = bindings.get(name)
    if (bound === undefined || bound === statement) continue
    if (bound.kind === 'import') {
      if (!usedImports.has(bound)) usedImports.set(bound, new Set())
      usedImports.get(bound).add(name)
      continue
    }
    if (declarations.has(bound)) continue
    declarations.add(bound)
    queue.push(...identifiersIn(source, ...spanOf(bound)))
  }
  const imports = [...usedImports].sort(([left], [right]) => left.start - right.start)
    .map(([bound, locals]) => renderImport(bound, locals))
  const helpers = [...declarations].sort((left, right) => left.start - right.start)
    .map((bound) => renderDeclaration(source, bound))
  const own = source.slice(...span).trim()
  const call = statement.valueStart === null ? own : callSiteOf(own)
  return [imports.join('\n'), helpers.join('\n\n'), call].filter(Boolean).join('\n\n')
}

const MEMBER_EXPRESSION = /^([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)$/

const specifierOf = (statement) => statement.specifier.slice(1, -1)

const readGroupReference = (source, statement, bindings) => {
  const text = source.slice(statement.valueStart, statement.valueEnd).trim()
  const literal = parseStringLiteral(text)
  if (literal !== null) return { literal }
  const member = text.match(MEMBER_EXPRESSION)
  if (member === null) return { literal: null }
  const [, root, key] = member
  const bound = bindings.get(root)
  return { key, specifier: bound?.kind === 'import' ? specifierOf(bound) : null }
}

export function scanPreviewSource(source) {
  const statements = readStatements(source)
  const bindings = bindingsOf(statements)
  const scenarios = []
  const declared = {}
  const code = {}
  for (const statement of statements) {
    if (statement.kind !== 'export') continue
    if (!isPreviewMetadataExport(statement.name)) {
      if (!scenarios.includes(statement.name)) scenarios.push(statement.name)
      const sliced = exportCode(source, statement, bindings)
      if (sliced !== null) code[statement.name] = sliced
      continue
    }
    if (statement.valueStart === null) continue
    if (statement.name === GROUP_EXPORT) {
      declared[GROUP_EXPORT] = readGroupReference(source, statement, bindings)
      continue
    }
    const literal = parseStringLiteral(source.slice(statement.valueStart, statement.valueEnd))
    if (literal !== null) declared[statement.name] = literal
  }
  return { scenarios, declared, code }
}

export function scanGroupsModule(source) {
  const names = new Map()
  const statement = readStatements(source).find((candidate) =>
    candidate.kind === 'export' && candidate.name === GROUPS_EXPORT && candidate.valueStart !== null
  )
  if (statement === undefined) return null
  const entries = objectEntries(source, statement.valueStart, statement.valueEnd)
  if (entries === null) return null
  for (const { key, valueStart, valueEnd } of entries) {
    const nameSpan = propertySpanOf(source, valueStart, valueEnd, 'name')
    const name = nameSpan === null ? null : parseStringLiteral(source.slice(...nameSpan))
    names.set(key, name)
  }
  return names
}
