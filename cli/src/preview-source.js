import { browserGlobals, Linter } from './vendor/eslint.js'
import { bindingNamesOf } from './dead-code.js'
import {
  DESCRIPTION_EXPORT,
  GROUP_EXPORT,
  GROUPS_EXPORT,
  isPreviewMetadataExport,
} from './preview-metadata.js'

const IMPORT_LINE_WIDTH = 100
const COMPONENT_KEY = 'component'

let linter = null

const parsePreview = (source) => {
  linter ??= new Linter()
  let parsed = null
  const config = {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: browserGlobals },
    plugins: {
      preview: {
        rules: {
          collect: {
            create: (context) => ({
              Program(program) {
                parsed = { program, sourceCode: context.sourceCode }
              },
            }),
          },
        },
      },
    },
    rules: { 'preview/collect': 'error' },
  }
  linter.verify(source, config, 'preview.js')
  return parsed
}

const exportedName = (specifier) => specifier.exported.name ?? specifier.exported.value

const keyName = (key) => key.type === 'Identifier' ? key.name : key.value

const propertyOf = (object, name) =>
  object.properties.find((property) =>
    property.type === 'Property' && !property.computed && keyName(property.key) === name
  ) ?? null

const componentOf = (object) => propertyOf(object, COMPONENT_KEY)?.value ?? null

const exportedDeclarators = (program) =>
  program.body.flatMap((statement) =>
    statement.type === 'ExportNamedDeclaration' &&
      statement.declaration?.type === 'VariableDeclaration'
      ? statement.declaration.declarations
      : []
  )

const scenariosOf = (program) => {
  const scenarios = []
  const add = (name, scenario = {}) => {
    if (isPreviewMetadataExport(name) || scenarios.some((known) => known.name === name)) return
    scenarios.push({ name, ...scenario })
  }
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    const { declaration } = statement
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier' && declarator.init !== null) {
          const value = declarator.init
          const own = value.type === 'ObjectExpression' ? componentOf(value) ?? value : value
          add(declarator.id.name, { node: declarator, own, value: true })
        } else {
          for (const { name } of bindingNamesOf(declarator.id)) add(name)
        }
      }
    } else if (declaration) {
      add(declaration.id.name, { node: declaration, own: declaration, value: false })
    }
    for (const specifier of statement.specifiers) add(exportedName(specifier))
  }
  return scenarios
}

const stringLiteralOf = (node) =>
  node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null

const textLiteralOf = (node) => {
  const literal = stringLiteralOf(node)
  if (literal !== null) return literal
  const isPlainTemplate = node?.type === 'TemplateLiteral' && node.expressions.length === 0
  return isPlainTemplate ? node.quasis[0].value.cooked : null
}

const indentOf = (line) => line.match(/^[ \t]*/)[0].length

const dedent = (text) => {
  const lines = text.replace(/^[ \t]*\n/, '').trimEnd().split('\n')
  const indents = lines.filter((line) => line.trim() !== '').map(indentOf)
  const shortest = indents.length === 0 ? 0 : Math.min(...indents)
  return lines.map((line) => line.slice(shortest)).join('\n')
}

const importSpecifierOf = (variables, name) => {
  const definition = variables.find((variable) => variable.name === name)?.defs[0]
  return definition?.type === 'ImportBinding' ? stringLiteralOf(definition.parent.source) : null
}

const groupReferenceOf = (value, variables) => {
  const literal = stringLiteralOf(value)
  if (literal !== null) return { literal }
  const isMember = value.type === 'MemberExpression' && !value.computed &&
    value.object.type === 'Identifier'
  if (!isMember) return { literal: null }
  return { key: value.property.name, specifier: importSpecifierOf(variables, value.object.name) }
}

const declaredOf = (program, variables) => {
  const declared = {}
  for (const declarator of exportedDeclarators(program)) {
    if (declarator.id.type !== 'Identifier' || declarator.init === null) continue
    const { name } = declarator.id
    if (!isPreviewMetadataExport(name)) continue
    if (name === GROUP_EXPORT) {
      declared[name] = groupReferenceOf(declarator.init, variables)
      continue
    }
    const text = textLiteralOf(declarator.init)
    if (text === null) continue
    declared[name] = name === DESCRIPTION_EXPORT ? dedent(text) : text
  }
  return declared
}

const isBareArrow = (node) =>
  node.type === 'ArrowFunctionExpression' && !node.async && node.params.length === 0 &&
  node.body.type !== 'BlockStatement'

const callSiteOf = (sourceCode, own) => {
  if (!isBareArrow(own)) return sourceCode.getText(own)
  const arrow = sourceCode.getTokenBefore(own.body, { filter: (token) => token.value === '=>' })
  return sourceCode.text.slice(arrow.range[1], own.range[1]).trim()
}

