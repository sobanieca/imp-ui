import { extname, join, relative, SEPARATOR } from '@std/path'
import { browserGlobals, Linter } from './vendor/eslint.js'
import { createAnalyticsNameVisitor, unreadableAnalyticsNameProblem } from './lint-rules.js'
import { collectFiles, posixPath } from './walk.js'
import { isJavaScriptType, readHtml } from './html-document.js'
import { isMockFile, isPreviewFile, isTestFile } from './project-files.js'
import { ANALYTICS_SUBJECTS, analyticsNameProblemOf } from './analytics-files.js'

export const UNIQUE_ANALYTICS_NAME_RULE = 'imp/unique-analytics-name'

const NAME_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'html'])

const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs'])

const isDevelopmentFile = (path) => isTestFile(path) || isPreviewFile(path) || isMockFile(path)

const collectNames = (linter, source, filename, onName) => {
  const config = {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: browserGlobals },
    plugins: {
      names: { rules: { collect: { create: () => createAnalyticsNameVisitor(onName) } } },
    },
    rules: { 'names/collect': 'error' },
  }
  linter.verify(source, config, filename)
}

const scriptBlocks = (html) =>
  readHtml(html).scripts.filter((script) => script.src === null && isJavaScriptType(script.type))

export async function reportDuplicateAnalyticsNames({ root, config }) {
  const projectRoot = await Deno.realPath(root)
  const files = await collectFiles({
    root: projectRoot,
    paths: [],
    extensions: NAME_EXTENSIONS,
    exclude: config.lint?.exclude ?? [],
  })
  const linter = new Linter()
  const uses = new Map()

  const record = (path, lineOffset) => ({ helper, name, node }) => {
    if (typeof name !== 'string') return
    const key = `${helper}\n${name}`
    const list = uses.get(key) ?? []
    list.push({
      helper,
      name,
      path,
      line: node.loc.start.line + lineOffset,
      column: node.loc.start.column + 1,
    })
    uses.set(key, list)
  }

  for (const file of files) {
    if (isDevelopmentFile(file)) continue
    const source = await Deno.readTextFile(file)
    const path = posixPath(relative(projectRoot, file))
    if (file.endsWith('.html')) {
      for (const block of scriptBlocks(source)) {
        collectNames(linter, block.text, `${file}.js`, record(path, block.lineOffset))
      }
    } else {
      collectNames(linter, source, file, record(path, 0))
    }
  }

  const findings = []
  for (const list of uses.values()) {
    const [first, ...repeats] = list
    for (const use of repeats) {
      findings.push({
        ...use,
        message: `${
          ANALYTICS_SUBJECTS.get(use.helper)
        } name '${use.name}' is also used in ${first.path}:${first.line}:${first.column} - give each ${
          ANALYTICS_SUBJECTS.get(use.helper)
        } its own name, so that the report can tell them apart`,
      })
    }
  }
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column)
  for (const finding of findings) {
    console.error(`error[${UNIQUE_ANALYTICS_NAME_RULE}]: ${finding.message}`)
    console.error(` --> ${finding.path}:${finding.line}:${finding.column}\n`)
  }
  return findings.length
}

const sortedNames = (names) => [...names].sort()

export async function collectBundleNames({ root, inputs, sourceOf = Deno.readTextFile }) {
  const dependencies = join(root, 'dependencies') + SEPARATOR
  const zones = new Set()
  const outcomes = new Set()
  const unreadable = []
  const linter = new Linter()
  for (const input of inputs) {
    if (input.startsWith(dependencies) || !SCANNED_EXTENSIONS.has(extname(input))) continue
    const path = posixPath(relative(root, input))
    collectNames(linter, await sourceOf(input), input, ({ helper, name, literal, node }) => {
      const at = `${path}:${node.loc.start.line}:${node.loc.start.column + 1}`
      if (!literal) {
        unreadable.push(`  ${at} - ${unreadableAnalyticsNameProblem(helper)}`)
        return
      }
      if (analyticsNameProblemOf(helper, name)) return
      const names = helper === 'zone' ? zones : outcomes
      names.add(name)
    })
  }
  if (unreadable.length) {
    throw new Error(
      `imp build cannot read every analytics name:\n${unreadable.join('\n')}`,
    )
  }
  return { zones: sortedNames(zones), outcomes: sortedNames(outcomes) }
}
