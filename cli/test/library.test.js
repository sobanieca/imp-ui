import { join } from '@std/path'
import {
  dirname as posixDirname,
  join as posixJoin,
  normalize as posixNormalize,
} from '@std/path/posix'
import { assertSnapshot } from './snapshot.js'
import { BINARY_ASSET_EXTENSIONS } from '../src/deps.js'
import { CONTENT_TYPES } from '../src/start.js'
import {
  defaultAlias,
  IMP_MODULES,
  IMP_TOOLING_MODULES,
  parseSpecifier,
} from '../src/specifiers.js'
import { themeFileSource } from '../../lib/src/theme-draft.js'
import impPlugin, { IMP_MODULE_EXPORTS } from '../src/lint-rules.js'
import { MAX_FILE_SIZE_RULE } from '../src/lint.js'
import {
  COMPUTED_IMPORT_RULE,
  UNREACHABLE_MODULE_RULE,
  UNUSED_EXPORT_RULE,
} from '../src/dead-code.js'
import { UNIQUE_ANALYTICS_NAME_RULE } from '../src/analytics-names.js'
import { buildTokens, colorSchemeOf, defaultTokens, THEME_DEFAULTS } from '../../lib/src/theme.js'
import { contrastProblems } from '../../lib/src/theme-contrast.js'
import { check, copyDirectory, fixture, REPO_ROOT, runImp, tempDir } from './helpers.js'

Deno.test('a derived primary reads as text on the surface and carries readable text', () => {
  const derived = (primary, mode) => buildTokens({ ...THEME_DEFAULTS, primary, mode })
  const deep = derived('#b91c1c', 'light')
  check(deep['color-primary'] === '#b91c1c', 'a deep red that reads on the surface stays as given')
  check(deep['color-on-primary'] === '#ffffff', 'a deep red gets white text')
  const pale = derived('#f59e0b', 'light')
  check(pale['color-primary'] !== '#f59e0b', 'a pale amber is too light for text in a light theme')
  check(pale['color-on-primary'] === '#ffffff', 'the darker amber carries white text')
  check(contrastProblems(pale).length === 0, 'every pair of the pale amber theme reads at 4.5:1')
  const night = derived('#f59e0b', 'dark')
  check(night['color-primary'] === '#f59e0b', 'a pale amber reads on a dark surface as given')
  check(night['color-on-primary'] !== '#ffffff', 'a pale amber gets dark text')
  const dim = derived('#1e3a8a', 'dark')
  check(dim['color-primary'] !== '#1e3a8a', 'a deep blue is too dark for text in a dark theme')
  check(contrastProblems(dim).length === 0, 'every pair of the deep blue dark theme reads at 4.5:1')
})

Deno.test('every pair of a derived theme reaches 4.5:1 over a grid of colours', () => {
  const steps = [0x00, 0x24, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff]
  const channel = (value) => value.toString(16).padStart(2, '0')
  const colors = steps.flatMap((red) =>
    steps.flatMap((green) =>
      steps.map((blue) => `#${channel(red)}${channel(green)}${channel(blue)}`)
    )
  )
  const failures = []
  for (const mode of ['light', 'dark']) {
    for (const color of colors) {
      for (const knobs of [{ primary: color }, { secondary: color }]) {
        const problems = contrastProblems(buildTokens({ ...THEME_DEFAULTS, ...knobs, mode }))
        if (problems.length) {
          failures.push(`${mode} ${JSON.stringify(knobs)} ${JSON.stringify(problems)}`)
        }
      }
    }
  }
  check(failures.length === 0, `derived themes below 4.5:1:\n${failures.slice(0, 10).join('\n')}`)
})

