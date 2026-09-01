import { dirname, join, relative, resolve, SEPARATOR } from '@std/path'
import { browserGlobals, Linter } from './vendor/eslint.js'
import { resolveModuleFile } from './bundling.js'
import { collectFiles } from './walk.js'
import { htmlScripts, isLocalScriptSource, isModuleType } from './html_scripts.js'
import { isSpecFile, isUnitFile } from './test.js'
import { isPreviewFile } from './preview.js'
import { MOCK_FILE_SUFFIX } from './mocks.js'
import { publicDirectory } from './config.js'

export const UNREACHABLE_MODULE_RULE = 'imp/unreachable-module'
export const UNUSED_EXPORT_RULE = 'imp/unused-export'

const GRAPH_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'html'])
const SCRIPT_EXTENSIONS = new Set(['js', 'mjs', 'cjs'])
const ALL_EXPORTS = Symbol('all exports')

const extensionOf = (path) => path.slice(path.lastIndexOf('.') + 1).toLowerCase()

const isScript = (path) => SCRIPT_EXTENSIONS.has(extensionOf(path))

const isDevelopmentEntry = (path) =>
  isUnitFile(path) || isSpecFile(path) || isPreviewFile(path) || path.endsWith(MOCK_FILE_SUFFIX)

const isRelative = (specifier) => specifier.startsWith('./') || specifier.startsWith('../')

const declaredNames = (declaration) => {
  if (!declaration) return []
  if (declaration.type === 'VariableDeclaration') {
    const names = []
    const walk = (pattern) => {
      if (pattern.type === 'Identifier') names.push({ name: pattern.name, node: pattern })
      else if (pattern.type === 'ObjectPattern') {
        for (const property of pattern.properties) {
          walk(property.type === 'RestElement' ? property.argument : property.value)
        }
      } else if (pattern.type === 'ArrayPattern') {
        for (const element of pattern.elements) if (element) walk(element)
      } else if (pattern.type === 'AssignmentPattern') walk(pattern.left)
      else if (pattern.type === 'RestElement') walk(pattern.argument)
    }
    for (const declarator of declaration.declarations) walk(declarator.id)
    return names
  }
  return declaration.id ? [{ name: declaration.id.name, node: declaration.id }] : []
}

const exportedName = (specifier) => specifier.exported.name ?? specifier.exported.value

const importedName = (specifier) => specifier.local.name ?? specifier.local.value

const templatePrefix = (source) => {
  const head = source.quasis[0]?.value.cooked ?? ''
  const cut = head.lastIndexOf('/')
  return cut === -1 ? null : head.slice(0, cut + 1)
}

const moduleVisitor = (record) => {
  const addImport = (source, names) => {
    if (source?.type === 'Literal' && typeof source.value === 'string') {
      record.imports.push({ specifier: source.value, names })
    }
  }
  return {
    ImportDeclaration(node) {
      const names = []
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') {
          addImport(node.source, ALL_EXPORTS)
          return
        }
        names.push(
          specifier.type === 'ImportDefaultSpecifier'
            ? 'default'
            : specifier.imported.name ?? specifier.imported.value,
        )
      }
      addImport(node.source, names)
    },
    ExportNamedDeclaration(node) {
      if (node.source) {
        addImport(node.source, node.specifiers.map(importedName))
      } else {
        for (const { name, node: id } of declaredNames(node.declaration)) {
          record.exports.push({ name, loc: id.loc.start })
        }
      }
      for (const specifier of node.specifiers) {
        record.exports.push({ name: exportedName(specifier), loc: specifier.exported.loc.start })
      }
    },
    ExportAllDeclaration(node) {
      addImport(node.source, ALL_EXPORTS)
      if (node.exported) {
        record.exports.push({ name: exportedName(node), loc: node.exported.loc.start })
      }
    },
    ExportDefaultDeclaration(node) {
      record.exports.push({ name: 'default', loc: node.loc.start })
    },
    ImportExpression(node) {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
        record.imports.push({ specifier: node.source.value, names: ALL_EXPORTS })
        return
      }
      const prefix = node.source.type === 'TemplateLiteral' ? templatePrefix(node.source) : null
      if (prefix) record.folderImports.push(prefix)
      else record.opaqueImports.push(node.loc.start)
    },
  }
}

const emptyRecord = () => ({
  imports: [],
  exports: [],
  folderImports: [],
  opaqueImports: [],
  parsed: true,
})

const collectModule = (linter, source, filename) => {
  const record = emptyRecord()
  const config = {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: browserGlobals },
    plugins: { graph: { rules: { collect: { create: () => moduleVisitor(record) } } } },
    rules: { 'graph/collect': 'error' },
  }
  const messages = linter.verify(source, config, filename)
  record.parsed = !messages.some((message) => message.fatal)
  return record
}

const parseGrants = (publicExports) => {
  const grants = []
  for (const entry of publicExports) {
    const hash = entry.indexOf('#')
    const path = hash === -1 ? entry : entry.slice(0, hash)
    grants.push({
      path: path.replace(/\/+$/, ''),
      name: hash === -1 ? null : entry.slice(hash + 1),
    })
  }
  return grants
}

const matchesPath = (relativePath, prefix) =>
  relativePath === prefix || relativePath.startsWith(prefix + SEPARATOR)

const isExcluded = (relativePath, exclude) =>
  exclude.some((entry) => matchesPath(relativePath, entry.replace(/\/+$/, '')))