const within = (range, span) => range[0] >= span[0] && range[1] <= span[1]

const referencedWithin = (variables, span) =>
  variables.filter((variable) =>
    variable.references.some((reference) => within(reference.identifier.range, span))
  )

const isExported = (node) => node.parent?.type === 'ExportNamedDeclaration'

const bindingOf = (variable) => {
  const definition = variable.defs[0]
  if (definition === undefined) return null
  const { type, node, parent } = definition
  if (type === 'ImportBinding') return { kind: 'import', statement: parent, span: parent.range }
  if (type === 'Variable') {
    return isExported(parent)
      ? { kind: 'export', statement: node, span: node.range, keyword: parent.kind }
      : { kind: 'declaration', statement: parent, span: parent.range }
  }
  if (type === 'FunctionName' || type === 'ClassName') {
    return { kind: 'declaration', statement: node, span: node.range }
  }
  return null
}

const renderImport = (sourceCode, statement, locals) => {
  const parts = []
  const named = []
  for (const specifier of statement.specifiers) {
    if (!locals.has(specifier.local.name)) continue
    if (specifier.type === 'ImportDefaultSpecifier') parts.push(specifier.local.name)
    else if (specifier.type === 'ImportNamespaceSpecifier') {
      parts.push(`* as ${specifier.local.name}`)
    } else named.push(sourceCode.getText(specifier))
  }
  if (named.length) parts.push(`{ ${named.join(', ')} }`)
  const from = sourceCode.getText(statement.source)
  const line = `import ${parts.join(', ')} from ${from}`
  if (line.length <= IMPORT_LINE_WIDTH || !named.length) return line
  const head = parts.slice(0, -1).map((part) => `${part}, `).join('')
  return `import ${head}{\n${named.map((text) => `  ${text},\n`).join('')}} from ${from}`
}

const renderBinding = (sourceCode, binding) =>
  binding.kind === 'export'
    ? `${binding.keyword} ${sourceCode.getText(binding.statement)}`
    : sourceCode.getText(binding.statement)

const scenarioCode = (sourceCode, variables, scenario) => {
  const imports = new Map()
  const helpers = new Map()
  const seen = new Set()
  const queue = [scenario.own.range]
  while (queue.length) {
    for (const variable of referencedWithin(variables, queue.pop())) {
      if (seen.has(variable)) continue
      seen.add(variable)
      const binding = bindingOf(variable)
      if (binding === null || binding.statement === scenario.node) continue
      if (binding.kind === 'import') {
        if (!imports.has(binding.statement)) imports.set(binding.statement, new Set())
        imports.get(binding.statement).add(variable.name)
        continue
      }
      if (helpers.has(binding.statement)) continue
      helpers.set(binding.statement, binding)
      queue.push(binding.span)
    }
  }
  const byPosition = ([left], [right]) => left.range[0] - right.range[0]
  const importLines = [...imports].sort(byPosition)
    .map(([statement, locals]) => renderImport(sourceCode, statement, locals))
  const helperBlocks = [...helpers].sort(byPosition)
    .map(([, binding]) => renderBinding(sourceCode, binding))
  const call = scenario.value
    ? callSiteOf(sourceCode, scenario.own)
    : sourceCode.getText(scenario.own)
  return [importLines.join('\n'), helperBlocks.join('\n\n'), call].filter(Boolean).join('\n\n')
}

const moduleVariablesOf = (sourceCode) =>
  sourceCode.scopeManager.scopes.find((scope) => scope.type === 'module').variables

export function scanPreviewSource(source) {
  const parsed = parsePreview(source)
  if (parsed === null) return { scenarios: [], declared: {}, code: {} }
  const { program, sourceCode } = parsed
  const variables = moduleVariablesOf(sourceCode)
  const scenarios = scenariosOf(program)
  const code = {}
  for (const scenario of scenarios) {
    if (scenario.own === undefined) continue
    code[scenario.name] = scenarioCode(sourceCode, variables, scenario)
  }
  return {
    scenarios: scenarios.map(({ name }) => name),
    declared: declaredOf(program, variables),
    code,
  }
}

export function scanGroupsModule(source) {
  const parsed = parsePreview(source)
  if (parsed === null) return null
  const groups = exportedDeclarators(parsed.program).find((declarator) =>
    declarator.id.type === 'Identifier' && declarator.id.name === GROUPS_EXPORT
  )
  if (groups?.init?.type !== 'ObjectExpression') return null
  const names = new Map()
  for (const property of groups.init.properties) {
    if (property.type !== 'Property' || property.computed) continue
    const entry = property.value
    const named = entry.type === 'ObjectExpression' ? propertyOf(entry, 'name') : null
    names.set(keyName(property.key), named === null ? null : stringLiteralOf(named.value))
  }
  return names
}