Deno.test('the theme editor exports a theme file that imports back as one theme', async () => {
  const tokens = {
    ...buildTokens({
      primary: '#3b6fe0',
      secondary: '#6b7280',
      radius: 'large',
      shadow: 'strong',
      mode: 'light',
      overrides: {
        'font-family': "'Inter', system-ui, sans-serif",
        'background-app': 'linear-gradient(#fff, #eee)',
        'font-weight-bold': '500',
      },
    }),
    'color-green': '#12b76a',
  }
  const source = themeFileSource('acme', { tokens })
  const module = await import(`data:text/javascript,${encodeURIComponent(source)}`)
  const theme = module.default

  check(theme.name === 'acme', `unexpected theme name ${theme.name}`)
  check(colorSchemeOf(theme.tokens) === 'light', 'the theme keeps its light surface')
  const missing = Object.keys(defaultTokens()).filter((name) => !(name in theme.tokens))
  check(missing.length === 0, `the exported theme omits ${missing.join(', ')}`)
  check(
    theme.tokens['color-primary'] === tokens['color-primary'],
    'the theme carries the primary the editor was given',
  )
  check(theme.tokens['color-green'] === '#12b76a', 'a palette colour edited by hand is kept')
  check(
    theme.tokens['color-success'] === 'var(--imp-color-green)' &&
      theme.tokens['color-danger'] === 'var(--imp-color-red)',
    'a colour role points at the palette, so editing a hue moves the role',
  )
  check(
    theme.tokens['background-app'] === 'linear-gradient(#fff, #eee)' &&
      theme.tokens['font-weight-bold'] === '500',
    'the tokens the editor has no knob for reach the exported theme',
  )
  check(
    theme.tokens['radius-item'] === '10px' && theme.tokens['shadow-md'] !== 'none',
    'the radius and shadow steps reach the exported tokens',
  )
  check(
    theme.tokens['font-family'] === "'Inter', system-ui, sans-serif",
    'the theme carries the font of the draft',
  )
  check(
    !source.includes("from 'imp"),
    'the exported theme file imports nothing from imp',
  )
})

Deno.test('the prose export tables match what imp really exports', async () => {
  const pages = [
    'skills/imports.md',
    'skills/std.md',
    'docs/imports.md',
  ]
  const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
  const problems = []
  const tabulated = new Map(pages.map((page) => [page, []]))

  for (const page of pages) {
    const text = await Deno.readTextFile(join(REPO_ROOT, page))
    for (const [lineIndex, line] of text.split('\n').entries()) {
      if (!line.startsWith('|')) continue
      const cells = line.slice(1, -1).split('|').map((cell) => cell.trim())
      const specifier = cells[0].match(/^`([^`]+)`$/)?.[1]
      if (!specifier || !Object.hasOwn(IMP_MODULE_EXPORTS, specifier)) continue

      const body = cells.slice(1).join(' ')
      const quoted = [...body.matchAll(/`([^`]+)`/g)].map((match) => match[1])
      const listed = quoted.filter((name) => IDENTIFIER.test(name))
      const skillSubjects = quoted
        .map((name) => name.match(/^(?:imp skill )?std\/([A-Za-z_$][\w$]*)$/)?.[1])
        .filter(Boolean)
      if (!listed.length) continue

      tabulated.get(page).push(specifier)
      const exported = Object.keys(IMP_MODULE_EXPORTS[specifier])
      const at = `${page}:${lineIndex + 1}`
      const report = (message) => problems.push(`${at}: '${specifier}' ${message}`)

      for (const name of new Set([...listed, ...skillSubjects])) {
        if (!exported.includes(name)) report(`does not export '${name}'`)
      }
      if (body.includes('...')) continue
      for (const name of exported) {
        if (!listed.includes(name)) {
          report(`exports '${name}', which the table omits - list it, or mark the list with '...'`)
        }
        if (skillSubjects.length && !skillSubjects.includes(name)) {
          report(`exports '${name}', which the skill column omits`)
        }
      }
    }
  }

  const stdGroups = Object.keys(IMP_MODULE_EXPORTS).filter((name) => name.startsWith('imp/std'))
  for (const group of stdGroups) {
    if (!tabulated.get('skills/std.md').includes(group)) {
      problems.push(`skills/std.md: '${group}' has no row - every std group is listed on this page`)
    }
  }

  if (problems.length) throw new Error(`prose is out of date:\n  ${problems.join('\n  ')}`)
})