export async function reportDeadCode({ root, config, configName }) {
  const lintConfig = config.lint ?? {}
  const grants = parseGrants(lintConfig.publicExports ?? [])
  const exclude = lintConfig.exclude ?? []
  const projectRoot = await Deno.realPath(root)
  const files = await collectFiles({
    root: projectRoot,
    paths: [],
    extensions: GRAPH_EXTENSIONS,
    exclude: [],
  })
  const scripts = files.filter(isScript)
  if (!scripts.length) return 0
  const publicFolder = publicDirectory(projectRoot)

  const linter = new Linter()
  const modules = new Map()
  const roots = new Set()
  const usedNames = new Map()
  const opaqueImports = []

  const grantsFor = (file) => {
    const relativePath = relative(projectRoot, file)
    return grants.filter((grant) => matchesPath(relativePath, grant.path))
  }

  const markUsed = (file, names) => {
    const used = usedNames.get(file) ?? new Set()
    usedNames.set(file, used)
    if (names === ALL_EXPORTS) used.add(ALL_EXPORTS)
    else for (const name of names) used.add(name)
  }

  for (const file of scripts) {
    const record = collectModule(linter, await Deno.readTextFile(file), file)
    if (!record.parsed) return 0
    modules.set(file, record)
    if (isDevelopmentEntry(file) || matchesPath(file, publicFolder)) roots.add(file)
    if (grantsFor(file).length) roots.add(file)
    opaqueImports.push(...record.opaqueImports.map((loc) => ({ file, loc })))
  }

  const resolveEdge = async (fromDirectory, specifier) => {
    if (!isRelative(specifier)) return null
    const resolved = await resolveModuleFile(resolve(fromDirectory, specifier))
    return resolved && modules.has(resolved) ? resolved : null
  }

  const addRecordEdges = async (record, directory, targets) => {
    for (const { specifier, names } of record.imports) {
      const target = await resolveEdge(directory, specifier)
      if (!target) continue
      markUsed(target, names)
      targets.add(target)
    }
    for (const prefix of record.folderImports) {
      const folder = resolve(directory, prefix).replace(/[/\\]+$/, '')
      for (const other of scripts) {
        if (!matchesPath(other, folder)) continue
        markUsed(other, ALL_EXPORTS)
        targets.add(other)
      }
    }
  }

  const edges = new Map()
  for (const [file, record] of modules) {
    const targets = new Set()
    await addRecordEdges(record, dirname(file), targets)
    edges.set(file, targets)
  }

  for (const file of files) {
    if (isScript(file)) continue
    const html = await Deno.readTextFile(file)
    const directory = dirname(file)
    for (const script of htmlScripts(html)) {
      if (!isModuleType(script.type)) continue
      if (script.src !== null) {
        if (!script.src || !isLocalScriptSource(script.src)) continue
        const path = decodeURIComponent(script.src.split(/[?#]/)[0])
        const target = await resolveModuleFile(
          path.startsWith('/') ? join(projectRoot, path.slice(1)) : resolve(directory, path),
        )
        if (target && modules.has(target)) roots.add(target)
        continue
      }
      if (!script.text.trim()) continue
      const record = collectModule(linter, script.text, `${file}.js`)
      if (!record.parsed) continue
      opaqueImports.push(...record.opaqueImports.map((loc) => ({ file, loc })))
      const targets = new Set()
      await addRecordEdges(record, directory, targets)
      for (const target of targets) roots.add(target)
    }
  }

  if (!roots.size) return 0

  const reachable = new Set()
  const queue = [...roots]
  while (queue.length) {
    const file = queue.pop()
    if (reachable.has(file)) continue
    reachable.add(file)
    for (const target of edges.get(file) ?? []) queue.push(target)
  }

  const findings = []
  const hint = `add it to "publicExports" in ${configName} if it is used from outside the project`

  for (const file of scripts) {
    const relativePath = relative(projectRoot, file)
    if (isExcluded(relativePath, exclude)) continue
    if (!reachable.has(file)) {
      if (opaqueImports.length) continue
      findings.push({
        rule: UNREACHABLE_MODULE_RULE,
        path: relativePath,
        line: 1,
        column: 1,
        message:
          `nothing imports ${relativePath} - no entry page, test or public export reaches it; delete it, or ${hint}`,
      })
      continue
    }
    if (roots.has(file) && !grantsFor(file).length) continue
    const used = usedNames.get(file) ?? new Set()
    if (used.has(ALL_EXPORTS)) continue
    const fileGrants = grantsFor(file)
    if (fileGrants.some((grant) => grant.name === null)) continue
    const granted = new Set(fileGrants.map((grant) => grant.name))
    for (const { name, loc } of modules.get(file).exports) {
      if (used.has(name) || granted.has(name)) continue
      findings.push({
        rule: UNUSED_EXPORT_RULE,
        path: relativePath,
        line: loc.line,
        column: loc.column + 1,
        message:
          `'${name}' is exported by ${relativePath} but nothing imports it - delete it, or ${hint}`,
      })
    }
  }

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column)
  for (const finding of findings) {
    console.error(`error[${finding.rule}]: ${finding.message}`)
    console.error(` --> ${finding.path}:${finding.line}:${finding.column}\n`)
  }

  if (opaqueImports.length) {
    const [{ file, loc }] = opaqueImports.sort((a, b) =>
      a.file.localeCompare(b.file) || a.loc.line - b.loc.line
    )
    console.error(
      `note: ${UNREACHABLE_MODULE_RULE} is skipped - ${relative(projectRoot, file)}:${loc.line}:${
        loc.column + 1
      } imports a computed specifier, so imp cannot tell which modules it loads\n`,
    )
  }

  return findings.length
}
