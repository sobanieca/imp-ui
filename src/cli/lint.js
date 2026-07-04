import { Linter } from 'eslint/universal'
import js from '@eslint/js'
import globals from 'globals'
import { relative } from '@std/path'
import impPlugin, { dependencyVersionProblem } from './lint_rules.js'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'

const LINT_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'html'])

const IMP_RULES = {
  'imp/no-capital-component': 'error',
  'imp/exact-dependency-versions': 'error',
}

const buildConfig = (userRules) => ({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: globals.browser,
  },
  plugins: { imp: impPlugin },
  rules: { ...js.configs.recommended.rules, ...userRules, ...IMP_RULES },
})

const IMP_RULE_NAMES = Object.keys(impPlugin.rules)

const prefixImpRules = (rules) =>
  IMP_RULE_NAMES.reduce(
    (text, name) => text.replaceAll(new RegExp(`(?<![\\w/-])${name}\\b`, 'g'), `imp/${name}`),
    rules,
  )

const rewriteIgnoreDirectives = (source) =>
  source
    .replace(
      /\/\/(\s*)imp-lint-ignore-file\b(.*)$/gm,
      (_, space, rules) => `/*${space}eslint-disable${prefixImpRules(rules)} */`,
    )
    .replace(
      /\/\/(\s*)imp-lint-ignore\b(.*)$/gm,
      (_, space, rules) => `//${space}eslint-disable-next-line${prefixImpRules(rules)}`,
    )

export const scriptBlocks = (html) => {
  const blocks = []
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(pattern)) {
    const attributes = match[1]
    if (/\bsrc\s*=/i.test(attributes)) continue
    const type = attributes.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase()
    if (type && type !== 'module' && type !== 'text/javascript') continue
    const bodyStart = match.index + match[0].indexOf('>') + 1
    const lineOffset = html.slice(0, bodyStart).split('\n').length - 1
    blocks.push({ text: match[2], lineOffset })
  }
  return blocks
}

export async function lint({ root, paths }) {
  const imp = await loadImpConfig(root)
  const lintConfig = imp.lint ?? {}
  const config = buildConfig(lintConfig.rules ?? {})
  const files = await collectFiles({
    root,
    paths,
    extensions: LINT_EXTENSIONS,
    exclude: lintConfig.exclude ?? [],
  })

  const linter = new Linter()
  let errors = 0
  let warnings = 0

  for (const [alias, target] of Object.entries(imp.imports ?? {})) {
    const problem = dependencyVersionProblem(target)
    if (!problem) continue
    errors++
    console.error(`error[imp/exact-dependency-versions]: alias '${alias}': ${problem}`)
    console.error(` --> imp.json:1:1\n`)
  }

  const reportMessages = (file, messages, lineOffset = 0) => {
    for (const message of messages) {
      const isError = message.fatal || message.severity === 2
      if (isError) errors++
      else warnings++
      const rule = message.ruleId ?? 'parse'
      console.error(`${isError ? 'error' : 'warning'}[${rule}]: ${message.message}`)
      console.error(` --> ${relative(root, file)}:${message.line + lineOffset}:${message.column}\n`)
    }
  }

  try {
    for (const file of files) {
      const source = await Deno.readTextFile(file)
      if (file.endsWith('.html')) {
        for (const { text, lineOffset } of scriptBlocks(source)) {
          const messages = linter.verify(rewriteIgnoreDirectives(text), config, `${file}.js`)
          reportMessages(file, messages, lineOffset)
        }
      } else {
        reportMessages(file, linter.verify(rewriteIgnoreDirectives(source), config, file))
      }
    }
  } catch (error) {
    const reason = String(error.message ?? error).split('\n')[0].replace(
      /^Config \(unnamed\): /,
      '',
    )
    console.error(`error: invalid lint configuration in imp.json — ${reason}`)
    return 1
  }

  const problems = errors + warnings
  if (problems) console.error(`Found ${problems} problem${problems === 1 ? '' : 's'}`)
  console.error(`Checked ${files.length} ${files.length === 1 ? 'file' : 'files'}`)
  return errors ? 1 : 0
}