Deno.test('the prose token tables match the built-in themes', async () => {
  const problems = []
  for (const page of ['skills/theming.md', 'docs/theming.md']) {
    const lines = (await Deno.readTextFile(join(REPO_ROOT, page))).split('\n')
    const header = lines.findIndex((line) =>
      line.startsWith('|') && line.split('|')[2]?.trim() === 'Tokens'
    )
    if (header === -1) {
      problems.push(`${page}: no token table (a row with a 'Tokens' column)`)
      continue
    }
    const listed = new Set()
    for (const line of lines.slice(header + 2)) {
      if (!line.startsWith('|')) break
      for (const [, name] of line.matchAll(/`([^`]+)`/g)) listed.add(name)
    }
    for (const name of listed) {
      if (!Object.hasOwn(defaultTokens(), name)) {
        problems.push(`${page}: lists '${name}', which no built-in theme defines`)
      }
    }
    for (const name of Object.keys(defaultTokens())) {
      if (!listed.has(name)) problems.push(`${page}: omits the '${name}' token`)
    }
  }
  if (problems.length) throw new Error(`token tables are out of date:\n  ${problems.join('\n  ')}`)
})

Deno.test('the lint prose documents exactly the rules that run', async () => {
  const ruleNames = [
    ...Object.keys(impPlugin.rules).map((name) => `imp/${name}`),
    UNREACHABLE_MODULE_RULE,
    UNUSED_EXPORT_RULE,
    COMPUTED_IMPORT_RULE,
    UNIQUE_ANALYTICS_NAME_RULE,
  ]
  const notARule = new Set([...Object.keys(IMP_MODULES), ...Object.keys(IMP_TOOLING_MODULES)])
  const problems = []
  for (const page of ['skills/lint.md', 'docs/lint.md']) {
    const text = await Deno.readTextFile(join(REPO_ROOT, page))
    const documented = new Set(
      [...text.matchAll(/`(imp\/[a-z-]+)`/g)]
        .map((match) => match[1])
        .filter((name) => !notARule.has(name)),
    )
    for (const name of ruleNames) {
      if (!documented.has(name)) problems.push(`${page}: does not document '${name}'`)
    }
    for (const name of documented) {
      if (!ruleNames.includes(name) && name !== MAX_FILE_SIZE_RULE) {
        problems.push(`${page}: documents '${name}', which is not a rule imp runs`)
      }
    }
  }
  if (problems.length) throw new Error(`lint prose is out of date:\n  ${problems.join('\n  ')}`)
})

Deno.test('THIRD-PARTY-LICENSES.md lists every package inside each prebundled tool', async () => {
  const licenses = await Deno.readTextFile(join(REPO_ROOT, 'THIRD-PARTY-LICENSES.md'))
  const tableRows = licenses.split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
  const vendor = join(REPO_ROOT, 'cli', 'src', 'vendor')
  const problems = []
  for await (const entry of Deno.readDir(vendor)) {
    if (!entry.name.endsWith('.js')) continue
    const text = await Deno.readTextFile(join(vendor, entry.name))
    const tool = text.slice('// '.length, text.indexOf('\n'))
    if (!licenses.includes(`\n### ${tool}\n`)) {
      problems.push(`${entry.name}: no generated section '### ${tool}'`)
    }
    for (const id of tool.split(' ')) {
      const at = id.lastIndexOf('@')
      const [name, version] = [id.slice(0, at), id.slice(at + 1)]
      if (!tableRows.some((cells) => cells[1] === name && cells[2] === version)) {
        problems.push(`${entry.name}: no table row for ${name} ${version}`)
      }
    }
  }
  const generatedStart = licenses.indexOf('\n## Packages inside the prebundled tools\n')
  const handWritten = licenses.slice(0, generatedStart)
  const packageLines = licenses.slice(generatedStart).split('\n')
    .filter((line) => /^\S+@\S+ - /.test(line))
  for (const license of new Set(packageLines.map((line) => line.split(' - ')[1]))) {
    if (!handWritten.includes(`lists under ${license}.`)) {
      problems.push(`no license text says it applies to the packages listed under ${license}`)
    }
  }
  if (problems.length) {
    throw new Error(
      `THIRD-PARTY-LICENSES.md is out of date - run tools/prebundle-npm-deps.js:\n  ${
        problems.join('\n  ')
      }`,
    )
  }
})

Deno.test('the dev server serves every bundled asset type with a content type', () => {
  for (const extension of BINARY_ASSET_EXTENSIONS) {
    if (!Object.hasOwn(CONTENT_TYPES, extension)) {
      throw new Error(
        `'${extension}' is bundled as an asset but imp start has no content type for it - it would be served as application/octet-stream`,
      )
    }
  }
})

Deno.test('every imp specifier is linted against its real exports', () => {
  const resolved = Object.keys(IMP_MODULES)
  const linted = Object.keys(IMP_MODULE_EXPORTS)
  for (const specifier of resolved) {
    if (!linted.includes(specifier)) {
      throw new Error(
        `'${specifier}' resolves but cli/src/lint-rules.js imports no module for it - import-source would not cover it`,
      )
    }
  }
  for (const specifier of linted) {
    if (!resolved.includes(specifier)) {
      throw new Error(`cli/src/lint-rules.js lists '${specifier}', which imp does not resolve`)
    }
  }
})

