import { browserGlobals, Linter, recommendedRules } from './vendor/eslint.js'
import { join, relative } from '@std/path'
import impPlugin, { dependencyPinProblem } from './lint_rules.js'
import { findConfigFile, loadImpConfig } from './config.js'
import { formatSize, isFileSizeIgnored, maxFileBytes, maxFileSizeHint } from './file_size.js'
import { collectFiles } from './walk.js'

const LINT_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'html'])

const IMP_RULES = {
  'imp/no-capital-component': 'error',
  'imp/exact-dependency-versions': 'error',
  'imp/single-props-object': 'error',
}

const buildConfig = (userRules, dependencyAliases) => ({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: browserGlobals,
  },
  settings: { imp: { dependencyAliases } },
  plugins: { imp: impPlugin },
  rules: { ...recommendedRules, ...userRules, ...IMP_RULES },
})

const IMP_RULE_NAMES = Object.keys(impPlugin.rules)

const prefixImpRules = (rules) =>
  IMP_RULE_NAMES.reduce(
    (text, name) => text.replaceAll(new RegExp(`(?<![\\w/-])${name}\\b`, 'g'), `imp/${name}`),
    rules,
  )

const rewriteIgnoreDirectives = (source) => {
  const originals = []
  const track = (original, rewritten) => {
    originals.push([rewritten, original])
    return rewritten
  }
  const text = source
    .replace(
      /\/\/(\s*)imp-lint-ignore-file\b(.*)$/gm,
      (match, space, rules) => track(match, `/*${space}eslint-disable${prefixImpRules(rules)} */`),
    )
    .replace(
      /\/\/(\s*)imp-lint-ignore\b(.*)$/gm,
      (match, space, rules) =>
        track(match, `//${space}eslint-disable-next-line${prefixImpRules(rules)}`),
    )
  const restore = (fixed) =>
    originals.reduce(
      (current, [rewritten, original]) => current.replaceAll(rewritten, original),
      fixed,
    )
  return { text, restore }
}

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
    blocks.push({ text: match[2], lineOffset, start: bodyStart, end: bodyStart + match[2].length })
  }
  return blocks
}

async function trackedFiles(root) {
  const command = new Deno.Command('git', {
    args: ['ls-files', '-z'],
    cwd: root,
    stdout: 'piped',
    stderr: 'null',
  })
  let output
  try {
    output = await command.output()
  } catch {
    return null
  }
  if (!output.success) return null
  return new TextDecoder().decode(output.stdout).split('\0').filter(Boolean)
}

async function reportOversizedFiles(root, config) {
  const files = await trackedFiles(root)
  if (!files) return 0
  const limit = maxFileBytes(config)
  const ignore = config.maxFileSizeIgnore ?? []
  let errors = 0
  for (const relativePath of files) {
    if (isFileSizeIgnored(relativePath, ignore)) continue
    let info
    try {
      info = await Deno.stat(join(root, relativePath))
    } catch {
      continue
    }
    if (!info.isFile || info.size <= limit) continue
    errors++
    console.error(
      `error[imp/max-file-size]: ${relativePath} is ${formatSize(info.size)}, over the ${
        formatSize(limit)
      } limit — ${maxFileSizeHint}`,
    )
    console.error(` --> ${relativePath}:1:1\n`)
  }
  return errors
}

export async function lint({ root, paths, fix = false }) {
  const imp = await loadImpConfig(root)
  const configName = (await findConfigFile(root))?.name ?? 'imp.json'
  const lintConfig = imp.lint ?? {}
  const dependencies = imp.dependencies ?? {}
  const config = buildConfig(lintConfig.rules ?? {}, Object.keys(dependencies))
  const files = await collectFiles({
    root,
    paths,
    extensions: LINT_EXTENSIONS,
    exclude: lintConfig.exclude ?? [],
  })

  const linter = new Linter()
  let errors = 0
  let warnings = 0
  let fixedFiles = 0

  for (const [alias, specifier] of Object.entries(dependencies)) {
    const problem = dependencyPinProblem(specifier)
    if (!problem) continue
    errors++
    console.error(`error[imp/exact-dependency-versions]: dependency '${alias}': ${problem}`)
    console.error(` --> ${configName}:1:1\n`)
  }

  errors += await reportOversizedFiles(root, imp)

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

  const lintSource = (source, filename) => {
    const { text, restore } = rewriteIgnoreDirectives(source)
    if (!fix) return { messages: linter.verify(text, config, filename), output: source }
    const result = linter.verifyAndFix(text, config, filename)
    return { messages: result.messages, output: result.fixed ? restore(result.output) : source }
  }

  const writeIfChanged = async (file, source, output) => {
    if (!fix || output === source) return
    await Deno.writeTextFile(file, output)
    fixedFiles++
  }

  try {
    for (const file of files) {
      const source = await Deno.readTextFile(file)
      if (file.endsWith('.html')) {
        let output = ''
        let cursor = 0
        for (const block of scriptBlocks(source)) {
          const fixed = lintSource(block.text, `${file}.js`)
          reportMessages(file, fixed.messages, block.lineOffset)
          output += source.slice(cursor, block.start) + fixed.output
          cursor = block.end
        }
        output += source.slice(cursor)
        await writeIfChanged(file, source, output)
      } else {
        const fixed = lintSource(source, file)
        reportMessages(file, fixed.messages)
        await writeIfChanged(file, source, fixed.output)
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
  if (fixedFiles) console.error(`Fixed ${fixedFiles} ${fixedFiles === 1 ? 'file' : 'files'}`)
  if (problems) console.error(`Found ${problems} problem${problems === 1 ? '' : 's'}`)
  console.error(`Checked ${files.length} ${files.length === 1 ? 'file' : 'files'}`)
  return errors ? 1 : 0
}