const libraryModules = async () => {
  const found = []
  const walk = async (dir, prefix) => {
    for await (const entry of Deno.readDir(dir)) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory) await walk(join(dir, entry.name), path)
      else if (entry.name.endsWith('.js') && !entry.name.endsWith('.preview.js')) {
        found.push({ path, source: await Deno.readTextFile(join(dir, entry.name)) })
      }
    }
  }
  await walk(join(REPO_ROOT, 'lib', 'src'), '')
  return found.sort((a, b) => a.path.localeCompare(b.path))
}

const MODULE_SCOPE_CALL = /^(?:export )?(?:const|let|var) [\w$]+ = (?:new )?([\w$.]+)\(/

const MODULE_SCOPE_TEMPLATE = /^(?:export )?(?:const|let|var) ([\w$]+) = `/

const CALLABLE_AT_MODULE_SCOPE = ['Symbol', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Object.freeze']

Deno.test('nothing in the library runs work when it is imported', async () => {
  const problems = []
  for (const { path, source } of await libraryModules()) {
    const lines = source.split('\n')
    for (const [index, line] of lines.entries()) {
      const at = `lib/src/${path}:${index + 1}`
      const called = line.match(MODULE_SCOPE_CALL)?.[1]
      if (called && !CALLABLE_AT_MODULE_SCOPE.includes(called)) {
        problems.push(
          `${at}: calls '${called}' at module scope, so a bundler must keep the statement - and ` +
            'with it this module and every module it reaches. Build the value on first use ' +
            `instead. Only ${CALLABLE_AT_MODULE_SCOPE.join(', ')} may be called here: they are ` +
            'globals, so calling one cannot reach another module',
        )
      }
      const template = line.match(MODULE_SCOPE_TEMPLATE)
      if (!template) continue
      const body = []
      for (let next = index + 1; next < lines.length && !lines[next].startsWith('`'); next++) {
        body.push(lines[next])
      }
      if (body.join('\n').includes('token(')) {
        problems.push(
          `${at}: '${template[1]}' builds CSS from tokens at module scope, which pins the theme ` +
            'into every bundle - make it a function so the CSS is built on first render',
        )
      }
    }
  }
  if (problems.length) {
    throw new Error(`the library is not tree-shakeable:\n  ${problems.join('\n  ')}`)
  }
})

Deno.test('a bundle of codeBlock alone carries no editor', async () => {
  const dir = await tempDir()
  await copyDirectory(fixture('build'), dir)
  const build = async (entry, source) => {
    await Deno.writeTextFile(join(dir, entry), source)
    const result = await runImp(['build', entry, '--output', 'code'], dir)
    if (result.code !== 0) throw new Error(`imp build ${entry} failed:\n${result.stderr}`)
    return Deno.readTextFile(join(dir, 'code', entry))
  }
  try {
    const listing = await build(
      'block-only.js',
      "import { codeBlock } from 'imp/std/display'\n\nexport const show = codeBlock\n",
    )
    const editor = await build(
      'editor-only.js',
      "import { codeEditor } from 'imp/std/inputs'\n\nexport const edit = codeEditor\n",
    )
    const problems = []
    const SHARED_VIEW = 'imp.code.copy'
    const EDITOR_ONLY = {
      insertText: 'the key handler of the textarea',
      'imp.codeEditor.keys': 'the editor',
    }
    if (!listing.includes(SHARED_VIEW)) problems.push('block-only.js carries no code view')
    for (const [marker, what] of Object.entries(EDITOR_ONLY)) {
      if (listing.includes(marker)) problems.push(`block-only.js carries ${what}`)
      if (!editor.includes(marker)) problems.push(`editor-only.js carries no ${what}`)
    }
    if (!editor.includes(SHARED_VIEW)) problems.push('editor-only.js carries no code view')
    if (problems.length) {
      throw new Error(
        `the code components are not split at the import:\n  ${problems.join('\n  ')}`,
      )
    }
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

const libraryPreviews = async () => {
  const found = []
  const walk = async (dir, prefix) => {
    for await (const entry of Deno.readDir(dir)) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory) await walk(join(dir, entry.name), path)
      else if (entry.name.endsWith('.preview.js')) {
        found.push({ path, source: await Deno.readTextFile(join(dir, entry.name)) })
      }
    }
  }
  await walk(join(REPO_ROOT, 'lib', 'src'), '')
  return found.sort((a, b) => a.path.localeCompare(b.path))
}

const RELATIVE_IMPORT = /^import\b[^'"]*['"](\.{1,2}\/[^'"]*)['"]/

const libraryGroupsModule = async () => {
  const config = JSON.parse(await Deno.readTextFile(join(REPO_ROOT, 'lib', 'src', 'imp.json')))
  return posixNormalize(config.preview.groups)
}

Deno.test('a library preview imports imp through its entry points only', async () => {
  const problems = []
  const groupsModule = await libraryGroupsModule()
  for (const { path, source } of await libraryPreviews()) {
    for (const [index, line] of source.split('\n').entries()) {
      const relativeImport = line.match(RELATIVE_IMPORT)?.[1]
      if (relativeImport && posixJoin(posixDirname(path), relativeImport) === groupsModule) {
        continue
      }
      if (relativeImport) {
        problems.push(
          `lib/src/${path}:${
            index + 1
          }: imports '${relativeImport}' by path. The preview bundles ` +
            'that file as a second copy of the library beside the one in the binary, and the two ' +
            "copies do not recognise each other's components. Import from 'imp', 'imp/std', " +
            "'imp/state' or another imp entry point instead",
        )
      }
    }
  }
  if (problems.length) {
    throw new Error(`a preview bypasses the imp entry points:\n  ${problems.join('\n  ')}`)
  }
})

Deno.test('an app carries only the parts of imp it imports', async () => {
  const dir = await tempDir()
  try {
    await Deno.writeTextFile(join(dir, 'imp.json'), '{"name":"shaking"}\n')
    const entries = {
      minimal: "import { mount } from 'imp'\nimport { div } from 'imp/html'\n" +
        "mount(document.body, div('hi'))\n",
      tags: "import { mount } from 'imp'\nimport * as tags from 'imp/html'\n" +
        'mount(document.body, tags.div(Object.keys(tags).length))\n',
      button: "import { mount } from 'imp'\nimport { button } from 'imp/std'\n" +
        "mount(document.body, button('hi'))\n",
      buttonAndLink: "import { mount } from 'imp'\nimport { button, link } from 'imp/std'\n" +
        "mount(document.body, button('hi'), link({ href: '/x' }, 'x'))\n",
      oneIcon: "import { mount } from 'imp'\nimport { icon } from 'imp/std'\n" +
        "import { luHouse } from 'imp/icons'\nmount(document.body, icon(luHouse))\n",
    }
    const size = {}
    for (const [name, source] of Object.entries(entries)) {
      await Deno.writeTextFile(join(dir, `${name}.js`), source)
      const { code, stderr } = await runImp(['build', `${name}.js`, '--output', name], dir)
      check(code === 0, `imp build ${name}.js exited ${code}: ${stderr}`)
      size[name] = (await Deno.stat(join(dir, name, `${name}.js`))).size
    }

    const KB = 1024
    check(
      size.minimal < 5 * KB,
      `an entry that only mounts an element builds ${size.minimal} B - over 5 kB means it is ` +
        'carrying state, theming, i18n or the router, none of which it imports',
    )
    check(
      size.tags - size.minimal > 2 * KB,
      `all of imp/html costs only ${size.tags - size.minimal} B over two tags - tag shaking broke`,
    )
    check(
      size.buttonAndLink - size.button > 2 * KB,
      `adding link to a button-only entry costs ${size.buttonAndLink - size.button} B - link and ` +
        'the router it pulls are already in the button bundle, so imp/std is not shaking per export',
    )
    check(
      size.oneIcon < 25 * KB,
      `an entry drawing one Lucide icon builds ${size.oneIcon} B - over 25 kB means the whole ` +
        '434 kB icon table came with it, so imp/icons is not shaking per export',
    )
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('parseSpecifier', async () => {
  const inputs = [
    'mitt',
    'mitt@3.0.1',
    'npm:mitt@3.0.1',
    'npm:@scope/pkg@1.2.3/sub/module.js',
    'jsr:@std/encoding@1.0.10/base64',
    'jsr:@std/encoding',
    'preact@10.19.3/hooks',
    'not@a@version',
    '@lonely-scope',
    '',
  ]
  const transcript = inputs
    .map((input) => {
      const parsed = parseSpecifier(input)
      const alias = parsed ? ` alias=${defaultAlias(parsed)}` : ''
      return `'${input}' -> ${JSON.stringify(parsed)}${alias}`
    })
    .join('\n')
  await assertSnapshot('parse-specifiers', transcript + '\n')
})
