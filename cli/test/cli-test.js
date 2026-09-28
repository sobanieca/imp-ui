import {
  dirname,
  fromFileUrl,
  join,
  normalize as normalizePath,
  relative,
  toFileUrl,
} from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { clientScript } from '../src/client.js'
import { createMocks } from '../src/mocks.js'
import { createDevLog } from '../src/dev-log.js'
import { BINARY_ASSET_EXTENSIONS, bundleDependency, shutdownBundler } from '../src/deps.js'
import { CONTENT_TYPES, injectImp, resolveWithinRoot } from '../src/start.js'
import { envInjectionScript, resolveEnvironment } from '../src/environments.js'
import { defaultAlias, parseSpecifier } from '../src/specifiers.js'
import { formatReview, isLocalRequest, readWidgetMark, reviewFileName } from '../src/review.js'
import { themeFileSource } from '../../lib/src/theme-draft.js'
import { entryShell, previewIdentity, renderDescription, renderSkill } from '../src/preview.js'
import { scanGroupsModule, scanPreviewSource } from '../src/preview-source.js'

const widgetMark = await readWidgetMark()
import { findSkill, skillIndex, SKILLS, standardComponentSubjects } from '../src/skill.js'
import impPlugin, { IMP_MODULE_EXPORTS } from '../src/lint-rules.js'
import { MAX_FILE_SIZE_RULE } from '../src/lint.js'
import {
  COMPUTED_IMPORT_RULE,
  UNREACHABLE_MODULE_RULE,
  UNUSED_EXPORT_RULE,
} from '../src/dead-code.js'
import { IMP_MODULES, IMP_TOOLING_MODULES } from '../src/specifiers.js'
import { buildTokens, colorSchemeOf, defaultTokens, THEME_DEFAULTS } from '../../lib/src/theme.js'
import { VERSION } from '../src/version.js'

const ROOT = fromFileUrl(new URL('..', import.meta.url))
const REPO_ROOT = fromFileUrl(new URL('../..', import.meta.url))
const IMP = join(REPO_ROOT, Deno.build.os === 'windows' ? 'imp.exe' : 'imp')
const fixture = (name) => join(ROOT, 'test', 'fixtures', name)

async function listFiles(dir, prefix = '') {
  const found = []
  for await (const entry of Deno.readDir(dir)) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory) found.push(...await listFiles(join(dir, entry.name), path))
    else found.push(path)
  }
  return found
}

const withoutDownloadNoise = (result) => ({
  ...result,
  stderr: result.stderr
    .split('\n')
    .filter((line) => !/^Download(ing)? /.test(line))
    .join('\n'),
})

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, 'g')

const normalize = (text) =>
  text.replaceAll(ANSI, '').replaceAll(ROOT, '<root>/').replaceAll(VERSION, '<version>')
    .replace(/\b\d+ms\b/g, '*ms')
    .replace(/time="[\d.]+"/g, 'time="*"')
    .replace(/"durationMs": \d+/g, '"durationMs": *')
    .replace(/^( *)at .*:\d+:\d+\)?\n(?:\1at .*:\d+:\d+\)?\n?)*/gm, '$1at <stack frames>\n')

const section = (label, text) => `--- ${label} ---\n${text.trim() ? text.trimEnd() : '(empty)'}`

const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

const commandTranscript = (display, { code, stdout, stderr }) =>
  `$ ${display}\nexit code: ${code}\n\n${section('stdout', stdout)}\n\n${
    section('stderr', stderr)
  }\n`

async function runImp(args, cwd = ROOT) {
  const { code, stdout, stderr } = await new Deno.Command(IMP, {
    args,
    cwd,
    stdout: 'piped',
    stderr: 'piped',
  }).output()
  return {
    code,
    stdout: normalize(new TextDecoder().decode(stdout)),
    stderr: normalize(new TextDecoder().decode(stderr)),
  }
}

Deno.test('imp commands', async (t) => {
  const test = async (name, args, cwd) => {
    await t.step(name, async () => {
      const result = await runImp(args, cwd)
      const location = cwd ? `  (cwd: ${cwd.slice(ROOT.length)})` : ''
      await assertSnapshot(name, commandTranscript(`imp ${args.join(' ')}${location}`, result))
    })
  }

  await test('help', [])
  await test('help-command', ['help'])
  await test('unknown-command', ['bogus'])
  await test('skill-index', ['skill'])
  await test('skill-unknown-subject', ['skill', 'bogus'])
  await test('skill-std-component', ['skill', 'std/button'])
  await test('skill-project-component', ['skill', './counter.js'], fixture('skill-project'))
  await test('skill-missing-component', ['skill', './widget.js'], fixture('skill-project'))
  await test('map-prints-the-tree', ['map'], fixture('map'))
  await test('map-prints-a-part', ['map', 'src/admin/map.js'], fixture('map'))
  await test('map-without-a-map-export', ['map', 'src/no-map.js'], fixture('map'))
  await test('map-without-a-config-key', ['map'], fixture('basic'))
  await test('map-missing-file', ['map', 'src/elsewhere.js'], fixture('map'))
  await test('lint-clean', ['lint', 'app.js'], fixture('with-config'))
  await test('lint-vendored-imports', ['lint', 'app.js'], fixture('basic'))
  await test('lint-capital-component', ['lint', 'components.js'], fixture('lint-bad'))
  await test('lint-multiple-props-objects', ['lint', 'app.js'], fixture('lint-props'))
  await test('lint-state-name-namespace', ['lint', 'app.js'], fixture('lint-state'))
  await test('lint-http-client-name-namespace', ['lint', 'app.js'], fixture('lint-http-client'))
  await test('lint-no-root-query-in-setup', ['lint', 'app.js'], fixture('lint-root-query'))
  await test('lint-watch-with-self', ['lint', 'app.js'], fixture('lint-watch'))
  await test('lint-self-first-argument', ['lint', 'app.js'], fixture('lint-self-first'))
  await test('lint-no-self-in-loading', ['lint', 'app.js'], fixture('lint-loading-self'))
  await test('lint-loading-with-async-setup', ['lint', 'app.js'], fixture('lint-loading-sync'))
  await test('lint-on-remove-through-self', ['lint', 'app.js'], fixture('lint-on-remove'))
  await test('lint-no-self-at-module-scope', ['lint', 'app.js'], fixture('lint-module-scope'))
  await test('lint-abort-check-after-await', ['lint', 'app.js'], fixture('lint-abort-check'))
  await test('lint-no-state-as-child', ['lint', 'app.js'], fixture('lint-state-child'))
  await test('lint-no-get-in-binding', ['lint', 'app.js'], fixture('lint-get-binding'))
  await test('lint-component-name', ['lint', 'app.js'], fixture('lint-component'))
  await test('lint-import-source', ['lint', 'app.js'], fixture('lint-import-source'))
  await test('lint-icons-by-name', ['lint', 'app.js'], fixture('lint-icons'))
  await test('lint-html-embedded-script', ['lint', 'index.html'], fixture('lint-html'))
  await test('lint-dependency-errors', ['lint', 'app.js'], fixture('lint-unpinned'))
  await test('lint-ignore-directive', ['lint', 'app.js'], fixture('lint-ignore'))
  await test('lint-dead-code', ['lint'], fixture('lint-dead-code'))
  await test('lint-path-not-found', ['lint', 'missing.js'], fixture('basic'))
  await test('lint-invalid-imp-json', ['lint', 'app.js'], fixture('broken-config'))
  await test('fmt-check-clean', ['fmt', '--check', 'app.js'], fixture('basic'))
  await test('fmt-check-dirty', ['fmt', '--check', 'messy.js'], fixture('fmt-dirty'))
  await test('fmt-check-multi-language', ['fmt', '--check'], fixture('fmt-multi'))
  await test('fmt-ignore-directive', ['fmt', '--check', 'app.js'], fixture('fmt-ignore'))
  await test('fmt-path-not-found', ['fmt', 'missing.js'], fixture('basic'))
  await test('fmt-invalid-imp-json', ['fmt', '--check', 'app.js'], fixture('broken-config'))
  await test('review-empty', ['review'], fixture('basic'))
  await test('review-unknown-argument', ['review', 'bogus'], fixture('basic'))
  await test('logs-unknown-argument', ['logs', 'bogus'], fixture('basic'))
  await test('logs-bad-count', ['logs', '-n', 'abc'], fixture('basic'))

  await t.step('logs-no-log', async () => {
    const dir = await Deno.makeTempDir()
    await Deno.writeTextFile(join(dir, 'imp.json'), '{}\n')
    await Deno.mkdir(join(dir, 'src'))
    const result = await runImp(['logs'], join(dir, 'src'))
    await Deno.mkdir(join(dir, 'lib', 'src', '.imp'), { recursive: true })
    await Deno.writeTextFile(join(dir, 'lib', 'src', '.imp', 'dev.log'), '[INFO] preview\n')
    await Deno.mkdir(join(dir, 'node_modules', 'pkg', '.imp'), { recursive: true })
    await Deno.writeTextFile(join(dir, 'node_modules', 'pkg', '.imp', 'dev.log'), 'hidden\n')
    const nested = await runImp(['logs'], join(dir, 'src'))
    await Deno.remove(dir, { recursive: true })
    for (const run of [result, nested]) run.stderr = run.stderr.replaceAll(dir, '<tmp>')
    await assertSnapshot(
      'logs-no-log',
      `${commandTranscript('imp logs  (cwd: <tmp>/src)', result)}\n` +
        `${commandTranscript('imp logs  (cwd: <tmp>/src, log in lib/src)', nested)}`,
    )
  })

  await t.step('logs-prints-the-session', async () => {
    const dir = await Deno.makeTempDir()
    await Deno.writeTextFile(join(dir, 'imp.json'), '{}\n')
    await Deno.mkdir(join(dir, '.imp'))
    await Deno.mkdir(join(dir, 'src'))
    const entries = [
      '[INFO] imp start serving index.html',
      '[browser:log] counter mounted',
      '[net] GET /api/todos -> 200 12ms',
      '[browser:error] Uncaught TypeError: x is not a function',
    ]
    await Deno.writeTextFile(join(dir, '.imp', 'dev.log'), entries.join('\n') + '\n')
    const whole = await runImp(['logs'], dir)
    const last = await runImp(['logs', '-n', '2'], join(dir, 'src'))
    const more = await runImp(['logs', '-n', '10'], dir)
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'logs-prints-the-session',
      `${commandTranscript('imp logs  (cwd: <tmp>)', whole)}\n` +
        `${commandTranscript('imp logs -n 2  (cwd: <tmp>/src)', last)}\n` +
        `${commandTranscript('imp logs -n 10  (cwd: <tmp>)', more)}`,
    )
  })

  await t.step('logs-follows-the-session', async () => {
    const dir = await Deno.makeTempDir()
    await Deno.writeTextFile(join(dir, 'imp.json'), '{ "maxLogEntries": 3 }\n')
    const devLog = await createDevLog({ root: dir, maxEntries: 3 })
    await devLog.write('first')
    await devLog.write('second')
    const child = new Deno.Command(IMP, {
      args: ['logs', '-f'],
      cwd: dir,
      stdin: 'null',
      stdout: 'piped',
      stderr: 'piped',
    }).spawn()
    const reader = child.stdout.getReader()
    const decoder = new TextDecoder()
    let output = ''
    const readUntil = async (text) => {
      while (!output.includes(text)) {
        const { value, done } = await reader.read()
        if (done) break
        output += decoder.decode(value)
      }
    }
    await readUntil('second\n')
    const later = Array.from({ length: 9 }, (_, index) => `entry ${index + 1}`)
    for (const entry of later) {
      await devLog.write(entry)
      await readUntil(`${entry}\n`)
    }
    child.kill('SIGINT')
    const status = await child.status
    await reader.cancel().catch(() => {})
    await devLog.close()
    const stderr = await new Response(child.stderr).text()
    const finalLog = await Deno.readTextFile(devLog.path)
    await Deno.remove(dir, { recursive: true })
    check(
      output === ['first', 'second', ...later].join('\n') + '\n',
      `imp logs -f printed every entry once and in order:\n${output}`,
    )
    check(stderr === '', `imp logs -f wrote nothing to stderr:\n${stderr}`)
    check(status.code === 0, `imp logs -f exits 0 on Ctrl-C, got ${status.code}`)
    check(
      finalLog === 'entry 5\nentry 6\nentry 7\nentry 8\nentry 9\n',
      `the log was rewritten in place while it was followed:\n${finalLog}`,
    )
  })
  await test('resize-guidance', ['resize', 'logo.png'], fixture('resize'))
  await test('resize-usage', ['resize'], fixture('resize'))
  await test('resize-unsupported-format', ['resize', 'photo.bmp', '-w', '100'], fixture('resize'))
  await test('resize-webp-deferred', ['resize', 'hero.webp', '-w', '100'], fixture('resize'))
  await test('resize-missing-file', ['resize', 'missing.png', '-w', '100'], fixture('resize'))
  await test('resize-bad-dimension', ['resize', 'logo.png', '-w', 'abc'], fixture('resize'))
  await test('resize-upscale-clamped', ['resize', 'logo.png', '-w', '9000'], fixture('resize'))
  await test(
    'resize-stretch-requires-both',
    ['resize', 'logo.png', '-w', '100', '--stretch'],
    fixture('resize'),
  )

  await t.step('init-scaffold', async () => {
    const dir = await Deno.makeTempDir()
    const created = await runImp(['init', 'app'], dir)
    const project = join(dir, 'app')
    const files = (await listFiles(project)).sort()
    const sources = []
    for (const file of files) {
      if (file.endsWith('.svg')) continue
      const contents = await Deno.readTextFile(join(project, file))
      sources.push(`--- ${file} ---\n${contents.replaceAll(VERSION, '<version>')}`)
    }
    const again = await runImp(['init'], project)
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'init-scaffold',
      `${commandTranscript('imp init app  (cwd: <tmp>)', created)}\n` +
        `--- files ---\n${files.join('\n')}\n\n${sources.join('\n')}\n` +
        `${commandTranscript('imp init  (cwd: <tmp>/app)', again)}`,
    )
  })

  await t.step('init-merges-existing-gitignore', async () => {
    const dir = await Deno.makeTempDir()
    const existing = '# my stuff\nnode_modules\n*.log\n.env*\n/dist\n.DS_Store\n'
    await Deno.writeTextFile(join(dir, '.gitignore'), existing)
    const merged = await runImp(['init'], dir)
    const afterMerge = await Deno.readTextFile(join(dir, '.gitignore'))
    const covered = await Deno.makeTempDir()
    await Deno.writeTextFile(join(covered, '.gitignore'), afterMerge)
    const again = await runImp(['init'], covered)
    const afterSecondRun = await Deno.readTextFile(join(covered, '.gitignore'))
    await Deno.remove(dir, { recursive: true })
    await Deno.remove(covered, { recursive: true })
    await assertSnapshot(
      'init-merges-existing-gitignore',
      `--- existing .gitignore ---\n${existing}\n` +
        `${commandTranscript('imp init  (cwd: <tmp>)', merged)}\n` +
        `--- merged .gitignore ---\n${afterMerge}\n` +
        `${commandTranscript('imp init  (cwd: <tmp2>, already covered)', again)}\n` +
        `--- .gitignore after the second run (unchanged) ---\n${afterSecondRun}`,
    )
  })

  await t.step('init-pwa-scaffold', async () => {
    const dir = join(await Deno.makeTempDir(), 'my-shop')
    await Deno.mkdir(dir)
    const created = await runImp(['init', '--pwa'], dir)
    const files = (await listFiles(dir)).sort()
    const config = (await Deno.readTextFile(join(dir, 'imp.json')))
      .replaceAll(VERSION, '<version>')
    await Deno.remove(dirname(dir), { recursive: true })
    await assertSnapshot(
      'init-pwa-scaffold',
      `${commandTranscript('imp init --pwa  (cwd: <tmp>/my-shop)', created)}\n` +
        `--- files ---\n${files.join('\n')}\n\n--- imp.json ---\n${config}`,
    )
  })

  await t.step('init-project-passes-lint-fmt-and-tests', async () => {
    const dir = await Deno.makeTempDir()
    await runImp(['init', 'app'], dir)
    const project = join(dir, 'app')
    const lint = await runImp(['lint'], project)
    const fmt = await runImp(['fmt', '--check'], project)
    const unit = await runImp(['test', '--unit'], project)
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'init-project-passes-lint-fmt-and-tests',
      `${commandTranscript('imp lint  (cwd: <tmp>/app)', lint)}\n` +
        `${commandTranscript('imp fmt --check  (cwd: <tmp>/app)', fmt)}\n` +
        `${commandTranscript('imp test --unit  (cwd: <tmp>/app)', unit)}`,
    )
  })

  await t.step('resize-writes-file', async () => {
    const dir = await Deno.makeTempDir()
    const pngSize = async (name) => {
      const bytes = await Deno.readFile(join(dir, name))
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
      return `${name}: ${isPng ? 'PNG' : 'NOT PNG'} ${width}x${height}`
    }
    await Deno.copyFile(join(fixture('resize'), 'logo.png'), join(dir, 'logo.png'))
    const inPlace = await runImp(['resize', 'logo.png', '-w', '150'], dir)
    const copy = await runImp(['resize', 'logo.png', '-h', '30', '--output', 'small.png'], dir)
    const boxFit = await runImp(
      ['resize', 'logo.png', '-w', '100', '-h', '100', '--output', 'box.png'],
      dir,
    )
    const stretched = await runImp(
      ['resize', 'logo.png', '-w', '100', '-h', '100', '--stretch', '--output', 'stretched.png'],
      dir,
    )
    const overwritten = await pngSize('logo.png')
    const sibling = await pngSize('small.png')
    const boxFitOutput = await pngSize('box.png')
    const stretchedOutput = await pngSize('stretched.png')
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'resize-writes-file',
      `${commandTranscript('imp resize logo.png -w 150  (cwd: <tmp>)', inPlace)}\n` +
        `--- overwritten source ---\n${overwritten}\n\n` +
        `${
          commandTranscript('imp resize logo.png -h 30 --output small.png  (cwd: <tmp>)', copy)
        }\n` +
        `--- sibling output ---\n${sibling}\n\n` +
        `${
          commandTranscript(
            'imp resize logo.png -w 100 -h 100 --output box.png  (cwd: <tmp>)',
            boxFit,
          )
        }\n` +
        `--- box-fit output ---\n${boxFitOutput}\n\n` +
        `${
          commandTranscript(
            'imp resize logo.png -w 100 -h 100 --stretch --output stretched.png  (cwd: <tmp>)',
            stretched,
          )
        }\n` +
        `--- stretched output ---\n${stretchedOutput}`,
    )
  })

  await t.step('lint-fix-writes-file', async () => {
    const dir = await Deno.makeTempDir()
    const file = join(dir, 'app.js')
    await Deno.copyFile(join(fixture('lint-fix'), 'app.js'), file)
    const result = await runImp(['lint', '--fix', 'app.js'], dir)
    const fixed = await Deno.readTextFile(file)
    const again = await runImp(['lint', '--fix', 'app.js'], dir)
    const afterSecondRun = await Deno.readTextFile(file)
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'lint-fix-writes-file',
      `${
        commandTranscript('imp lint --fix app.js  (cwd: <tmp>)', result)
      }\n--- fixed file ---\n${fixed}\n--- second run (idempotent) ---\n${
        commandTranscript('imp lint --fix app.js  (cwd: <tmp>)', again)
      }\n--- file after second run ---\n${afterSecondRun}`,
    )
  })

  await t.step('lint-fix-import-source', async () => {
    const dir = await Deno.makeTempDir()
    const file = join(dir, 'app.js')
    await Deno.copyFile(join(fixture('lint-import-source'), 'app.js'), file)
    const result = await runImp(['lint', '--fix', 'app.js'], dir)
    const fixed = await Deno.readTextFile(file)
    const again = await runImp(['lint', '--fix', 'app.js'], dir)
    const afterSecondRun = await Deno.readTextFile(file)
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'lint-fix-import-source',
      `${
        commandTranscript('imp lint --fix app.js  (cwd: <tmp>)', result)
      }\n--- fixed file ---\n${fixed}\n--- second run (idempotent) ---\n${
        commandTranscript('imp lint --fix app.js  (cwd: <tmp>)', again)
      }\n--- file after second run ---\n${afterSecondRun}`,
    )
  })

  await t.step('lint-fix-html', async () => {
    const dir = await Deno.makeTempDir()
    const file = join(dir, 'index.html')
    await Deno.copyFile(join(fixture('lint-fix'), 'index.html'), file)
    const result = await runImp(['lint', '--fix', 'index.html'], dir)
    const fixed = await Deno.readTextFile(file)
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'lint-fix-html',
      `${
        commandTranscript('imp lint --fix index.html  (cwd: <tmp>)', result)
      }\n--- fixed file ---\n${fixed}`,
    )
  })

  await t.step('lint-file-size-limit', async () => {
    const dir = await Deno.makeTempDir()
    await new Deno.Command('git', { args: ['init', '-q'], cwd: dir }).output()
    await Deno.writeTextFile(join(dir, 'app.js'), "console.log('ok')\n")
    await Deno.writeTextFile(join(dir, 'big.txt'), 'x'.repeat(300 * 1024))
    await Deno.writeTextFile(join(dir, 'huge.bin'), 'y'.repeat(300 * 1024))
    await new Deno.Command('git', { args: ['add', '-A'], cwd: dir }).output()

    const oversized = await runImp(['lint', 'app.js'], dir)

    await Deno.writeTextFile(join(dir, 'imp.json'), '{ "maxFileSizeIgnore": ["huge.bin"] }\n')
    const partiallyIgnored = await runImp(['lint', 'app.js'], dir)

    await Deno.writeTextFile(join(dir, 'imp.json'), '{ "maxFileSize": 400000 }\n')
    const raised = await runImp(['lint', 'app.js'], dir)

    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'lint-file-size-limit',
      `--- oversized (default limit) ---\n${
        commandTranscript('imp lint app.js  (cwd: <tmp>)', oversized)
      }\n--- one path ignored ---\n${
        commandTranscript('imp lint app.js  (cwd: <tmp>)', partiallyIgnored)
      }\n--- limit raised ---\n${commandTranscript('imp lint app.js  (cwd: <tmp>)', raised)}`,
    )
  })

  await t.step('lint-dead-code-escape-hatches', async () => {
    const dir = await Deno.makeTempDir()
    await Deno.mkdir(join(dir, 'src'))
    await Deno.writeTextFile(
      join(dir, 'index.html'),
      '<!doctype html>\n<script type="module" src="/src/app.js"></script>\n',
    )
    await Deno.writeTextFile(
      join(dir, 'src', 'app.js'),
      "import { used } from './lib.js'\n\nconsole.log(used)\n",
    )
    await Deno.writeTextFile(
      join(dir, 'src', 'lib.js'),
      'export const used = 1\n\nexport const external = 2\n',
    )
    await Deno.writeTextFile(
      join(dir, 'src', 'sdk.js'),
      "export * from './sdk_core.js'\n\nexport const open = () => 'ok'\n",
    )
    await Deno.writeTextFile(join(dir, 'src', 'sdk_core.js'), 'export const connect = 1\n')

    const reported = await runImp(['lint'], dir)

    await Deno.writeTextFile(
      join(dir, 'imp.json'),
      '{ "lint": { "publicExports": ["src/sdk.js", "src/lib.js#external"] } }\n',
    )
    const granted = await runImp(['lint'], dir)

    await Deno.writeTextFile(join(dir, 'src', 'never.js'), 'export const gone = 3\n')
    await Deno.writeTextFile(
      join(dir, 'src', 'app.js'),
      "import { used } from './lib.js'\n\nexport const load = (name) => import(name)\n\nconsole.log(used)\n",
    )
    const computed = await runImp(['lint'], dir)

    await Deno.mkdir(join(dir, 'src', 'pages'))
    await Deno.rename(join(dir, 'src', 'never.js'), join(dir, 'src', 'pages', 'home.js'))
    await Deno.writeTextFile(
      join(dir, 'src', 'app.js'),
      "import { used } from './lib.js'\n\nexport const load = (name) => import(`./pages/${name}.js`)\n\nconsole.log(used)\n",
    )
    const folder = await runImp(['lint'], dir)

    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'lint-dead-code-escape-hatches',
      `--- reported ---\n${commandTranscript('imp lint  (cwd: <tmp>)', reported)}\n` +
        `--- publicExports ---\n${commandTranscript('imp lint  (cwd: <tmp>)', granted)}\n` +
        `--- computed dynamic import ---\n${
          commandTranscript('imp lint  (cwd: <tmp>)', computed)
        }\n` +
        `--- folder named in a template ---\n${
          commandTranscript('imp lint  (cwd: <tmp>)', folder)
        }`,
    )
  })

  await t.step('fmt-writes-file', async () => {
    const dir = await Deno.makeTempDir()
    const file = join(dir, 'messy.js')
    await Deno.writeTextFile(file, 'const  a=1;\nconst   double=(x)=>x*2\nexport { a,double }\n')
    const result = await runImp(['fmt', 'messy.js'], dir)
    const formatted = await Deno.readTextFile(file)
    await Deno.remove(dir, { recursive: true })
    await assertSnapshot(
      'fmt-writes-file',
      `${
        commandTranscript('imp fmt messy.js  (cwd: <tmp>)', result)
      }\n--- formatted file ---\n${formatted}`,
    )
  })
})

Deno.test('imp install and uninstall', async (t) => {
  const dir = await Deno.makeTempDir()

  const maskLatest = (text) =>
    text
      .replace(/@\d+\.\d+\.\d+([-+][\w.-]+)?/g, '@<latest>')
      .replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')

  const projectState = async () => {
    const files = []
    const walk = async (directory, prefix) => {
      for await (const entry of Deno.readDir(directory)) {
        if (entry.isDirectory) await walk(join(directory, entry.name), `${prefix}${entry.name}/`)
        else files.push(prefix + entry.name)
      }
    }
    await walk(join(dir, 'dependencies'), 'dependencies/').catch(() => {})
    files.sort()
    const impJson = await Deno.readTextFile(join(dir, 'imp.json')).catch(() => '(missing)')
    return `\n${section('files', files.join('\n'))}\n\n${section('imp.json', impJson)}\n`
  }

  const test = async (name, args, { state = true, mask = (text) => text } = {}) => {
    await t.step(name, async () => {
      const result = withoutDownloadNoise(await runImp(args, dir))
      const transcript = commandTranscript(`imp ${args.join(' ')}  (cwd: <tmp>)`, result)
      const suffix = state ? await projectState() : ''
      await assertSnapshot(name, mask(transcript + suffix))
    })
  }

  try {
    await t.step('install-nothing-declared', async () => {
      const empty = await Deno.makeTempDir()
      const result = withoutDownloadNoise(await runImp(['install'], empty))
      await Deno.remove(empty, { recursive: true })
      await assertSnapshot(
        'install-nothing-declared',
        commandTranscript('imp install  (cwd: <tmp>)', result),
      )
    })

    await test('install-pinned-npm', ['install', 'mitt@3.0.1'])
    await test('install-alias-flag', ['install', 'mitt', '3.0.1', '--alias', 'bus'])

    await t.step('install-jsr-subpath', async () => {
      const result = withoutDownloadNoise(
        await runImp(['install', 'jsr:@std/encoding@1.0.10/base64'], dir),
      )
      const module = await import(toFileUrl(join(dir, 'dependencies', 'base64', 'base64.js')).href)
      const usage = `[vendored module: encodeBase64('imp') returned '${
        module.encodeBase64('imp')
      }']`
      await assertSnapshot(
        'install-jsr-subpath',
        `${
          commandTranscript(
            'imp install jsr:@std/encoding@1.0.10/base64  (cwd: <tmp>)',
            result,
          )
        }\n${usage}\n${await projectState()}`,
      )
    })

    await test('uninstall-removes-dependency', ['uninstall', 'bus'])
    await test('install-update-all', ['install'], { mask: maskLatest })
    await test('install-imp-package-rejected', ['install', 'imp'], { state: false })
    await test('install-imp-alias-rejected', ['install', 'mitt', '3.0.1', '--alias', 'imp'], {
      state: false,
    })

    await t.step('install-imp-alias-declared', async () => {
      const declared = await Deno.makeTempDir()
      await Deno.writeTextFile(
        join(declared, 'imp.json'),
        '{ "dependencies": { "imp": "npm:imp@1.0.1" } }\n',
      )
      const result = withoutDownloadNoise(await runImp(['install'], declared))
      await Deno.remove(declared, { recursive: true })
      await assertSnapshot(
        'install-imp-alias-declared',
        commandTranscript('imp install  (cwd: <tmp>)', result),
      )
    })

    await test('install-unknown-package', ['install', 'imp-test-no-such-package-404'], {
      state: false,
    })
    await test('install-range-version-rejected', ['install', 'mitt@^3'], { state: false })
    await test('uninstall-undeclared', ['uninstall', 'lodash'], { state: false })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp install license policy', async (t) => {
  const withPolicy = async (name, licenses, args) => {
    await t.step(name, async () => {
      const dir = await Deno.makeTempDir()
      await Deno.writeTextFile(
        join(dir, 'imp.json'),
        `${JSON.stringify({ licenses }, null, 2)}\n`,
      )
      const result = withoutDownloadNoise(await runImp(args, dir))
      const wrote = await Deno.stat(join(dir, 'dependencies')).then(() => 'yes').catch(() => 'no')
      await Deno.remove(dir, { recursive: true })
      await assertSnapshot(
        name,
        `${
          commandTranscript(`imp ${args.join(' ')}  (cwd: <tmp>)`, result)
        }\n--- wrote dependencies/ ---\n${wrote}\n`,
      )
    })
  }

  await withPolicy('license-permissive-blocks-weak-copyleft', 'permissive', [
    'install',
    'axe-core@4.8.2',
  ])
  await withPolicy('license-weak-copyleft-allows-mpl', 'weak-copyleft', [
    'install',
    'axe-core@4.8.2',
  ])
  await withPolicy('license-allow-list-blocks-apache', ['MIT', 'ISC'], ['install', 'long@5.2.3'])
  await withPolicy('license-or-expression-takes-permissive-branch', 'permissive', [
    'install',
    'node-forge@0.7.0',
  ])
  await withPolicy('license-unknown-warns-only', 'permissive', [
    'install',
    'jsr:@std/encoding@1.0.10/base64',
  ])
  await withPolicy('license-invalid-policy-value', 'mostly-fine', ['install', 'mitt@3.0.1'])
})

Deno.test('imp test', async (t) => {
  const test = async (name, args, cwd) => {
    await t.step(name, async () => {
      const result = await runImp(args, cwd)
      const location = cwd ? `  (cwd: ${cwd.slice(ROOT.length)})` : ''
      await assertSnapshot(name, commandTranscript(`imp ${args.join(' ')}${location}`, result))
    })
  }

  await test('test-unit-pass', ['test', 'counter.test.js'], fixture('test-unit'))
  await test('test-fake-timers', ['test'], fixture('test-fake-timers'))
  await test('test-mock', ['test', 'profile.test.js'], fixture('test-mock'))
  await test('test-unit-fail', ['test'], fixture('test-fail'))
  await test('test-unit-filter', ['test', 'lib.test.js', '--filter', 'adds'], fixture('test-unit'))
  await test('test-choose-level', ['test'], fixture('test-list'))
  await test('test-unit-level', ['test', '--unit'], fixture('test-unit'))
  await test('test-unit-level-jobs', ['test', '--unit', '--jobs', '1'], fixture('test-unit'))
  await test('test-unit-level-fail', ['test', '--unit'], fixture('test-fail'))
  await test('test-bad-jobs', ['test', '--unit', '--jobs', '0'], fixture('test-unit'))
  await test('test-list-flag', ['test', '--list'], fixture('test-list'))
  await test('test-list-flag-e2e-only', ['test', '--e2e', '--list'], fixture('test-list'))
  await test('test-not-a-test-file', ['test', 'app.js'], fixture('basic'))
  await test('test-no-files', ['test'], fixture('with-config'))
  await test('test-missing-entry', ['test', 'login.spec.js'], fixture('test-list'))
  await test('preview-list', ['preview', '--list'], fixture('preview'))
  await test('preview-list-json', ['preview', '--list', '--json'], fixture('preview'))
  await test(
    'preview-list-inferred-sibling',
    ['preview', 'components/counter.js', '--list'],
    fixture('preview'),
  )
  await test('preview-not-a-preview-file', ['preview', 'http.js'], fixture('preview'))
  await test('preview-path-not-found', ['preview', 'missing.preview.js'], fixture('preview'))
  await test('preview-none-found', ['preview'], fixture('basic'))
  await test('preview-theme-not-found', ['preview'], fixture('preview-bad-theme'))
  await test('preview-translations-not-found', ['preview'], fixture('preview-bad-translations'))
  await test('preview-groups-not-found', ['preview'], fixture('preview-bad-groups'))
  await test('preview-entry-not-found', ['preview'], fixture('preview-bad-entry'))
  await test('preview-bad-port', ['preview', '--port', 'abc'], fixture('preview'))
})

const isTelemetryLine = (line) => line.startsWith('[BROWSER:') || line.startsWith('[HTTP]')

const withoutTelemetry = (result) => ({
  ...result,
  stdout: result.stdout.split('\n').filter((line) => !isTelemetryLine(line)).join('\n'),
})

const localBrowser = await (async () => {
  const { findCachedBrowser, findSystemBrowser } = await import('../src/test-browser.js')
  return (await findSystemBrowser()) ?? (await findCachedBrowser())
})()

Deno.test('imp test e2e', { ignore: !localBrowser }, async (t) => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('test-e2e'), dir)

  try {
    await t.step('test-e2e-pass', async () => {
      const result = await runImp(['test'], dir)
      const forwarded = result.stdout.includes('[BROWSER:log] counter clicked 2')
      await assertSnapshot(
        'test-e2e-pass',
        `${
          commandTranscript('imp test  (cwd: <tmp>)', withoutTelemetry(result))
        }\n[browser log forwarded: ${forwarded}]\n`,
      )
    })

    await t.step('test-fake-timers-e2e-rejected', async () => {
      await Deno.writeTextFile(
        join(dir, 'clock.spec.js'),
        "import { expect, test } from 'imp/test'\n\n" +
          "test('fakeTimers unavailable in e2e', ({ page }) => {\n" +
          '  expect(page).toBeDefined()\n' +
          '}, { fakeTimers: true })\n',
      )
      const result = await runImp(['test', 'clock.spec.js'], dir)
      await Deno.remove(join(dir, 'clock.spec.js'))
      await assertSnapshot(
        'test-fake-timers-e2e-rejected',
        commandTranscript('imp test clock.spec.js  (cwd: <tmp>)', withoutTelemetry(result)),
      )
    })

    await t.step('test-e2e-failure-screenshot', async () => {
      await Deno.writeTextFile(
        join(dir, 'failing.spec.js'),
        "import { expect, test } from 'imp/test'\n\n" +
          "test('shows 999', async ({ page }) => {\n" +
          "  const text = await page.$eval('#count', (element) => element.textContent)\n" +
          "  expect(text).toBe('999')\n" +
          '})\n',
      )
      const result = await runImp(['test', 'failing.spec.js', '--screenshots', 'shots'], dir)
      await Deno.remove(join(dir, 'failing.spec.js'))
      const screenshot = await Deno.stat(
        join(dir, 'shots', 'failing.spec.js-shows-999.png'),
      ).then((info) => info.isFile, () => false)
      await assertSnapshot(
        'test-e2e-failure-screenshot',
        `${
          commandTranscript(
            'imp test failing.spec.js --screenshots shots  (cwd: <tmp>)',
            withoutTelemetry(result),
          )
        }\n[screenshot written: ${screenshot}]\n`,
      )
    })

    await t.step('test-e2e-video', async () => {
      const result = await runImp(['test', 'counter.spec.js', '--video', 'vids'], dir)
      const bytes = await Deno.readFile(join(dir, 'vids', 'counter.spec.js.gif'))
        .catch(() => new Uint8Array())
      const header = new TextDecoder().decode(bytes.slice(0, 6))
      const isGif = header === 'GIF87a' || header === 'GIF89a'
      await assertSnapshot(
        'test-e2e-video',
        `${
          commandTranscript(
            'imp test counter.spec.js --video vids  (cwd: <tmp>)',
            withoutTelemetry(result),
          )
        }\n[animated gif written: ${isGif && bytes.length > 0}]\n`,
      )
    })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

async function copyDirectory(source, destination) {
  await Deno.mkdir(destination, { recursive: true })
  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name)
    const to = join(destination, entry.name)
    if (entry.isDirectory) await copyDirectory(from, to)
    else await Deno.copyFile(from, to)
  }
}

Deno.test('imp build', async (t) => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('build'), dir)

  const mask = (text) =>
    text
      .replaceAll(dir, '<tmp>')
      .replaceAll(dir.slice(1), '<tmp>')
      .replaceAll(ROOT.slice(1), '<root>/')
      .replace(/-[A-Z0-9]{8}\b/g, '-<hash>')
      .replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')

  const outputTree = async (outdir) => {
    const files = []
    const walk = async (directory, prefix) => {
      for await (const entry of Deno.readDir(directory)) {
        if (entry.isDirectory) await walk(join(directory, entry.name), `${prefix}${entry.name}/`)
        else files.push(prefix + entry.name)
      }
    }
    await walk(join(dir, outdir), `${outdir}/`).catch(() => {})
    files.sort()
    return section('output files', files.join('\n'))
  }

  try {
    await t.step('build-app', async () => {
      const result = await runImp(['build'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      const licenses = await Deno.readTextFile(join(dir, 'dist', 'LICENSES.txt'))
      const module = await import(toFileUrl(join(dir, 'dist', 'app.js')).href)
      const usage =
        `[bundled module: message='${module.message}', impLogLevel=${module.impLogLevel}, lazy loadShout()='${await module
          .loadShout()}']`
      await assertSnapshot(
        'build-app',
        mask(
          `${commandTranscript('imp build  (cwd: <tmp>)', result)}\n${await outputTree(
            'dist',
          )}\n\n${section('dist/index.html', html)}\n\n${
            section('dist/LICENSES.txt', licenses)
          }\n\n${usage}\n`,
        ),
      )
    })

    await t.step('build-js-entry', async () => {
      const result = await runImp(['build', 'app.js', '--output', 'component'], dir)
      const module = await import(toFileUrl(join(dir, 'component', 'app.js')).href)
      const usage = `[bundled module: message='${module.message}', lazy loadShout()='${await module
        .loadShout()}']`
      await assertSnapshot(
        'build-js-entry',
        mask(
          `${
            commandTranscript('imp build app.js --output component  (cwd: <tmp>)', result)
          }\n${await outputTree('component')}\n\n${usage}\n`,
        ),
      )
    })

    await t.step('build-unreachable-chunks', async () => {
      const chunksOf = async (entry, source) => {
        await Deno.writeTextFile(join(dir, entry), source)
        const result = await runImp(['build', entry, '--output', 'chunks-probe'], dir)
        const chunks = join(dir, 'chunks-probe', 'chunks')
        const entries = await Array.fromAsync(Deno.readDir(chunks)).catch(() => [])
        const files = entries.map((file) => file.name.replace(/-[A-Z0-9]{8}\.js/, '-<hash>.js'))
        await Deno.remove(join(dir, entry))
        await Deno.remove(join(dir, 'chunks-probe'), { recursive: true })
        return `${entry}: exit ${result.code}, chunks: ${files.sort().join(', ') || 'none'}`
      }
      const report = [
        await chunksOf(
          'list-entry.js',
          "import { list } from 'imp/std/data'\n\nexport const render = () => list({ label: 'Rows' })\n",
        ),
        await chunksOf(
          'map-entry.js',
          "import { map } from 'imp/std/data'\n\nexport const render = () => map({ label: 'World' })\n",
        ),
      ]
      await assertSnapshot('build-unreachable-chunks', `${report.join('\n')}\n`)
    })

    await t.step('build-imp-subpath', async () => {
      const entry = join(dir, 'std-entry.js')
      await Deno.writeTextFile(
        entry,
        "import { mount } from 'imp'\nimport { button } from 'imp/std'\n\n" +
          "export const render = () => mount('#app', button('Save'))\n",
      )
      const resolved = await runImp(['build', 'std-entry.js', '--output', 'std'], dir)
      const code = await Deno.readTextFile(join(dir, 'std', 'std-entry.js'))
      await Deno.writeTextFile(
        entry,
        "import { barChart } from 'imp/std/charts'\n\nexport const shell = barChart\n",
      )
      const unknown = await runImp(['build', 'std-entry.js', '--output', 'std'], dir)
      await Deno.writeTextFile(
        entry,
        "import { expect } from 'imp/test'\n\nexport const check = expect\n",
      )
      const tooling = await runImp(['build', 'std-entry.js', '--output', 'std'], dir)
      await Deno.remove(entry)
      await Deno.remove(join(dir, 'std'), { recursive: true })
      await assertSnapshot(
        'build-imp-subpath',
        mask(
          `${
            commandTranscript('imp build std-entry.js --output std  (cwd: <tmp>)', resolved)
          }\n[bundle defines the element: ${
            code.includes('imp-${') && code.includes('variant-')
          }]\n[bundle carries a development check: ${code.includes('__IMP_DEV__')}]\n\n${
            commandTranscript(
              'imp build std-entry.js --output std  (cwd: <tmp>, unknown subpath)',
              unknown,
            )
          }\n\n${
            commandTranscript(
              'imp build std-entry.js --output std  (cwd: <tmp>, tooling-only subpath)',
              tooling,
            )
          }\n`,
        ),
      )
    })

    const writeImpJson = (config) =>
      Deno.writeTextFile(join(dir, 'imp.json'), JSON.stringify(config, null, 2) + '\n')

    await t.step('build-target-imp-host', async () => {
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        targetImpHost: true,
      })
      const result = await runImp(['build', 'app.js', '--output', 'shared'], dir)
      const code = await Deno.readTextFile(join(dir, 'shared', 'app.js'))
      await assertSnapshot(
        'build-target-imp-host',
        mask(
          `${
            commandTranscript('imp build app.js --output shared  (cwd: <tmp>)', result)
          }\n${await outputTree('shared')}\n\n${section('shared/app.js', code)}\n`,
        ),
      )
    })

    await t.step('build-component-skill', async () => {
      const marker = 'WIDGETSKILLMARKER'
      const project = await Deno.makeTempDir()
      const write = (name, text) => Deno.writeTextFile(join(project, name), text)
      await write('eager.js', "export const eager = () => 'eager'\n")
      await write('eager.skill.md', `# eager - ${marker} a statically imported component\n`)
      await write('lazy.js', "export const lazy = () => 'lazy'\n")
      await write('lazy.skill.md', `# lazy - ${marker} a lazily imported component\n`)
      await write(
        'app.js',
        "import { eager } from './eager.js'\n\n" +
          "export const boot = async () => eager() + (await import('./lazy.js')).lazy()\n",
      )
      await write('index.html', '<!doctype html>\n<script type="module" src="app.js"></script>\n')
      const componentOut = await Deno.makeTempDir()
      const component = await runImp(['build', 'eager.js', '--output', componentOut], project)
      const { impSkill } = await import(toFileUrl(join(componentOut, 'eager.js')).href)
      const app = await runImp(['build', '--output', 'app'], project)
      const appFiles = []
      const walkOutput = async (directory, prefix) => {
        for await (const entry of Deno.readDir(directory)) {
          const path = join(directory, entry.name)
          if (entry.isDirectory) await walkOutput(path, `${prefix}${entry.name}/`)
          else appFiles.push({ name: prefix + entry.name, text: await Deno.readTextFile(path) })
        }
      }
      await walkOutput(join(project, 'app'), '')
      appFiles.sort((one, other) => one.name.localeCompare(other.name))
      const carrying = appFiles.filter((file) => file.text.includes(marker)).map((file) =>
        file.name
      )
      const bundled = appFiles.filter((file) => file.name.endsWith('.js')).map((file) => file.name)
      await Deno.remove(project, { recursive: true })
      await Deno.remove(componentOut, { recursive: true })
      const maskOutdir = (text) => text.replace(/-> \.\.[/\\]\S+[/\\]/g, '-> <component-out>/')
      await assertSnapshot(
        'build-component-skill',
        maskOutdir(mask(
          `${
            commandTranscript(
              'imp build eager.js --output <component-out>  (cwd: <tmp>, component build)',
              component,
            )
          }\n${section('impSkill exported by the component bundle', String(impSkill))}\n\n${
            commandTranscript('imp build --output app  (cwd: <tmp>, app build)', app)
          }\n${
            section(
              'app bundles (eager imported statically, lazy dynamically)',
              bundled.join('\n'),
            )
          }\n\n[app files carrying skill text: ${carrying.join(', ') || 'none'}]\n` +
            `[skill files copied into the app output: ${
              appFiles.some((file) => file.name.endsWith('.skill.md'))
            }]\n`,
        )),
      )
    })

    await t.step('build-app-strips-existing-skills', async () => {
      const marker = 'PREBUILTSKILLMARKER'
      const project = await Deno.makeTempDir()
      const write = (name, text) => Deno.writeTextFile(join(project, name), text)
      await Deno.mkdir(join(project, 'dependencies', 'widget'), { recursive: true })
      await write(
        join('dependencies', 'widget', 'widget.js'),
        `var s="# widget - ${marker} a published component";var w=()=>"widget";` +
          'export{s as impSkill,w as widget};\n',
      )
      await write('imp.json', '{ "dependencies": { "widget": "npm:widget@1.0.0" } }\n')
      await write(
        'hand.js',
        `export const impSkill = "# hand - ${marker} written into the module by hand"\n` +
          "export const hand = () => 'hand'\n",
      )
      await write(
        'app.js',
        'export const boot = async () =>\n' +
          "  (await import('widget')).widget() + (await import('./hand.js')).hand()\n",
      )
      await write('index.html', '<!doctype html>\n<script type="module" src="app.js"></script>\n')
      const result = await runImp(['build'], project)
      const chunks = []
      for await (const entry of Deno.readDir(join(project, 'dist', 'chunks'))) {
        chunks.push({
          name: entry.name,
          text: await Deno.readTextFile(join(project, 'dist', 'chunks', entry.name)),
        })
      }
      chunks.sort((one, other) => one.name.localeCompare(other.name))
      const carrying = chunks.filter((chunk) => chunk.text.includes(marker)).map((c) => c.name)
      const transcript = `${commandTranscript('imp build  (cwd: <tmp>, app build)', result)}\n` +
        `${
          section(
            'lazy chunks (a vendored pre-built component and a hand-written impSkill)',
            chunks.map((chunk) => chunk.text.trim()).join('\n'),
          )
        }\n\n[chunks carrying skill text: ${carrying.join(', ') || 'none'}]\n`
      await Deno.remove(project, { recursive: true })
      await assertSnapshot(
        'build-app-strips-existing-skills',
        mask(transcript).replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js'),
      )
    })

    await t.step('build-html-entry-ignores-target-imp-host', async () => {
      const result = await runImp(['build'], dir)
      await assertSnapshot(
        'build-html-entry-ignores-target-imp-host',
        mask(commandTranscript('imp build  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-invalid-target-imp-host', async () => {
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        targetImpHost: 'yes',
      })
      const result = await runImp(['build', 'app.js'], dir)
      await writeImpJson({ dependencies: { mitt: 'npm:mitt@3.0.1' } })
      await assertSnapshot(
        'build-invalid-target-imp-host',
        mask(commandTranscript('imp build app.js  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-missing-entry', async () => {
      const result = await runImp(['build', 'missing.html'], dir)
      await assertSnapshot(
        'build-missing-entry',
        mask(commandTranscript('imp build missing.html  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-entry-only-in-public', async () => {
      const entry = join(dir, 'index.html')
      const html = await Deno.readTextFile(entry)
      const moved = join(dir, 'public', 'index.html')
      await Deno.writeTextFile(moved, html)
      await Deno.remove(entry)
      const result = await runImp(['build'], dir)
      await Deno.writeTextFile(entry, html)
      await Deno.remove(moved)
      await assertSnapshot(
        'build-entry-only-in-public',
        mask(commandTranscript('imp build  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-output-contains-project', async () => {
      const result = await runImp(['build', '--output', '.'], dir)
      await assertSnapshot(
        'build-output-contains-project',
        mask(commandTranscript('imp build --output .  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-not-vendored', async () => {
      const result = await runImp(['build'], fixture('with-config'))
      await assertSnapshot(
        'build-not-vendored',
        mask(
          commandTranscript('imp build  (cwd: /test/fixtures/with-config)', result),
        ),
      )
    })

    await t.step('build-base-path', async () => {
      await Deno.mkdir(join(dir, 'env'), { recursive: true })
      await Deno.writeTextFile(
        join(dir, 'env', 'prod.json'),
        JSON.stringify({ IMP_BASEPATH: '/my-imp-app' }, null, 2) + '\n',
      )
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        environments: { default: 'env/prod.json' },
      })
      const result = await runImp(['build'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      await writeImpJson({ dependencies: { mitt: 'npm:mitt@3.0.1' } })
      await assertSnapshot(
        'build-base-path',
        mask(
          `${commandTranscript('imp build  (cwd: <tmp>)', result)}\n${await outputTree('dist')}` +
            `\n\n${section('dist/index.html', html)}\n`,
        ),
      )
    })

    await t.step('build-public-collision', async () => {
      const collision = join(dir, 'public', 'app.js')
      await Deno.writeTextFile(collision, 'export const shadowed = true\n')
      const result = await runImp(['build'], dir)
      await Deno.remove(collision)
      await assertSnapshot(
        'build-public-collision',
        mask(commandTranscript('imp build  (cwd: <tmp>)', result)),
      )
    })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build --pwa', async (t) => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('build-pwa'), dir)

  const mask = (text) =>
    text
      .replaceAll(dir, '<tmp>')
      .replace(/imp-pwa-[0-9a-f]{16}/g, 'imp-pwa-<hash>')
      .replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')

  const outputTree = async () => {
    const files = []
    const walk = async (directory, prefix) => {
      for await (const entry of Deno.readDir(directory)) {
        if (entry.isDirectory) await walk(join(directory, entry.name), `${prefix}${entry.name}/`)
        else files.push(prefix + entry.name)
      }
    }
    await walk(join(dir, 'dist'), 'dist/').catch(() => {})
    files.sort()
    return section('output files', files.join('\n'))
  }

  const isPng = async (path) => {
    const bytes = await Deno.readFile(join(dir, path))
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }

  const writeImpJson = (config) =>
    Deno.writeTextFile(join(dir, 'imp.json'), JSON.stringify(config, null, 2) + '\n')

  try {
    await t.step('build-pwa', async () => {
      const result = await runImp(['build', '--pwa'], dir)
      const manifest = await Deno.readTextFile(join(dir, 'dist', 'manifest.webmanifest'))
      const sw = await Deno.readTextFile(join(dir, 'dist', 'sw.js'))
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      const icons = [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
      ]
      const iconReport = []
      for (const icon of icons) {
        iconReport.push(`${icon}: ${(await isPng(`dist/${icon}`)) ? 'PNG' : 'NOT PNG'}`)
      }
      await assertSnapshot(
        'build-pwa',
        mask(
          `${
            commandTranscript('imp build --pwa  (cwd: <tmp>)', result)
          }\n${await outputTree()}\n\n` +
            `${section('dist/manifest.webmanifest', manifest)}\n\n` +
            `${section('dist/sw.js', sw)}\n\n` +
            `${section('dist/index.html', html)}\n\n` +
            `${section('icon files', iconReport.join('\n'))}\n`,
        ),
      )
    })

    await t.step('build-pwa-png-source', async () => {
      await Deno.copyFile(
        join(dir, 'dist', 'icons', 'icon-512.png'),
        join(dir, 'assets', 'icon.png'),
      )
      await writeImpJson({
        pwa: {
          name: 'Fixture PWA',
          shortName: 'Fixture',
          themeColor: '#101828',
          backgroundColor: '#ffffff',
          display: 'standalone',
          icon: 'assets/icon.png',
        },
      })
      const result = await runImp(['build', '--pwa'], dir)
      const iconReport = `icons/icon-512.png: ${
        (await isPng('dist/icons/icon-512.png')) ? 'PNG' : 'NOT PNG'
      }`
      await assertSnapshot(
        'build-pwa-png-source',
        mask(
          `${commandTranscript('imp build --pwa  (cwd: <tmp>)', result)}\n` +
            `${section('icon from PNG source', iconReport)}\n`,
        ),
      )
    })

    await t.step('build-pwa-small-source-warns', async () => {
      await Deno.copyFile(
        join(dir, 'dist', 'icons', 'icon-192.png'),
        join(dir, 'assets', 'icon-small.png'),
      )
      await writeImpJson({
        pwa: {
          name: 'Fixture PWA',
          icon: 'assets/icon-small.png',
        },
      })
      const result = await runImp(['build', '--pwa'], dir)
      await assertSnapshot(
        'build-pwa-small-source-warns',
        mask(commandTranscript('imp build --pwa  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-pwa-no-block', async () => {
      await writeImpJson({})
      const result = await runImp(['build', '--pwa'], dir)
      await assertSnapshot(
        'build-pwa-no-block',
        mask(commandTranscript('imp build --pwa  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-pwa-js-entry', async () => {
      await writeImpJson({ pwa: { name: 'Fixture PWA', icon: 'assets/icon.svg' } })
      const result = await runImp(['build', 'app.js', '--pwa'], dir)
      await assertSnapshot(
        'build-pwa-js-entry',
        mask(commandTranscript('imp build app.js --pwa  (cwd: <tmp>)', result)),
      )
    })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

async function launchBrowser() {
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  return puppeteer.launch({ executablePath: await resolveBrowser(), headless: true, args })
}

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

function serveFolder(folderOf, headers = {}) {
  const server = Deno.serve(
    { port: 0, hostname: '127.0.0.1', onListen: () => {} },
    async (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname)
      const file = path.endsWith('/') ? `${path}index.html` : path
      try {
        const bytes = await Deno.readFile(join(folderOf(), file))
        const type = STATIC_TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'
        return new Response(bytes, { headers: { 'content-type': type, ...headers } })
      } catch {
        return new Response('not found', { status: 404 })
      }
    },
  )
  return { server, base: `http://127.0.0.1:${server.addr.port}` }
}

Deno.test('imp build --pwa keeps the previous build for a running page', async () => {
  const dir = await Deno.makeTempDir()
  const html = '<!doctype html><html><head><title>update</title></head><body>' +
    '<script type="module" src="/app.js"></script></body></html>'
  const buildRelease = async (release) => {
    await Deno.writeTextFile(join(dir, 'index.html'), html)
    await Deno.writeTextFile(
      join(dir, 'imp.json'),
      JSON.stringify({ pwa: { name: 'Update', icon: 'icon.svg' } }),
    )
    await Deno.writeTextFile(
      join(dir, 'icon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>',
    )
    await Deno.writeTextFile(
      join(dir, 'app.js'),
      `globalThis.release = ${JSON.stringify(release)}\n` +
        `globalThis.loadPanel = () => import('./panel.js').then((module) => module.panel)\n`,
    )
    await Deno.writeTextFile(
      join(dir, 'panel.js'),
      `export const panel = ${JSON.stringify(`panel of ${release}`)}\n`,
    )
    const result = await runImp(['build', '--pwa', '--output', release], dir)
    check(result.code === 0, `build of ${release} failed:\n${result.stderr}`)
    return join(dir, release)
  }
  const releases = [
    await buildRelease('one'),
    await buildRelease('two'),
    await buildRelease('three'),
  ]
  let deployed = releases[0]
  const { server, base } = serveFolder(() => deployed)
  const browser = await launchBrowser()
  const updateWorker = (page) =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      const previous = registration.active
      await registration.update()
      await new Promise((resolve) => {
        const settle = () => {
          const worker = registration.active
          if (worker !== previous && worker?.state === 'activated') return resolve()
          setTimeout(settle, 50)
        }
        settle()
      })
    })
  const buildCaches = (page) =>
    page.evaluate(async () =>
      (await caches.keys()).filter((key) => key.startsWith('imp-pwa-')).length
    )
  try {
    const page = await browser.newPage()
    await page.goto(`${base}/`)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    check(await page.evaluate(() => globalThis.release) === 'one', 'the first release did not load')

    deployed = releases[1]
    await updateWorker(page)
    check(
      await page.evaluate(() => globalThis.loadPanel()) === 'panel of one',
      'a lazy chunk of the running release did not load after the update',
    )
    check(await buildCaches(page) === 2, 'the update did not keep the previous build cache')

    const next = await browser.newPage()
    await next.goto(`${base}/`)
    check(
      await next.evaluate(() => globalThis.release) === 'two',
      'a navigation did not load the new release',
    )
    check(await buildCaches(next) === 2, 'a navigation removed the previous build cache')

    deployed = releases[2]
    await updateWorker(next)
    check(await buildCaches(next) === 3, 'the update removed a build cache before a navigation')
    await next.goto(`${base}/`)
    await next.waitForFunction(async () =>
      (await caches.keys()).filter((key) => key.startsWith('imp-pwa-')).length === 2
    )
    check(
      await next.evaluate(() => globalThis.release) === 'three',
      'the third release did not load',
    )
    check(
      await next.evaluate(() => globalThis.loadPanel()) === 'panel of three',
      'the lazy chunk of the current release did not load',
    )
  } finally {
    await browser.close()
    await server.shutdown()
    await Deno.remove(dir, { recursive: true })
  }
})

async function startServer(cwd, extraArgs = [], command = ['start', 'index.html']) {
  const child = new Deno.Command(IMP, {
    args: [...command, '--port', '0', ...extraArgs],
    cwd,
    stdin: 'null',
    stdout: 'piped',
    stderr: 'null',
  }).spawn()
  const reader = child.stdout.getReader()
  const decoder = new TextDecoder()
  let banner = ''
  while (!banner.includes('imp auto-injected')) {
    const { value, done } = await reader.read()
    if (done) break
    banner += decoder.decode(value)
  }
  const port = Number(banner.match(/localhost:(\d+)\//)[1])
  return {
    port,
    banner,
    async stop() {
      await reader.cancel().catch(() => {})
      child.kill()
      await child.status
    },
  }
}

const HEADERS_OF_INTEREST = ['content-type', 'location', 'service-worker-allowed', 'cache-control']

const responseTranscript = (path, response, body) => {
  const lines = [`GET ${path}`, `status: ${response.status}`]
  for (const header of HEADERS_OF_INTEREST) {
    const value = response.headers.get(header)
    if (value) lines.push(`${header}: ${value}`)
  }
  return `${lines.join('\n')}\n\n${body.trimEnd()}\n`
}

async function rawRequestStatusLine(port, target) {
  const connection = await Deno.connect({ hostname: '127.0.0.1', port })
  const request = `GET ${target} HTTP/1.1\r\nhost: localhost\r\nconnection: close\r\n\r\n`
  await connection.write(new TextEncoder().encode(request))
  const chunks = []
  const buffer = new Uint8Array(65536)
  while (true) {
    const read = await connection.read(buffer)
    if (read === null) break
    chunks.push(buffer.slice(0, read))
    if (new TextDecoder().decode(chunks[chunks.length - 1]).includes('\r\n')) break
  }
  connection.close()
  const response = new TextDecoder().decode(
    chunks.reduce((all, chunk) => new Uint8Array([...all, ...chunk]), new Uint8Array()),
  )
  return response.split('\r\n')[0]
}

Deno.test('imp start', async (t) => {
  const server = await startServer(fixture('basic'))
  const { port } = server

  const get = async (name, path, { redirect = 'follow', maskBody = null } = {}) => {
    await t.step(name, async () => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect })
      let body = await response.text()
      body = maskBody ? maskBody(body) : normalize(body)
      await assertSnapshot(name, responseTranscript(path, response, body))
    })
  }

  try {
    await t.step('start-banner', async () => {
      const banner = normalize(server.banner).replaceAll(`:${port}`, ':<port>')
      await assertSnapshot('start-banner', banner)
    })

    await get('start-injected-html', '/', {
      maskBody: (body) =>
        normalize(
          body.replace(clientScript({ mocks: false, mark: widgetMark }), '\n[imp client script]\n'),
        ),
    })
    await get('start-serves-module-verbatim', '/app.js')

    await t.step('start-vendored-dependency', async () => {
      const path = '/dependencies/mitt/mitt.js'
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      const code = await response.text()
      const module = await import(`data:text/javascript,${encodeURIComponent(code)}`)
      const emitter = module.default()
      let received = null
      emitter.on('ping', (value) => {
        received = value
      })
      emitter.emit('ping', 'pong')
      const summary = `[vendored module: default export is ${typeof module
        .default}, emit('ping') delivered '${received}']`
      await assertSnapshot(
        'start-vendored-dependency',
        responseTranscript(path, response, summary),
      )
    })

    await get('start-framework-module', '/@imp/imp.js', {
      maskBody: () => '[imp library source]',
    })
    await get('start-service-worker', '/@imp/sw.js', {
      maskBody: () => '[imp service worker source]',
    })
    await get('start-static-asset', '/assets/note.txt')
    await get('start-directory-redirect', '/assets', { redirect: 'manual' })
    await get('start-not-found', '/missing.js')

    await t.step('start-history-fallback', async () => {
      const path = '/todos/42'
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { accept: 'text/html' },
      })
      const body = normalize(
        (await response.text()).replace(
          clientScript({ mocks: false, mark: widgetMark }),
          '\n[imp client script]\n',
        ),
      )
      await assertSnapshot('start-history-fallback', responseTranscript(path, response, body))
    })

    await t.step('start-path-traversal', async () => {
      const statusLine = await rawRequestStatusLine(port, '/../secret.txt')
      await assertSnapshot(
        'start-path-traversal',
        `GET /../secret.txt (raw request)\n\n${statusLine}\n`,
      )
    })
  } finally {
    await server.stop()
  }
})

function runServiceWorker(source, port = null) {
  const listeners = {}
  const telemetry = []
  const scope = {
    addEventListener: (type, handler) => {
      listeners[type] = handler
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  }
  const network = (input, init) => {
    if (input === '/@imp/log') {
      telemetry.push(...JSON.parse(init.body))
      return Promise.resolve(new Response('ok'))
    }
    if (input === '/@imp/mock') return fetch(`http://127.0.0.1:${port}${input}`, init)
    return Promise.resolve(
      new Response('from the network', { headers: { 'content-type': 'text/plain' } }),
    )
  }
  new Function('self', 'fetch', 'globalThis', source)(scope, network, scope)

  const send = async (path, init) => {
    let answered
    listeners.fetch({
      request: new Request(`http://app.test${path}`, init),
      respondWith: (value) => answered = value,
    })
    const started = Date.now()
    try {
      const response = await answered
      const type = response.headers.get('content-type') ?? '(none)'
      const slow = Date.now() - started >= 20 ? ' after the declared delay' : ''
      return `${init?.method ?? 'GET'} ${path} -> ${response.status} ${type} ${await response
        .text()}${slow}`
    } catch (error) {
      return `${init?.method ?? 'GET'} ${path} -> rejected: ${error.message}`
    }
  }

  return {
    mockEndpoint: scope.__IMP_MOCK_ENDPOINT__ ?? '(none)',
    send,
    telemetry,
    listeners,
    scope,
  }
}

Deno.test('imp start serves mocks through the service worker', async (t) => {
  const server = await startServer(fixture('start-mocks'))
  const { port } = server

  try {
    await t.step('start-mocks-banner', async () => {
      const banner = normalize(server.banner).replaceAll(`:${port}`, ':<port>')
      await assertSnapshot('start-mocks-banner', banner)
    })

    await t.step('start-mocks-injected-html', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`)
      const html = normalize(
        (await response.text()).replace(
          clientScript({ mocks: true, mark: widgetMark }),
          '\n[imp client script]\n',
        ),
      )
      await assertSnapshot(
        'start-mocks-injected-html',
        responseTranscript('/', response, html),
      )
    })

    await t.step('start-mocks-service-worker', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/@imp/sw.js`)
      const source = await response.text()
      const worker = runServiceWorker(source, port)
      const transcript = [
        `mock endpoint: ${worker.mockEndpoint}`,
        `mock code in the worker: ${source.includes('/api/users') ? 'yes' : 'no'}`,
        '',
        await worker.send('/api/users'),
        await worker.send('/api/users', {
          method: 'POST',
          body: JSON.stringify({ name: 'Alan' }),
          headers: { 'content-type': 'application/json' },
        }),
        await worker.send('/api/reports?name=q3'),
        await worker.send('/api/flaky'),
        await worker.send('/api/flaky'),
        await worker.send('/api/unmocked'),
        '',
        'a new worker, as after the browser stops an idle one:',
        await runServiceWorker(source, port).send('/api/flaky'),
      ]
      await assertSnapshot(
        'start-mocks-service-worker',
        `${section('what the mocks answer', transcript.join('\n'))}\n`,
      )
    })
  } finally {
    await server.stop()
  }
})

const mockedRequest = async (port) => {
  const worker = runServiceWorker(
    await (await fetch(`http://127.0.0.1:${port}/@imp/sw.js`)).text(),
    port,
  )
  return `mock endpoint ${worker.mockEndpoint} | ${await worker.send('/api/users')}`
}

Deno.test('--mock and --no-mock decide whether the mocks folder is served', async (t) => {
  const disabled = await Deno.makeTempDir()
  await copyDirectory(fixture('start-mocks'), disabled)
  await Deno.writeTextFile(
    join(disabled, 'imp.json'),
    '{\n  "mocks": { "folder": "mocks", "enabled": false }\n}\n',
  )

  const runs = [
    { label: '"enabled": true', cwd: fixture('start-mocks'), args: [] },
    { label: '"enabled": true with --no-mock', cwd: fixture('start-mocks'), args: ['--no-mock'] },
    { label: '"enabled": false', cwd: disabled, args: [] },
    { label: '"enabled": false with --mock', cwd: disabled, args: ['--mock'] },
  ]

  const lines = []
  for (const run of runs) {
    const server = await startServer(run.cwd, run.args)
    try {
      lines.push(`${run.label} -> ${await mockedRequest(server.port)}`)
    } finally {
      await server.stop()
    }
  }
  await Deno.remove(disabled, { recursive: true })

  await t.step('mocks-flag-decides', async () => {
    await assertSnapshot('mocks-flag-decides', `${section('imp start', lines.join('\n'))}\n`)
  })
})

const ownWorkerFixture = async (edit = null) => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('start-service-worker'), dir)
  if (edit) await edit(dir)
  return dir
}

const telemetryLines = (entries) =>
  entries.map((entry) =>
    `${entry.type} ${entry.method} ${new URL(entry.url).pathname} -> ${
      entry.error ?? entry.status
    }${entry.mock ? ` (mock: ${entry.mock})` : ''}`
  )

const settled = () => new Promise((resolve) => setTimeout(resolve, 300))

Deno.test('a project with its own service worker gets dev mode from startDevMode()', async (t) => {
  const server = await startServer(fixture('start-service-worker'))
  const { port } = server

  try {
    await t.step('start-own-worker-banner', async () => {
      const banner = normalize(server.banner).replaceAll(`:${port}`, ':<port>')
      await assertSnapshot('start-own-worker-banner', banner)
    })

    await t.step('start-own-worker-page', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`)
      const html = await response.text()
      const ownClient = clientScript({ mocks: true, ownWorker: true, mark: widgetMark })
      const report = [
        `registers /@imp/sw.js: ${html.includes('/@imp/sw.js') ? 'yes' : 'no'}`,
        `client script without the dev worker registration: ${
          html.includes(ownClient) ? 'yes' : 'no'
        }`,
      ]
      await assertSnapshot(
        'start-own-worker-page',
        responseTranscript('/', response, report.join('\n')),
      )
    })

    await t.step('start-own-worker-bundle', async () => {
      const path = '/sw.js'
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      const source = await response.text()
      const worker = runServiceWorker(source, port)
      const transcript = [
        `bare imports left: ${/^\s*import\s/m.test(source) ? 'yes' : 'no'}`,
        `first line: ${source.split('\n')[0]}`,
        `worker code ran: ${JSON.stringify(worker.scope.__fixture)}`,
        `listeners: ${Object.keys(worker.listeners).sort().join(', ')}`,
        `mock endpoint: ${worker.mockEndpoint}`,
        '',
        await worker.send('/api/users'),
        await worker.send('/api/other'),
      ]
      await settled()
      transcript.push('', ...telemetryLines(worker.telemetry))
      await assertSnapshot(
        'start-own-worker-bundle',
        responseTranscript(path, response, transcript.join('\n')),
      )
    })

    await t.step('start-own-worker-imp-worker-gone', async () => {
      const path = '/@imp/sw.js'
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      await assertSnapshot(
        'start-own-worker-imp-worker-gone',
        responseTranscript(path, response, await response.text()),
      )
    })
  } finally {
    await server.stop()
  }

  await t.step('start-own-worker-dev-mode-off', async () => {
    const dir = await ownWorkerFixture((root) =>
      Deno.writeTextFile(join(root, 'env', 'dev.json'), '{ "DEV_TOOLS": "off" }\n')
    )
    const quiet = await startServer(dir)
    try {
      const worker = runServiceWorker(
        await (await fetch(`http://127.0.0.1:${quiet.port}/sw.js`)).text(),
      )
      await assertSnapshot(
        'start-own-worker-dev-mode-off',
        [
          `worker code ran: ${JSON.stringify(worker.scope.__fixture)}`,
          `listeners: ${Object.keys(worker.listeners).sort().join(', ') || '(none)'}`,
          `mock endpoint: ${worker.mockEndpoint}`,
        ].join('\n') + '\n',
      )
    } finally {
      await quiet.stop()
    }
  })

  await t.step('start-own-worker-broken-import', async () => {
    const dir = await ownWorkerFixture(async (root) => {
      const file = join(root, 'src', 'sw.js')
      await Deno.writeTextFile(file, `${await Deno.readTextFile(file)}import './missing.js'\n`)
    })
    const broken = await startServer(dir)
    try {
      const path = '/sw.js'
      const response = await fetch(`http://127.0.0.1:${broken.port}${path}`)
      const withoutTmp = (text) => text.replaceAll(dir, '<tmp>').replaceAll(dir.slice(1), '<tmp>')
      const banner = withoutTmp(normalize(broken.banner).replaceAll(`:${broken.port}`, ':<port>'))
      await assertSnapshot(
        'start-own-worker-broken-import',
        `${section('banner', banner)}\n\n${
          responseTranscript(path, response, withoutTmp(await response.text()))
        }`,
      )
    } finally {
      await broken.stop()
    }
  })

  await t.step('start-own-worker-missing-file', async () => {
    const dir = await ownWorkerFixture((root) => Deno.remove(join(root, 'src', 'sw.js')))
    const result = await runImp(['start', 'index.html', '--port', '0'], dir)
    await assertSnapshot(
      'start-own-worker-missing-file',
      commandTranscript('imp start index.html --port 0  (cwd: <tmp>)', result).replaceAll(
        dir,
        '<tmp>',
      ),
    )
  })

  await t.step('start-own-worker-invalid-key', async () => {
    const dir = await ownWorkerFixture((root) =>
      Deno.writeTextFile(join(root, 'imp.json'), '{ "serviceWorker": 5 }\n')
    )
    const result = await runImp(['start', 'index.html', '--port', '0'], dir)
    await assertSnapshot(
      'start-own-worker-invalid-key',
      commandTranscript('imp start index.html --port 0  (cwd: <tmp>)', result).replaceAll(
        dir,
        '<tmp>',
      ),
    )
  })
})

Deno.test('imp build bundles the service worker of the project', async (t) => {
  const mask = (text, dir) =>
    text.replaceAll(dir, '<tmp>').replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')

  await t.step('build-own-worker', async () => {
    const dir = await ownWorkerFixture()
    const result = await runImp(['build'], dir)
    const sw = await Deno.readTextFile(join(dir, 'dist', 'sw.js'))
    const worker = runServiceWorker(sw)
    const report = [
      `first line: ${sw.split('\n')[0]}`,
      `bare imports left: ${/^\s*import\s/m.test(sw) ? 'yes' : 'no'}`,
      `worker code ran: ${JSON.stringify(worker.scope.__fixture)}`,
      `listeners: ${Object.keys(worker.listeners).sort().join(', ')}`,
      `mock endpoint: ${worker.mockEndpoint}`,
    ]
    await assertSnapshot(
      'build-own-worker',
      mask(
        `${commandTranscript('imp build  (cwd: <tmp>)', result)}\n${
          section('dist/sw.js', report.join('\n'))
        }\n`,
        dir,
      ),
    )
  })

  await t.step('build-own-worker-pwa', async () => {
    const dir = await Deno.makeTempDir()
    await copyDirectory(fixture('build-pwa'), dir)
    await copyDirectory(join(fixture('start-service-worker'), 'src'), join(dir, 'src'))
    const config = JSON.parse(await Deno.readTextFile(join(dir, 'imp.json')))
    await Deno.writeTextFile(
      join(dir, 'imp.json'),
      JSON.stringify({ ...config, serviceWorker: 'src/sw.js' }, null, 2) + '\n',
    )
    const result = await runImp(['build', '--pwa'], dir)
    const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
    const sw = await Deno.readTextFile(join(dir, 'dist', 'sw.js'))
    const report = [
      `registration: ${html.match(/serviceWorker\.register\([^)]*\)/)?.[0] ?? '(none)'}`,
      `dist/sw.js is the project worker: ${sw.includes('__fixture') ? 'yes' : 'no'}`,
      `dist/sw.js precaches: ${sw.includes('imp-pwa-') ? 'yes' : 'no'}`,
    ]
    await assertSnapshot(
      'build-own-worker-pwa',
      mask(
        `${commandTranscript('imp build --pwa  (cwd: <tmp>)', result)}\n${
          section('output', report.join('\n'))
        }\n`,
        dir,
      ),
    )
  })
})

Deno.test('an incomplete mocks config is reported', async () => {
  const dir = await Deno.makeTempDir()
  await Deno.writeTextFile(join(dir, 'index.html'), '<!doctype html>\n<div id="app"></div>\n')
  const reported = []
  for (const declared of ['"mocks": "mocks"', '"mocks": { "folder": "mocks" }', '"mocks": {}']) {
    await Deno.writeTextFile(join(dir, 'imp.json'), `{\n  ${declared}\n}\n`)
    const { stderr } = await runImp(['lint', 'index.html'], dir)
    reported.push(`{ ${declared} }\n${stderr.trim()}`)
  }
  await Deno.remove(dir, { recursive: true })

  await assertSnapshot('mocks-config-problems', `${reported.join('\n\n')}\n`)
})

Deno.test('imp build leaves the mocks folder behind', async () => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('start-mocks'), dir)
  const result = await runImp(['build'], dir)
  const built = []
  const walk = async (directory, prefix) => {
    for await (const entry of Deno.readDir(directory)) {
      if (entry.isDirectory) await walk(join(directory, entry.name), `${prefix}${entry.name}/`)
      else built.push(prefix + entry.name)
    }
  }
  await walk(join(dir, 'dist'), 'dist/')
  built.sort()
  await Deno.remove(dir, { recursive: true })

  await assertSnapshot(
    'build-omits-mocks',
    `${
      commandTranscript('imp build  (cwd: <tmp>)', {
        ...result,
        stdout: result.stdout.replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)'),
      })
    }\n${section('output files', built.join('\n'))}\n`,
  )
})

Deno.test('the mocks of the imp process report problems and keep their state', async () => {
  const root = await Deno.makeTempDir()
  const directory = join(root, 'mocks')
  await Deno.mkdir(directory)
  const file = join(directory, 'counter.mock.js')
  const fixtureFile = join(directory, 'start.js')
  const changes = []
  const mocks = createMocks({
    root,
    directory,
    onChange: (state) => changes.push(state.problems.join('; ') || `${state.entries.length} entry`),
  })
  const ask = async () => {
    const response = await mocks.answer(
      new Request('http://app.test/@imp/mock', {
        method: 'POST',
        body: JSON.stringify({ method: 'GET', path: '/api/count' }),
      }),
    )
    return `${response.status} ${await response.text()}`
  }
  await Deno.writeTextFile(file, 'export const mocks = [\n')
  await mocks.refresh()
  await Deno.writeTextFile(file, 'export const mocks = { match: () => true }\n')
  await mocks.refresh()
  await Deno.writeTextFile(fixtureFile, 'export const start = 10\n')
  await Deno.writeTextFile(
    file,
    [
      "import { start } from './start.js'",
      'let count = start',
      'export const mocks = [{ match: () => true, handler: () => ({ body: { count: ++count } }) }]',
      '',
    ].join('\n'),
  )
  const answers = [await ask(), await ask(), await ask()]
  await mocks.refresh()
  await Deno.writeTextFile(fixtureFile, 'export const start = 100\n')
  const afterFixtureEdit = await ask()
  const missing = []
  await createMocks({
    root,
    directory: join(root, 'absent'),
    onChange: (state) => missing.push(...state.problems),
  }).refresh()
  await Deno.remove(root, { recursive: true })

  await assertSnapshot(
    'mocks-build-problem',
    [
      ...changes.map((change) => `reported: ${change}`),
      '',
      ...answers.map((answer) => `answer: ${answer}`),
      `after an edit to an imported fixture: ${afterFixtureEdit}`,
      `missing directory: ${missing.join('; ')}`,
      '',
    ].join('\n'),
  )
})

const startPreviewServer = (cwd, extraArgs = []) => startServer(cwd, extraArgs, ['preview'])

Deno.test('imp preview', async (t) => {
  const server = await startPreviewServer(fixture('preview'))
  const { port } = server

  const get = async (name, path, { maskBody = null } = {}) => {
    await t.step(name, async () => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      const text = await response.text()
      const body = maskBody ? maskBody(text) : normalize(text)
      await assertSnapshot(name, responseTranscript(path, response, body))
    })
  }

  try {
    await t.step('preview-banner', async () => {
      const banner = normalize(server.banner).replaceAll(`:${port}`, ':<port>')
      await assertSnapshot('preview-banner', banner)
    })

    const previewClient = clientScript({ mocks: false, mark: widgetMark, themeEditor: false })
    await get('preview-index', '/', {
      maskBody: (body) => normalize(body.replace(previewClient, '\n[imp client script]\n')),
    })
    await get('preview-page', '/widgets/counter', {
      maskBody: (body) => normalize(body.replace(previewClient, '\n[imp client script]\n')),
    })
    await get('preview-unknown-page', '/@imp/preview/components/missing.preview.js')
    await get('preview-app', '/@imp/preview/app.js', {
      maskBody: (body) =>
        [
          `starts the preview chrome: ${body.includes('startPreview(')}`,
          `catalog embedded: ${body.includes('"components/counter.preview.js"')}`,
          `loads a group on demand: ${/import\(["']\.\/groups\/widgets\.js["']\)/.test(body)}`,
          `library shared through a chunk: ${/from\s*["'](\.\.?\/)+chunks\//.test(body)}`,
        ].join('\n'),
    })
    await get('preview-bundle', '/@imp/preview/groups/components.js', {
      maskBody: (body) =>
        [
          `defines the component: ${/component\(["']demo-todos["']/.test(body)}`,
          `mocked fixture inlined: ${body.includes('Buy milk')}`,
          `real http.js excluded: ${!body.includes("fetch('/api/todos')")}`,
          `library shared through a chunk: ${/from\s*["'](\.\.?\/)+chunks\//.test(body)}`,
        ].join('\n'),
    })
  } finally {
    await server.stop()
  }
})

Deno.test('imp preview renders scenarios in a browser', async () => {
  const server = await startPreviewServer(fixture('preview'))
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  const browser = await puppeteer.launch({
    executablePath: await resolveBrowser(),
    headless: true,
    args,
  })
  const base = `http://127.0.0.1:${server.port}`
  try {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(() => {
      globalThis.impResizeLoops = 0
      globalThis.impErrors = []
      globalThis.addEventListener('error', (event) => {
        if (String(event.message).includes('ResizeObserver loop')) globalThis.impResizeLoops++
      })
      const reportError = console.error.bind(console)
      console.error = (...args) => {
        globalThis.impErrors.push(args.map(String).join(' '))
        reportError(...args)
      }
      globalThis.impRoot = () => document.querySelector('imp-preview-page')?.shadowRoot ?? null
      globalThis.impAll = (name, from) => {
        const found = []
        const walk = (root) => {
          for (const element of root.querySelectorAll('*')) {
            if (element.localName === name) found.push(element)
            if (element.shadowRoot) walk(element.shadowRoot)
          }
        }
        const start = from ?? globalThis.impRoot()
        if (start) {
          walk(start)
          if (start.shadowRoot) walk(start.shadowRoot)
        }
        return found
      }
      globalThis.impOne = (name, from) => globalThis.impAll(name, from)[0] ?? null
      globalThis.impDeep = (selector, from) => {
        const search = (root) => {
          const direct = root.querySelector(selector)
          if (direct) return direct
          for (const element of root.querySelectorAll('*')) {
            if (element.shadowRoot) {
              const found = search(element.shadowRoot)
              if (found) return found
            }
          }
          return null
        }
        const start = from ?? globalThis.impRoot()
        return start ? search(start.shadowRoot ?? start) : null
      }
      globalThis.impScenarios = () => globalThis.impAll('imp-preview-scenario')
      globalThis.impCodeOf = (scenario) =>
        [...globalThis.impOne('imp-code-block', scenario).shadowRoot.querySelectorAll('.line')]
          .map((line) => line.textContent).join('\n')
      globalThis.impLabelled = (name, from) =>
        globalThis.impAll(name, from).map((host) => ({
          label: host.shadowRoot.querySelector('label')?.textContent.trim() ?? '',
          control: host.shadowRoot.querySelector('input, select'),
        }))
      globalThis.impPicker = (label) =>
        globalThis.impLabelled('imp-select').find((entry) => entry.label === label)?.control
      globalThis.impSwitcher = (label) => {
        const menu = globalThis.impAll('imp-menu-button').find((host) =>
          host.shadowRoot.querySelector('imp-button')?.shadowRoot
            .querySelector(`[aria-label="Choose a ${label}"]`) !== null
        )
        const step = menu.parentNode.querySelector('imp-button')
        return {
          items: () => [...menu.shadowRoot.querySelectorAll('[role="menuitem"]')],
          options: () =>
            [...menu.shadowRoot.querySelectorAll('[role="menuitem"]')]
              .map((item) => item.textContent),
          selected: () => step.shadowRoot.querySelector('.label').textContent,
          pick: (value) =>
            [...menu.shadowRoot.querySelectorAll('[role="menuitem"]')]
              .find((item) => item.textContent === value).click(),
          step: () => step.shadowRoot.querySelector('.button').click(),
        }
      }
      globalThis.impTextareas = (editor) =>
        [...editor.shadowRoot.querySelectorAll('imp-text-field')]
          .map((host) => host.shadowRoot.querySelector('textarea'))
    })
    await page.goto(`${base}/widgets/counter`, { waitUntil: 'load' })
    await page.waitForFunction(() =>
      globalThis.impRoot() &&
      globalThis.impAll('imp-preview-state')
          .flatMap((editor) => globalThis.impTextareas(editor))
          .filter((field) => !field.disabled).length === 3
    )
    const counter = await page.evaluate(() => {
      const scenarios = globalThis.impScenarios()
      const read = (scenario) =>
        globalThis.impOne('demo-counter', scenario).shadowRoot.querySelector('#value').textContent
      return {
        names: scenarios.map((scenario) => scenario.shadowRoot.querySelector('h2').textContent),
        rendered: scenarios.map(read),
        states: scenarios.map((scenario) => {
          const editor = globalThis.impOne('imp-preview-state', scenario)
          const row = editor.shadowRoot
          return `${row.querySelector('.name').textContent} ${
            row.querySelector('.provider').textContent
          }=${globalThis.impTextareas(editor)[0].value}`
        }),
        handles: globalThis.impOne('imp-preview-stage', scenarios[0])
          .shadowRoot.querySelectorAll('.handle').length,
      }
    })
    const agent = await page.evaluate(() => {
      const skill = globalThis.impOne('imp-preview-skill')
      const strip = skill.shadowRoot.querySelector('.agent')
      const copy = globalThis.impOne('imp-button', strip)
      return {
        strips: globalThis.impAll('imp-preview-skill').length,
        region: strip.getAttribute('aria-label'),
        instruction: strip.querySelector('.instruction').textContent,
        copy: `${copy.shadowRoot.querySelector('button').getAttribute('aria-label')} button ` +
          `with ${globalThis.impAll('imp-icon', copy).length} icon, ${
            globalThis.impAll('imp-tooltip', strip).some((host) =>
                globalThis.impOne('imp-button', host) === copy
              )
              ? 'in a tooltip'
              : 'without a tooltip'
          }`,
      }
    })
    const codeAndSkill = await page.evaluate(async () => {
      const scenario = globalThis.impScenarios()[0]
      const toggle = globalThis.impAll('imp-button', scenario)
        .map((node) => node.shadowRoot.querySelector('button'))
        .find((node) => node?.textContent.includes('Code example'))
      const block = () => scenario.shadowRoot.querySelector('.code')
      const hidden = block().hidden
      const before = toggle.getAttribute('aria-pressed')
      const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
      toggle.click()
      await settle()
      toggle.click()
      await settle()
      const hiddenAgain = block().hidden
      toggle.click()
      await settle()
      const [pageTabs, scenarioTabs] = globalThis.impAll('imp-tabs')
      const labels = (host) =>
        [...host.shadowRoot.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent.trim())
      const selected = (host) =>
        host.shadowRoot.querySelector('[role="tab"][aria-selected="true"]').textContent.trim()
      const skill = globalThis.impOne('imp-preview-skill').shadowRoot
      return {
        hidden: `${hidden}, hidden again after a second click: ${hiddenAgain}`,
        toggle: `${before} -> ${toggle.getAttribute('aria-pressed')}`,
        code: globalThis.impCodeOf(scenario),
        stored: localStorage.getItem('imp.preview.code'),
        tabs: labels(pageTabs).join(', '),
        scenarioTabs: `${labels(scenarioTabs).join(', ')} (${
          scenarioTabs.shadowRoot.querySelector('[role="tablist"]').getAttribute('aria-orientation')
        }, selected ${selected(scenarioTabs)})`,
        heading: skill.querySelector('h1').textContent,
        rows: skill.querySelectorAll('table tr').length,
        link: skill.querySelector('p:last-of-type').textContent,
      }
    })
    const stateToggle = await page.evaluate(async () => {
      const scenario = globalThis.impScenarios()[0]
      const toggle = globalThis.impAll('imp-button', scenario)
        .find((node) => node.shadowRoot.querySelector('[aria-label="Edit state"]') !== null)
        .shadowRoot.querySelector('button')
      const dialog = globalThis.impOne('imp-dialog', scenario)
      const panel = dialog.shadowRoot.querySelector('dialog')
      const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
      const before = toggle.getAttribute('aria-pressed')
      toggle.click()
      await settle()
      const showing = () => panel.matches(':popover-open, [open]')
      const until = async (condition) => {
        for (let attempt = 0; attempt < 40 && !condition(); attempt++) await settle()
      }
      await until(showing)
      const opened = `${toggle.getAttribute('aria-pressed')}/${showing()}`
      dialog.shadowRoot.querySelector('.close').click()
      await until(() => !showing())
      const closed = `${toggle.getAttribute('aria-pressed')}/${showing()}`
      toggle.click()
      await settle()
      return { before, opened, closed }
    })
    const edited = await page.evaluate(() => {
      const scenario = globalThis.impScenarios()[0]
      const editor = globalThis.impOne('imp-preview-state', scenario)
      const field = globalThis.impTextareas(editor)[0]
      field.value = '42'
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      globalThis.impOne('imp-button', editor).shadowRoot.querySelector('button').click()
      return globalThis.impOne('demo-counter', scenario)
        .shadowRoot.querySelector('#value').textContent
    })
    const rejected = await page.evaluate(() => {
      const scenario = globalThis.impScenarios()[0]
      const editor = globalThis.impOne('imp-preview-state', scenario)
      const field = globalThis.impTextareas(editor)[0]
      field.value = '{ not json'
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      globalThis.impOne('imp-button', editor).shadowRoot.querySelector('button').click()
      return editor.shadowRoot.querySelector('.message').classList.contains('message--error')
    })
    const localized = await page.evaluate(async () => {
      const languages = globalThis.impPicker('Language')
      const directions = globalThis.impSwitcher('direction')
      const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
      const stage = () => globalThis.impOne('imp-preview-stage').shadowRoot.querySelector('.stage')
      const state = () =>
        `${document.documentElement.lang}/${document.documentElement.dir}/${stage().dir}`
      const pick = async (picker, value) => {
        picker.value = value
        picker.dispatchEvent(new Event('change'))
        await settle()
        return state()
      }
      const pin = async (value) => {
        directions.pick(value)
        await settle()
        return state()
      }
      const step = async () => {
        directions.step()
        await settle()
        return `${directions.selected()} ${state()}`
      }
      const chrome = () => globalThis.impOne('imp-shell').getAttribute('dir')
      const words = () => {
        const shadow = globalThis.impOne('demo-counter').shadowRoot
        return `${shadow.querySelector('#label').textContent}/${
          shadow.querySelector('#cancel').textContent
        }`
      }
      return {
        languages: [...languages.options].map((option) => option.value),
        directions: directions.options(),
        directionIcons: directions.items().every((item) => item.querySelector('imp-icon') !== null),
        english: words(),
        polish: await pick(languages, 'pl') && words(),
        arabic: await pick(languages, 'ar'),
        arabicWords: words(),
        arabicChrome: chrome(),
        pinnedLtr: await pin('ltr'),
        steppedToRtl: await step(),
        steppedToAuto: await step(),
        backToEnglish: await pick(languages, 'en'),
      }
    })

    const themed = await page.evaluate(() => {
      const themes = globalThis.impSwitcher('theme')
      const surface = () =>
        getComputedStyle(document.documentElement).getPropertyValue('--imp-color-surface')
      const font = () =>
        getComputedStyle(document.documentElement).getPropertyValue('--imp-font-family')
      const apply = (value) => {
        themes.pick(value)
        return surface()
      }
      const iconOf = (item) => item.querySelector('imp-icon') !== null
      const initial = themes.selected()
      const dark = apply('imp-dark')
      const darkFont = font()
      themes.step()
      const stepped = themes.selected()
      return {
        options: themes.options(),
        icons: themes.items().every(iconOf),
        selected: initial,
        dark,
        darkFont,
        stepped,
        custom: apply('brand'),
      }
    })

    const themeEdits = await page.evaluate(async () => {
      const open = globalThis.impAll('imp-button')
        .find((node) => node.shadowRoot.textContent.includes('edit theme'))
      open.shadowRoot.querySelector('button').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
      const editorHost = globalThis.impOne('imp-theme-editor')
      const panel = editorHost.shadowRoot
      const KNOB_HOSTS = ['imp-color-picker', 'imp-combo-box', 'imp-segmented']
      const knobHosts = []
      const walkKnobs = (root) => {
        for (const element of root.querySelectorAll('*')) {
          if (KNOB_HOSTS.includes(element.localName)) knobHosts.push(element)
          if (element.shadowRoot) walkKnobs(element.shadowRoot)
        }
      }
      walkKnobs(panel)
      const labelOf = (host) =>
        host.shadowRoot.querySelector('.label')?.textContent.trim() ?? '(no label)'
      const knobs = knobHosts.map((host) => `${labelOf(host)} (${host.localName})`)
      const host = (label) => knobHosts.find((candidate) => labelOf(candidate) === label)
      const token = (name) =>
        getComputedStyle(document.documentElement).getPropertyValue(`--imp-${name}`).trim()
      const type = (label, value) => {
        const node = host(label).shadowRoot.querySelector('#control')
        node.value = value
        node.dispatchEvent(new Event('input'))
      }
      const pick = (label, choice) =>
        [...host(label).shadowRoot.querySelectorAll('.segment')]
          .find((segment) => segment.textContent.trim() === choice).click()
      type('Primary', '#8821ac')
      const primary = token('color-primary')
      const derived = token('color-on-primary')
      pick('Border radius', 'none')
      const flat = token('radius-item')
      type('Shadow colour', '#ff0000')
      const shadow = token('color-shadow')
      pick('Loader', 'dots')
      const loader = token('loader')
      return {
        knobs: knobs.join(', '),
        primary,
        derived,
        flat,
        shadow,
        loader,
        usage: globalThis.impDeep('pre', globalThis.impDeep('.usage', editorHost)).textContent
          .split('\n')[0],
      }
    })

    const shell = await page.evaluate(() => {
      const menu = globalThis.impOne('imp-shell').shadowRoot.querySelector('.sidebar')
      const links = [...menu.querySelectorAll('li.child .link')]
      const deepText = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.data
        const scope = node.shadowRoot ?? node
        return [...scope.childNodes].map(deepText).join('')
      }
      const parts = (link) =>
        `${link.querySelector('.label').textContent} ${deepText(link.querySelector('.tag'))}`
      return {
        sidebar: links.map((link) => link.textContent).join(', '),
        groups: [...menu.querySelectorAll('li:not(.child) .link')].map(parts).join(', '),
        groupIcons: [...menu.querySelectorAll('li:not(.child) .link')]
          .map((link) => link.querySelector('.icon imp-icon')?.shadowRoot?.querySelector('svg'))
          .map((svg) => (svg ? `${svg.querySelectorAll('*').length} shapes` : 'no icon'))
          .join(', '),
        current: links.find((link) => link.hasAttribute('aria-current'))?.textContent ?? 'none',
        head: globalThis.impOne('imp-heading', globalThis.impOne('imp-preview-head')).shadowRoot
          .textContent.trim(),
        description: globalThis.impOne('imp-preview-head').shadowRoot
          .querySelector('.md.description').innerHTML.replace(/\s+/g, ' ').trim(),
      }
    })

    await page.goto(`${base}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => globalThis.impOne('imp-preview-index'))
    const index = await page.evaluate(() => {
      const root = globalThis.impOne('imp-preview-index').shadowRoot
      const hero = root.querySelector('.hero')
      const deepText = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.data
        const scope = node.shadowRoot ?? node
        return [...scope.childNodes].map(deepText).join('')
      }
      const rendered = (name, from = hero) => deepText(globalThis.impOne(name, from)).trim()
      const groupLink = (head) => globalThis.impOne('imp-link', head).shadowRoot.querySelector('a')
      return {
        headline: `${rendered('imp-heading')} - ${rendered('imp-text')}`,
        cards: [...root.querySelectorAll('imp-card')]
          .map((host) => host.shadowRoot.querySelector('.header'))
          .map((head) =>
            `${rendered('imp-heading', head)} ${rendered('imp-tag', head)} -> ${
              groupLink(head).getAttribute('href')
            }`
          )
          .join(' | '),
      }
    })

    await page.goto(`${base}/widgets`, { waitUntil: 'load' })
    await page.waitForFunction(() =>
      globalThis.impOne('imp-preview-group') &&
      globalThis.impOne('demo-counter', globalThis.impOne('imp-preview-group'))?.shadowRoot
        ?.querySelector('#value')
    )
    const group = await page.evaluate(() => {
      const root = globalThis.impOne('imp-preview-group').shadowRoot
      const cards = [...root.querySelectorAll('imp-card')]
        .map((host) => host.shadowRoot.querySelector('.card'))
      const card = cards[0]
      const specimen = globalThis.impDeep('.specimen', card)
      const hero = root.querySelector('.hero')
      return {
        headline: globalThis.impOne('imp-heading', hero).shadowRoot.textContent.trim(),
        description: globalThis.impOne('imp-markdown', hero).shadowRoot.querySelector('p')
          .innerHTML.trim(),
        cards: cards.map((node) =>
          `${node.getAttribute('aria-label')} (${
            globalThis.impDeep('.card-scenario', node).textContent
          })`
        ).join(', '),
        inert: specimen.hasAttribute('inert'),
        specimen: globalThis.impOne('demo-counter', specimen).shadowRoot.querySelector('#value')
          .textContent,
        href: card.getAttribute('href'),
        title: document.title,
      }
    })
    await page.evaluate(() =>
      globalThis.impOne('imp-preview-group').shadowRoot.querySelector('imp-card').shadowRoot
        .querySelector('.card').click()
    )
    await page.waitForFunction(() => globalThis.impScenarios().length > 0)
    const opened = await page.evaluate(() => `${location.pathname} - ${document.title}`)

    await page.goto(`${base}/widgets/counter?scenario=lazy`, { waitUntil: 'load' })
    await page.waitForFunction(() =>
      globalThis.impRoot() && globalThis.impOne('demo-counter')?.shadowRoot?.children
    )
    const isolated = await page.evaluate(() => {
      const scenarioTabs = globalThis.impAll('imp-tabs')[1].shadowRoot
      const selectedTab = scenarioTabs.querySelector('[role="tab"][aria-selected="true"]')
      const panel = scenarioTabs.getElementById(selectedTab.getAttribute('aria-controls'))
      const scenario = panel.querySelector('imp-preview-scenario')
      return {
        panels: globalThis.impScenarios().length,
        name: selectedTab.textContent.trim(),
        shown: scenario.shadowRoot.querySelector('h2').textContent,
        hiddenPanels: scenarioTabs.querySelectorAll('[role="tabpanel"][hidden]').length,
        code: globalThis.impCodeOf(scenario).split('\n').at(-1),
      }
    })

    await page.goto(`${base}/components/todos`, { waitUntil: 'load' })
    await page.waitForFunction(() =>
      globalThis.impRoot() &&
      globalThis.impOne('demo-todos')?.shadowRoot?.querySelectorAll('.todo').length === 2 &&
      globalThis.impOne('imp-preview-state') !== null
    )
    const todos = await page.evaluate(() => ({
      items: [...globalThis.impOne('demo-todos').shadowRoot.querySelectorAll('.todo')]
        .map((item) => item.textContent),
      state: [
        ...globalThis.impOne('imp-preview-state').shadowRoot.querySelectorAll('.name, .provider'),
      ]
        .map((node) => node.textContent).join(' '),
      agent: globalThis.impOne('imp-preview-skill').shadowRoot.querySelector('.missing')
        .textContent,
      skill: globalThis.impOne('imp-empty-state', globalThis.impOne('imp-preview-skill'))
        .shadowRoot.querySelector('.title').textContent.trim(),
    }))

    const panelWidths = () => {
      const scenario = globalThis.impScenarios()[0]
      const width = (node) => Math.round(node.getBoundingClientRect().width)
      const panel = width(scenario.shadowRoot.querySelector('.scenario'))
      const head = width(scenario.shadowRoot.querySelector('.scenario-head'))
      const frame = width(
        globalThis.impOne('imp-preview-stage', scenario).shadowRoot.querySelector('.frame'),
      )
      const canvas = globalThis.impOne('imp-preview-canvas').shadowRoot.querySelector('.scroll')
      const strip = globalThis.impAll('imp-tabs')[1].shadowRoot
      const fold = strip.querySelector('.fold')
      return {
        folded: fold.getAttribute('aria-expanded') === 'false',
        foldLabel: fold.getAttribute('aria-label'),
        tabsInert: strip.querySelector('[role="tablist"]').inert,
        share: Math.round(panel * 100 / canvas.clientWidth),
        filled: head === panel && frame === panel,
        scrolls: canvas.scrollWidth > canvas.clientWidth,
      }
    }
    const widenedTo = async (width) => {
      const scenario = globalThis.impScenarios()[0]
      const stage = globalThis.impOne('imp-preview-stage', scenario).shadowRoot
      const input = globalThis.impOne('imp-text-field', stage.querySelector('.sizes')).shadowRoot
        .querySelector('input')
      const canvas = globalThis.impOne('imp-preview-canvas').shadowRoot.querySelector('.scroll')
      const frame = stage.querySelector('.frame')
      const readout = stage.querySelector('.readout')
      const type = async (value) => {
        input.value = value
        input.dispatchEvent(new Event('input', { bubbles: true }))
        for (let attempt = 0; attempt < 40; attempt++) {
          await new Promise((resolve) => requestAnimationFrame(resolve))
          if (
            readout.textContent.startsWith(`${Math.round(frame.getBoundingClientRect().width)} x`)
          ) {
            break
          }
        }
      }
      await type(String(width))
      const result = {
        frame: Math.round(frame.getBoundingClientRect().width),
        readout: readout.textContent.split(' x ')[0],
        beyondScreen: frame.getBoundingClientRect().width > innerWidth,
        scrolls: canvas.scrollWidth > canvas.clientWidth,
        reachable: canvas.scrollWidth >= frame.getBoundingClientRect().right -
            canvas.getBoundingClientRect().left + canvas.scrollLeft,
      }
      await type('')
      const panel = scenario.shadowRoot.querySelector('.scenario').getBoundingClientRect().width
      result.released = Math.round(frame.getBoundingClientRect().width) === Math.round(panel)
      return result
    }
    const wide = await page.evaluate(panelWidths)
    const wideStage = await page.evaluate(widenedTo, 2000)
    await page.setViewport({ width: 390, height: 844 })
    await page.waitForFunction(() =>
      globalThis.impAll('imp-tabs')[1].shadowRoot.querySelector('.fold')
        .getAttribute('aria-expanded') === 'false'
    )
    const shrunk = await page.evaluate(panelWidths)
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(() =>
      globalThis.impScenarios().length > 0 &&
      globalThis.impOne('imp-preview-stage')?.shadowRoot?.querySelector('.frame')
    )
    const phone = await page.evaluate(panelWidths)
    const phoneStage = await page.evaluate(widenedTo, 1280)
    const unfolded = await page.evaluate(async () => {
      const strip = globalThis.impAll('imp-tabs')[1].shadowRoot
      strip.querySelector('.fold').click()
      await new Promise((resolve) => setTimeout(resolve, 300))
      const tab = strip.querySelector('[role="tab"]')
      return {
        expanded: strip.querySelector('.fold').getAttribute('aria-expanded'),
        tabsInert: strip.querySelector('[role="tablist"]').inert,
        tabVisible: tab.getBoundingClientRect().width > 0,
        remembered: localStorage.getItem('imp.preview.tabs'),
      }
    })
    const anchored = await page.evaluate(async () => {
      const scenario = globalThis.impScenarios()[0]
      const toggle = globalThis.impAll('imp-button', scenario)
        .map((node) => node.shadowRoot.querySelector('[aria-label="Edit state"]'))
        .find((node) => node !== null)
      const panel = globalThis.impOne('imp-dialog', scenario).shadowRoot.querySelector('dialog')
      toggle.click()
      for (let attempt = 0; attempt < 40 && !panel.matches(':popover-open'); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
      const toggleBox = toggle.getBoundingClientRect()
      const box = panel.getBoundingClientRect()
      const result = {
        anchored: panel.hasAttribute('data-anchored') &&
          getComputedStyle(panel).positionAnchor !== 'none',
        below: Math.round(box.top - toggleBox.bottom),
        inside: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      }
      globalThis.impOne('imp-dialog', scenario).shadowRoot.querySelector('.close').click()
      for (let attempt = 0; attempt < 40 && panel.matches(':popover-open'); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return result
    })
    await page.setViewport({ width: 1280, height: 800 })
    const resizeLoops = await page.evaluate(() => globalThis.impResizeLoops)
    check(
      resizeLoops === 0,
      `the preview chrome drove ${resizeLoops} ResizeObserver feedback loops - something read a ` +
        'size and then wrote layout that changes it',
    )
    const errors = await page.evaluate(() => globalThis.impErrors)
    check(errors.length === 0, `the preview page logged errors:\n${errors.join('\n')}`)

    const readout = await page.evaluate(() => {
      const stage = globalThis.impOne('imp-preview-stage').shadowRoot
      const node = stage.querySelector('.readout')
      const restore = node.textContent
      const widthShowing = (text) => {
        node.textContent = text
        return node.getBoundingClientRect().width
      }
      const result = { narrow: widthShowing('1 x 1'), wide: widthShowing('1280 x 800') }
      node.textContent = restore
      return result
    })
    check(
      readout.narrow === readout.wide,
      'the stage size readout resizes with its own text (' +
        `${readout.narrow} vs ${readout.wide}px) - a ResizeObserver writes that text, so its ` +
        'width must not depend on it or measuring the stage changes the stage',
    )

    await page.evaluate(() => {
      const applied = localStorage.getItem('imp.preview.theme') ?? 'brand'
      localStorage.setItem(
        `imp.theme-draft.${applied}`,
        JSON.stringify({
          tokens: { 'color-primary': '#ff00ff' },
          base: { 'color-primary': '#00ff00' },
        }),
      )
    })
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(() => globalThis.impOne?.('imp-shell'))
    const staleDraft = await page.evaluate(() => ({
      applied:
        document.documentElement.style.getPropertyValue('--imp-color-primary').trim() === '#ff00ff',
      left: Object.keys(localStorage).filter((key) => key.startsWith('imp.theme-draft.')).length,
    }))

    const report = [
      `scenarios: ${counter.names.join(', ')}`,
      `rendered values: ${counter.rendered.join(', ')}`,
      `state rows: ${counter.states.join(', ')}`,
      `resize handles per stage: ${counter.handles}`,
      `scenario tabs on a wide screen: folded ${wide.folded} ('${wide.foldLabel}', tabs inert ${wide.tabsInert}), panel is ${wide.share}% of the canvas, head and stage fill it ${wide.filled}, canvas scrolls sideways ${wide.scrolls}`,
      `stage typed to 2000px on a wide screen: frame ${wideStage.frame}px (readout ${wideStage.readout}), wider than the screen ${wideStage.beyondScreen}, canvas scrolls sideways ${wideStage.scrolls}, right edge reachable ${wideStage.reachable}, cleared box releases the width ${wideStage.released}`,
      `scenario tabs after the screen shrinks to a phone: folded ${shrunk.folded} ('${shrunk.foldLabel}', tabs inert ${shrunk.tabsInert})`,
      `scenario tabs on a phone: folded ${phone.folded} ('${phone.foldLabel}', tabs inert ${phone.tabsInert}), panel is ${phone.share}% of the canvas, head and stage fill it ${phone.filled}, canvas scrolls sideways ${phone.scrolls}`,
      `stage typed to 1280px on a phone: frame ${phoneStage.frame}px (readout ${phoneStage.readout}), wider than the screen ${phoneStage.beyondScreen}, canvas scrolls sideways ${phoneStage.scrolls}, right edge reachable ${phoneStage.reachable}, cleared box releases the width ${phoneStage.released}`,
      `after a tap on the fold button: aria-expanded ${unfolded.expanded}, tabs inert ${unfolded.tabsInert}, a tab is visible ${unfolded.tabVisible}, remembered as '${unfolded.remembered}'`,
      `state editor on a phone: anchored ${anchored.anchored}, ${anchored.below}px under its toggle, inside the viewport ${anchored.inside}`,
      `agent instruction strips on the page: ${agent.strips} (region '${agent.region}')`,
      `agent instruction: ${agent.instruction}`,
      `agent instruction copy control: ${agent.copy}`,
      `code hidden before the toggle: ${codeAndSkill.hidden}`,
      `code toggle pressed: ${codeAndSkill.toggle} (remembered as ${codeAndSkill.stored})`,
      `scenario tabs: ${codeAndSkill.scenarioTabs}`,
      `state toggle: ${stateToggle.before} -> opened ${stateToggle.opened} -> closed ${stateToggle.closed}`,
      `code of the first scenario:\n${codeAndSkill.code}`,
      `tabs: ${codeAndSkill.tabs}`,
      `skill heading: ${codeAndSkill.heading}`,
      `skill table rows: ${codeAndSkill.rows}`,
      `skill link retargeted: ${codeAndSkill.link}`,
      `after setting demo.count to 42: ${edited}`,
      `invalid JSON rejected: ${rejected}`,
      `language options: ${localized.languages.join(', ')}`,
      `direction options: ${
        localized.directions.join(', ')
      } (every item has an icon: ${localized.directionIcons})`,
      `app + imp words in en: ${localized.english}`,
      `app + imp words in pl: ${localized.polish}`,
      `app + imp words in ar: ${localized.arabicWords}`,
      `lang/dir/stage after picking ar: ${localized.arabic}`,
      `chrome direction while previewing ar: ${localized.arabicChrome}`,
      `lang/dir/stage after pinning ltr: ${localized.pinnedLtr}`,
      `direction, lang/dir/stage after one step: ${localized.steppedToRtl}`,
      `direction, lang/dir/stage after one more step: ${localized.steppedToAuto}`,
      `lang/dir/stage back on en: ${localized.backToEnglish}`,
      `theme options: ${
        themed.options.join(', ')
      } (selected ${themed.selected}, every item has an icon: ${themed.icons})`,
      `theme after one step from imp-dark: ${themed.stepped}`,
      `imp-dark surface token: ${themed.dark}`,
      `imp-dark font token, from the theme file that replaces it: ${themed.darkFont}`,
      `brand surface token: ${themed.custom}`,
      `theme editor knobs: ${themeEdits.knobs}`,
      `after picking a primary: ${themeEdits.primary} (on-primary ${themeEdits.derived})`,
      `after picking radius none: ${themeEdits.flat}`,
      `after picking a shadow colour: ${themeEdits.shadow}`,
      `after picking the dots loader: ${themeEdits.loader}`,
      `theme editor usage line: ${themeEdits.usage}`,
      `sidebar groups: ${shell.groups}`,
      `sidebar group icons: ${shell.groupIcons}`,
      `sidebar components: ${shell.sidebar}`,
      `sidebar current: ${shell.current}`,
      `page head: ${shell.head}`,
      `page head description: ${shell.description}`,
      `index headline: ${index.headline}`,
      `index cards: ${index.cards}`,
      `group headline: ${group.headline}`,
      `group description: ${group.description}`,
      `group cards: ${group.cards}`,
      `group card specimen is inert: ${group.inert}, shows ${group.specimen}, links to ${group.href}`,
      `group title: ${group.title}`,
      `after a click on the card: ${opened}`,
      `?scenario=lazy: ${isolated.panels} panels mounted, ${isolated.hiddenPanels} hidden, tab ${isolated.name} shows ${isolated.shown}, call site ${isolated.code}`,
      `mocked todos: ${todos.items.join(', ')}`,
      `mocked todos state row: ${todos.state}`,
      `agent strip without a sidecar: ${todos.agent}`,
      `skill tab without a sidecar: ${todos.skill}`,
      `a draft of a theme that changed since: applied ${staleDraft.applied}, drafts left: ${staleDraft.left}`,
    ].join('\n')
    await assertSnapshot('preview-browser', `${report}\n`)
  } finally {
    await browser.close().catch(() => {})
    await server.stop()
  }
})

const SIZE = /\(\d+(\.\d+)? [kM]?B\)/g

Deno.test('imp preview --output writes the element script and the group bundles', async () => {
  const outdir = await Deno.makeTempDir()
  const output = join(outdir, 'gallery')
  const result = await runImp(['preview', '--output', output], fixture('preview'))
  const files = await listFiles(output).catch(() => [])
  const script = await Deno.readTextFile(join(output, 'imp-preview.js')).catch(() => '')
  const app = await Deno.readTextFile(join(output, 'app.js')).catch(() => '')
  const chunk = files.find((name) => name.startsWith('chunks/')) ?? null
  const widgets = await Deno.readTextFile(join(output, 'groups', 'widgets.js')).catch(() => '')
  await Deno.remove(outdir, { recursive: true })
  const page = script.match(/^const PAGE = (".*")$/m)
  const html = page ? JSON.parse(page[1]) : ''
  const report = [
    commandTranscript('imp preview --output <out>/gallery  (cwd: /test/fixtures/preview)', {
      ...result,
      stdout: result.stdout.replaceAll(relative(fixture('preview'), outdir), '<out>')
        .replace(SIZE, '(<size>)')
        .replace(/chunks\/[\w-]+\.js/g, 'chunks/<name>-<hash>.js'),
    }),
    section(
      'files',
      files.map((name) => name.replace(/^chunks\/.*$/, 'chunks/<name>-<hash>.js')).sort().join(
        '\n',
      ),
    ),
    section(
      'imp-preview.js',
      [
        `defines the element: ${script.includes('customElements.define(ELEMENT, ImpPreview)')}`,
        `element name: ${script.match(/const ELEMENT = '([^']+)'/)?.[1]}`,
        `finds the app next to itself: ${
          script.includes("const APP = new URL('./app.js', import.meta.url).href")
        }`,
        `shows the page in a blob url frame: ${
          script.includes('URL.createObjectURL(new Blob([pageSource()]')
        }`,
        `mirrors the route to the address of the page: ${script.includes('history.replaceState(')}`,
        `follows the address of the page: ${script.includes("addEventListener('hashchange'")}`,
        `entry page kept: ${html.includes("font-family: 'Fixture Sans'")}`,
        `title: ${html.match(/<title>([^<]*)<\/title>/)?.[1]}`,
        `hash routing: ${html.includes('globalThis.__IMP_ENV__ = {"IMP_ROUTING":"hash"}')}`,
        `loads the app by its address: ${
          html.includes('<script type="module" src="imp-preview:app">')
        }`,
        `no dev server client: ${!html.includes('/@imp/client')}`,
      ].join('\n'),
    ),
    section(
      'app.js',
      [
        `starts the chrome embedded: ${app.includes('embedded:!0')}`,
        `catalog embedded: ${app.includes('components/counter.preview.js')}`,
        `loads a group on demand: ${/import\(["']\.\/groups\/widgets\.js["']\)/.test(app)}`,
        `library shared through a chunk: ${chunk !== null && app.includes(`./${chunk}`)}`,
        `route bridge: ${app.includes('imp-preview-route')}`,
        `no dev server address: ${!app.includes('/@imp/preview/')}`,
      ].join('\n'),
    ),
    section(
      'groups/widgets.js',
      [
        `holds the counter: ${widgets.includes('demo-counter')}`,
        `not the todos: ${!widgets.includes('demo-todos')}`,
      ].join('\n'),
    ),
  ].join('\n\n')
  await assertSnapshot('preview-output', `${report}\n`)
})

Deno.test('the exported preview embeds in a page and shares its address', async () => {
  const site = await Deno.makeTempDir()
  const exported = await runImp(
    ['preview', '--output', join(site, 'components')],
    fixture('preview'),
  )
  check(exported.code === 0, `export failed: ${exported.stderr}`)
  const host = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<h1>Host page</h1>
<script type="module" src="/components/imp-preview.js"></script>
<imp-preview style="block-size: 600px"></imp-preview>
</body></html>`
  const server = Deno.serve({ port: 0, onListen: () => {} }, async (request) => {
    const path = new URL(request.url).pathname
    if (path.endsWith('.js')) {
      return new Response(await Deno.readFile(join(site, path)), {
        headers: { 'content-type': 'text/javascript' },
      })
    }
    return new Response(host, { headers: { 'content-type': 'text/html' } })
  })
  const base = `http://127.0.0.1:${server.addr.port}`
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  const browser = await puppeteer.launch({
    executablePath: await resolveBrowser(),
    headless: true,
    args,
  })
  const helpers = () => {
    globalThis.impAll = (name, from = document) => {
      const found = []
      const walk = (root) => {
        for (const element of root.querySelectorAll('*')) {
          if (element.localName === name) found.push(element)
          if (element.shadowRoot) walk(element.shadowRoot)
        }
      }
      walk(from)
      if (from.shadowRoot) walk(from.shadowRoot)
      return found
    }
    globalThis.impOne = (name, from) => globalThis.impAll(name, from)[0] ?? null
    globalThis.impHeadShown = () => {
      const head = globalThis.impOne('imp-preview-head')
      return head !== null && globalThis.impOne('imp-heading', head) !== null
    }
    globalThis.impText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.data
      const scope = node.shadowRoot ?? node
      return [...scope.childNodes].map(globalThis.impText).join('')
    }
  }
  const frameOf = async (page) => {
    await page.waitForFunction(() =>
      document.querySelector('imp-preview')?.shadowRoot?.querySelector('iframe')?.contentDocument
        ?.querySelector('imp-preview-page')?.shadowRoot
    )
    const frame = page.frames().find((candidate) => candidate.url().startsWith('blob:'))
    await frame.evaluate(helpers)
    return frame
  }
  const shown = (frame) =>
    frame.evaluate(() => {
      const head = globalThis.impOne('imp-preview-head')
      const heading = head === null ? null : globalThis.impOne('imp-heading', head)
      return {
        index: globalThis.impOne('imp-preview-index') !== null,
        head: heading === null ? 'none' : globalThis.impText(heading).trim(),
        route: location.hash,
        title: document.title,
      }
    })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}/gallery`, { waitUntil: 'load' })
    const frame = await frameOf(page)
    const index = await shown(frame)
    const frameUrl = frame.url()
    const frameIcon = await frame.evaluate(() => document.querySelector('link[rel="icon"]').href)
    await frame.evaluate(() => {
      const shell = globalThis.impOne('imp-shell')
      const link = [...shell.shadowRoot.querySelectorAll('a')]
        .find((anchor) => anchor.textContent.includes('Counter'))
      link.click()
    })
    await frame.waitForFunction(() => globalThis.impHeadShown())
    const component = await shown(frame)
    const hostAfterClick = new URL(page.url())
    await page.evaluate(() => {
      location.hash = '#/'
    })
    await frame.waitForFunction(() => globalThis.impOne('imp-preview-index'))
    const followed = await shown(frame)
    const hostAfterFollow = new URL(page.url())

    const deep = await browser.newPage()
    await deep.setViewport({ width: 1400, height: 900 })
    await deep.goto(`${base}/gallery#/widgets/counter?scenario=startsAtFive`, {
      waitUntil: 'load',
    })
    const deepFrame = await frameOf(deep)
    await deepFrame.waitForFunction(() => globalThis.impHeadShown())
    const deepLink = await shown(deepFrame)
    const selectedTab = await deepFrame.evaluate(() =>
      globalThis.impOne('imp-tabs', globalThis.impOne('imp-preview-scenario-tabs')).shadowRoot
        .querySelector('[aria-selected="true"]')?.textContent.trim()
    )
    const themeShown = () =>
      deepFrame.evaluate(() => document.documentElement.style.getPropertyValue('color-scheme'))
    const hostTheme = () =>
      deep.evaluate(() => document.querySelector('imp-preview').getAttribute('theme'))
    const themeBeforeOffer = await themeShown()
    await deep.evaluate(() => {
      globalThis.impThemeEvents = []
      const preview = document.querySelector('imp-preview')
      preview.addEventListener('imp-preview-theme', (event) => {
        globalThis.impThemeEvents.push(event.detail)
      })
      preview.theme = 'imp-dark'
    })
    await deepFrame.waitForFunction(() =>
      document.documentElement.style.getPropertyValue('color-scheme') === 'dark'
    )
    const themeAfterOffer = await themeShown()
    await deepFrame.evaluate(() => {
      globalThis.impAll('button')
        .find((candidate) => candidate.getAttribute('aria-label')?.includes('next theme'))
        .click()
    })
    await deep.waitForFunction(() =>
      document.querySelector('imp-preview').getAttribute('theme') !== 'imp-dark'
    )
    const themeAfterPick = { host: await hostTheme(), frame: await themeShown() }
    const themeEvents = await deep.evaluate(() => globalThis.impThemeEvents)
    const report = [
      `host page keeps its own document: ${await page.evaluate(() =>
        document.querySelector('h1').textContent
      )}`,
      `frame url is a blob of the host origin: ${frameUrl.startsWith(`blob:${base}/`)}`,
      `root-relative link of the entry resolves on the host: ${
        frameIcon === `${base}/favicon.svg`
      }`,
      `index shown first: ${index.index}, route ${
        JSON.stringify(index.route)
      }, title ${index.title}`,
      `after a click: ${component.head}, route ${component.route}, title ${component.title}`,
      `host address after the click: ${hostAfterClick.pathname}${hostAfterClick.hash}`,
      `host hash change followed: index ${followed.index}, route ${JSON.stringify(followed.route)}`,
      `host address after the follow: ${hostAfterFollow.pathname}${hostAfterFollow.hash}`,
      `deep link: ${deepLink.head}, route ${deepLink.route}, tab ${selectedTab}`,
      `sidebar without the imp brand: ${await deepFrame.evaluate(() =>
        globalThis.impOne('imp-app-logo') === null
      )}`,
      `theme before the host offers one: ${themeBeforeOffer}`,
      `theme after the host offers imp-dark: ${themeAfterOffer}`,
      `theme after a pick in the gallery: host ${themeAfterPick.host}, frame ${themeAfterPick.frame}`,
      `theme events on the element: ${themeEvents.join(', ')}`,
      `page errors: ${errors.length ? errors.join(' | ') : 'none'}`,
    ].join('\n')
    await assertSnapshot('preview-output-browser', `${report}\n`)
  } finally {
    await browser.close().catch(() => {})
    await server.shutdown()
    await Deno.remove(site, { recursive: true })
  }
})

Deno.test('a review file names itself by timestamp and records the page it came from', async () => {
  const at = new Date('2026-08-25T12:10:36.682Z')
  const address = (hostname) => ({ remoteAddr: { transport: 'tcp', hostname } })
  const report = [
    `file name: ${reviewFileName(at)}`,
    `file name when that one exists: ${reviewFileName(at, 2)}`,
    `from 127.0.0.1: ${isLocalRequest(address('127.0.0.1'))}`,
    `from ::1: ${isLocalRequest(address('::1'))}`,
    `from ::ffff:127.0.0.1: ${isLocalRequest(address('::ffff:127.0.0.1'))}`,
    `from 192.168.1.20: ${isLocalRequest(address('192.168.1.20'))}`,
    `with no address at all: ${isLocalRequest(undefined)}`,
    '',
    formatReview(
      {
        page: 'http://localhost:4517/preview/components/counter.preview.js',
        title: 'imp preview - Widgets / Counter',
        viewport: '900x700 at 2x',
        scroll: '0,1240',
        scheme: 'dark',
        motion: 'reduce',
        lang: 'en',
        dir: 'ltr',
        element: {
          path: 'body > imp-preview-page >> demo-counter >> span#value',
          rect: '10x19 at 371,485',
          text: 'Total 0',
          html: '<span id="value">0</span>',
        },
        state: [{ name: 'demo.count', value: 0 }, { name: 'demo.filter', value: 'done' }],
        controls: [
          { name: 'input[name=title]', value: 'Buy milk' },
          { name: 'input[name=done]', value: 'checked', disabled: true },
          { name: 'input[name=secret]', value: null, length: 8 },
        ],
        comment: 'The count is cut off.\n\nIt needs more room at 320px.',
      },
      at.toISOString(),
      [
        '[BROWSER:error] TypeError: todo is undefined',
        '[HTTP] GET /api/todos -> 500 12ms',
      ],
    ),
    formatReview(
      { element: { path: 'body' }, comment: 'a review with no page around it' },
      at.toISOString(),
    ),
  ].join('\n')
  await assertSnapshot('review-file', report)
})

Deno.test('imp start saves a review under .imp/reviews', async () => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('basic'), dir)
  const server = await startServer(dir)
  const endpoint = `http://127.0.0.1:${server.port}/@imp/review`
  const post = (body) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  try {
    const saved = await post({
      page: `http://localhost:${server.port}/`,
      title: 'basic app',
      viewport: '900x700',
      element: { path: 'body > div#app > h1', text: 'hello', html: '<h1>hello</h1>' },
      comment: 'the heading should be quieter',
    })
    const { path } = await saved.json()
    const written = await Deno.readTextFile(join(dir, path))
    const blank = await post({ element: { path: 'body' }, comment: '   ' })
    const malformed = await post('not json at all')
    await post({
      element: { path: 'body > footer' },
      comment: 'the year in the footer is stale',
    })
    const listed = await runImp(['review'], dir)
    const fromSubdirectory = await runImp(['review'], join(dir, 'public'))
    const cleared = await runImp(['review', 'clear'], dir)
    const afterClearing = await runImp(['review'], dir)
    const clearedAgain = await runImp(['review', 'clear'], dir)
    const maskTimestamps = (text) =>
      normalize(text)
        .replaceAll(/[\d-]+T[\d:.-]+Z/g, '<timestamp>')
        .replaceAll(`:${server.port}`, ':<port>')
        .replaceAll(dir, '<tmp>')
    const report = [
      `POST /@imp/review: ${saved.status} ${saved.headers.get('content-type')}`,
      `path: ${path.replace(/[\d-]+T[\d-]+Z/, '<timestamp>')}`,
      `on a blank comment: ${blank.status} ${JSON.stringify(await blank.json())}`,
      `on a malformed body: ${malformed.status} ${JSON.stringify(await malformed.json())}`,
      '',
      maskTimestamps(written),
      section('imp review', maskTimestamps(listed.stdout)),
      section(
        'imp review (cwd: public/)',
        maskTimestamps(fromSubdirectory.stdout).trimEnd().split('\n').at(-1),
      ),
      section('imp review clear', normalize(cleared.stdout)),
      section('imp review after clearing', normalize(afterClearing.stdout)),
      section('imp review clear again', normalize(clearedAgain.stdout)),
      `reviews folder left behind: ${await Deno.stat(join(dir, '.imp', 'reviews')).then(
        () => true,
        () => false,
      )}`,
    ].join('\n')
    await assertSnapshot('start-review-saved', report + '\n')
  } finally {
    await server.stop()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('the review widget picks an element in the preview page', async () => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('preview'), dir)
  const server = await startPreviewServer(dir)
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  const browser = await puppeteer.launch({
    executablePath: await resolveBrowser(),
    headless: true,
    args,
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 700 })
    await page.goto(
      `http://localhost:${server.port}/widgets/counter`,
      { waitUntil: 'load' },
    )
    await page.waitForFunction(() => document.getElementById('imp-review')?.shadowRoot)
    const flow = await page.evaluate(async () => {
      const shadow = document.getElementById('imp-review').shadowRoot
      const view = () =>
        [...shadow.querySelectorAll('.view')].find((panel) => !panel.hidden).dataset.view
      const deep = (root, name) => {
        for (const element of root.querySelectorAll('*')) {
          if (element.localName === name) return element
          const found = element.shadowRoot ? deep(element.shadowRoot, name) : null
          if (found) return found
        }
        return null
      }
      const outline = () => shadow.querySelector('.outline')
      const waitFor = async (description, ready) => {
        const deadline = Date.now() + 10000
        while (!ready()) {
          if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`)
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }
      const steps = {
        hiddenAtFirst: shadow.querySelector('.panel').hidden &&
          shadow.querySelector('.actions').hidden,
        markShown: Boolean(shadow.querySelector('.toggle svg use')),
      }
      shadow.querySelector('.toggle').click()
      steps.actionsShown = !shadow.querySelector('.actions').hidden
      steps.actionLabels = [...shadow.querySelectorAll('.action')]
        .map((button) => button.getAttribute('aria-label')).join(', ')
      steps.panelStillHidden = shadow.querySelector('.panel').hidden
      steps.expanded = shadow.querySelector('.toggle').getAttribute('aria-expanded')
      await waitFor(
        'the demo component to render',
        () => deep(document, 'demo-counter')?.shadowRoot?.querySelector('#value'),
      )
      const target = deep(document, 'demo-counter').shadowRoot.querySelector('#value')
      shadow.querySelector('[data-action="pick"]').click()
      steps.pickingView = view()
      await waitFor('the element picker to start listening', () => {
        target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }))
        return !outline().hidden
      })
      steps.highlighted = !outline().hidden
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
      await waitFor('the commenting view', () => view() === 'commenting')
      steps.commentingView = view()
      steps.outlineKept = !outline().hidden
      steps.locatorShown = shadow.textContent.includes('>>')
      const field = shadow.querySelector('textarea')
      field.value = 'The value is cut off below 320px.'
      shadow.querySelector('[data-action="save"]').click()
      await waitFor('the review to be saved', () => shadow.querySelector('.status').textContent)
      steps.status = shadow.querySelector('.status').textContent
      steps.viewAfterSaving = view()
      steps.outlineGone = outline().hidden
      console.warn('widget check')
      globalThis.__impFlushTelemetry()
      await new Promise((resolve) => setTimeout(resolve, 300))
      shadow.querySelector('[data-action="console"]').click()
      await waitFor(
        'the console lines',
        () => shadow.querySelector('.lines').textContent.includes('widget check'),
      )
      steps.consoleView = view()
      steps.consoleTitle = shadow.querySelector('[data-log-title]').textContent
      steps.consolePressed = shadow.querySelector('[data-action="console"]')
        .getAttribute('aria-pressed')
      steps.consoleLine = [...shadow.querySelectorAll('.entry')]
        .find((item) => item.textContent.includes('widget check'))?.className
      console.error('arrived live')
      globalThis.__impFlushTelemetry()
      await waitFor(
        'the live line',
        () => shadow.querySelector('.lines').textContent.includes('arrived live'),
      )
      steps.liveLine = [...shadow.querySelectorAll('.entry')]
        .find((item) => item.textContent.includes('arrived live'))?.className
      const entry = shadow.querySelector('.entry')
      steps.collapsedAtFirst = entry.getAttribute('aria-expanded')
      entry.click()
      steps.expandedOnClick = entry.getAttribute('aria-expanded')
      const chip = (name) => shadow.querySelector(`.chip[data-filter="${name}"]`)
      steps.consoleChips = [...shadow.querySelectorAll('.chip')]
        .map((button) => button.textContent).join(', ')
      chip('Error').click()
      steps.filtered = [...shadow.querySelectorAll('.entry .text')]
        .map((text) => text.textContent).join(' | ')
      steps.pressedChip = chip('Error').getAttribute('aria-pressed')
      chip('Info').click()
      steps.noMatch = shadow.querySelector('.lines').textContent.trim()
      chip('All').click()
      const clear = shadow.querySelector('[data-action="clear"]')
      const inPage = () => globalThis.__impTelemetry.entries()
      const netCount = () => inPage().filter((item) => item.type === 'net').length
      const netBefore = netCount()
      steps.clearLabel = `${clear.getAttribute('aria-label')} (disabled ${clear.disabled})`
      clear.click()
      steps.afterClear = shadow.querySelector('.lines').textContent.trim()
      steps.clearedInPage = inPage().filter((item) => item.type === 'console').length
      steps.clearDisabled = clear.disabled
      steps.networkUntouched = netCount() === netBefore
      console.log('after clear')
      await waitFor(
        'the line after the clear',
        () => shadow.querySelector('.lines').textContent.includes('after clear'),
      )
      steps.linesAfterClear = [...shadow.querySelectorAll('.entry .text')]
        .map((text) => text.textContent).join(' | ')
      steps.clearEnabledAgain = !clear.disabled
      shadow.querySelector('[data-action="network"]').click()
      await waitFor(
        'the network title',
        () => shadow.querySelector('[data-log-title]').textContent === 'Network logs',
      )
      steps.networkView = view()
      steps.networkChips = [...shadow.querySelectorAll('[data-group]')]
        .map((row) =>
          [...row.querySelectorAll('.chip')]
            .map((button) =>
              button.getAttribute('aria-pressed') === 'true'
                ? `[${button.textContent}]`
                : button.textContent
            ).join(', ')
        ).join(' / ')
      const toggle = shadow.querySelector('.toggle')
      const pointer = (type, x, y) =>
        toggle.dispatchEvent(
          new PointerEvent(type, {
            clientX: x,
            clientY: y,
            button: 0,
            pointerId: 1,
            bubbles: true,
          }),
        )
      const before = document.getElementById('imp-review').getBoundingClientRect()
      pointer('pointerdown', before.left + 20, before.top + 20)
      pointer('pointermove', before.left - 300, before.top - 200)
      pointer('pointerup', before.left - 300, before.top - 200)
      toggle.click()
      const after = document.getElementById('imp-review').getBoundingClientRect()
      steps.moved = `${Math.round(before.left - after.left)},${Math.round(before.top - after.top)}`
      steps.collapsedByDrag = shadow.querySelector('.actions').hidden
      steps.remembered = localStorage.getItem('imp-review-position')
      return steps
    })
    const files = []
    for await (const entry of Deno.readDir(join(dir, '.imp', 'reviews'))) files.push(entry.name)
    const written = await Deno.readTextFile(join(dir, '.imp', 'reviews', files[0]))
    const report = [
      `widget collapsed before the toggle: ${flow.hiddenAtFirst}`,
      `imp mark on the toggle: ${flow.markShown}`,
      `actions shown after the toggle: ${flow.actionsShown} (aria-expanded ${flow.expanded})`,
      `actions: ${flow.actionLabels}`,
      `panel still hidden: ${flow.panelStillHidden}`,
      `view after Add review: ${flow.pickingView}`,
      `element highlighted on hover: ${flow.highlighted}`,
      `view after clicking the element: ${flow.commentingView}`,
      `picked element stays outlined while commenting: ${flow.outlineKept}`,
      `element locator shown to the reviewer: ${flow.locatorShown}`,
      `view after saving: ${flow.viewAfterSaving}`,
      `outline cleared after saving: ${flow.outlineGone}`,
      `status after saving: ${flow.status.replace(/[\d-]+T[\d-]+Z/, '<timestamp>')}`,
      `console view: ${flow.consoleView} titled ${flow.consoleTitle} (aria-pressed ${flow.consolePressed})`,
      `console warning listed with tone: ${flow.consoleLine}`,
      `line that arrived live, with tone: ${flow.liveLine}`,
      `entry collapsed at first: aria-expanded ${flow.collapsedAtFirst}, after a click: ${flow.expandedOnClick}`,
      `console filters: ${flow.consoleChips}`,
      `filtered to Error (aria-pressed ${flow.pressedChip}): ${flow.filtered}`,
      `filter with no match: ${flow.noMatch}`,
      `clear button: ${flow.clearLabel}`,
      `after clear: ${flow.afterClear}, console entries left in the page: ${flow.clearedInPage}, ` +
      `button disabled: ${flow.clearDisabled}, network entries untouched: ${flow.networkUntouched}`,
      `lines after clear: ${flow.linesAfterClear}, button enabled again: ${flow.clearEnabledAgain}`,
      `network view: ${flow.networkView}, filters: ${flow.networkChips}`,
      `moved by a drag: ${flow.moved}, collapsed: ${flow.collapsedByDrag}`,
      `position remembered: ${flow.remembered !== null}`,
      `review files written: ${files.length}`,
      '',
      written
        .replace(/^ *\[HTTP\] .*\n/gm, '')
        .replace(/^time: .*$/m, 'time: <timestamp>')
        .replace(/^element: .*(?=demo-counter)/m, 'element: ... ')
        .replace(/^rect: \d+x\d+ at \d+,\d+$/m, 'rect: <w>x<h> at <x>,<y>')
        .replaceAll(`:${server.port}`, ':<port>')
        .replaceAll(dir, '<tmp>'),
    ].join('\n')
    await assertSnapshot('preview-review-widget', report)
  } finally {
    await browser.close().catch(() => {})
    await server.stop()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('the review widget edits the applied theme of an app, and the draft survives a reload', async () => {
  const dir = await Deno.makeTempDir()
  await Deno.writeTextFile(join(dir, 'imp.json'), '{ "name": "themed" }\n')
  await Deno.writeTextFile(
    join(dir, 'index.html'),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>themed</title></head>' +
      '<body><div id="app"></div><script type="module" src="/app.js"></script></body></html>\n',
  )
  await Deno.writeTextFile(
    join(dir, 'app.js'),
    "import { init, mount } from 'imp'\nimport { button } from 'imp/std'\n" +
      "await init({ theme: 'imp-light' })\nmount('#app', () => button('hello'))\n",
  )
  const server = await startServer(dir)
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  const browser = await puppeteer.launch({
    executablePath: await resolveBrowser(),
    headless: true,
    args,
  })
  const widgetReady = () => document.getElementById('imp-review')?.shadowRoot
  const primaryToken = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--imp-color-primary').trim()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 700 })
    await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
    await page.waitForFunction(widgetReady)
    const edited = await page.evaluate(async () => {
      const shadow = document.getElementById('imp-review').shadowRoot
      const waitFor = async (description, ready) => {
        const deadline = Date.now() + 10000
        while (!ready()) {
          if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`)
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }
      const token = (name) =>
        getComputedStyle(document.documentElement).getPropertyValue(`--imp-${name}`).trim()
      const labelled = (root, tag, label) => {
        for (const element of root.querySelectorAll('*')) {
          if (
            element.localName === tag &&
            element.shadowRoot?.querySelector('label')?.textContent.trim() === label
          ) {
            return element.shadowRoot.querySelector('input, select, textarea')
          }
          const found = element.shadowRoot ? labelled(element.shadowRoot, tag, label) : null
          if (found) return found
        }
        return null
      }
      const change = (node, value) => {
        node.value = value
        node.dispatchEvent(new Event(node.localName === 'select' ? 'change' : 'input'))
      }
      const steps = { before: token('color-primary') }
      shadow.querySelector('.toggle').click()
      steps.actions = [...shadow.querySelectorAll('.action')]
        .map((button) => button.getAttribute('aria-label')).join(', ')
      shadow.querySelector('[data-action="theme"]').click()
      const probe = document.body.appendChild(document.createElement('div'))
      probe.style.background = 'var(--imp-color-surface)'
      steps.panel = getComputedStyle(shadow.querySelector('.panel')).backgroundColor ===
          getComputedStyle(probe).backgroundColor
        ? `the surface of the theme, ${token('color-surface')}`
        : getComputedStyle(shadow.querySelector('.panel')).backgroundColor
      probe.remove()
      steps.view = [...shadow.querySelectorAll('.view')].find((panel) => !panel.hidden).dataset.view
      steps.pressed = shadow.querySelector('[data-action="theme"]').getAttribute('aria-pressed')
      await waitFor(
        'the theme editor to load',
        () => labelled(shadow.querySelector('.card'), 'imp-code-editor', 'Tokens'),
      )
      steps.editor = shadow.querySelector('.card').firstElementChild.localName
      const knobHosts = []
      const walkKnobs = (root) => {
        for (const element of root.querySelectorAll('*')) {
          const knobNames = ['imp-tabs', 'imp-color-picker', 'imp-combo-box', 'imp-segmented']
          if (knobNames.includes(element.localName)) knobHosts.push(element.localName)
          if (element.shadowRoot) walkKnobs(element.shadowRoot)
        }
      }
      walkKnobs(shadow.querySelector('.card'))
      steps.knobs = knobHosts.length === 0 ? 'none' : knobHosts.join(', ')
      const editor = labelled(shadow.querySelector('.card'), 'imp-code-editor', 'Tokens')
      const shown = JSON.parse(editor.value)
      steps.json = `${Object.keys(shown).length} tokens, primary ${shown['color-primary']}`
      change(
        editor,
        JSON.stringify({ ...shown, 'color-primary': '#0f766e', 'color-surface': '#fff7ed' }),
      )
      steps.jsonSurface = token('color-surface')
      steps.jsonPrimary = token('color-primary')
      change(editor, '{ not json')
      steps.jsonBroken = token('color-surface')
      steps.draftKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith('imp.theme-draft.')
      )
        .join(', ')
      shadow.querySelector('[data-action="theme"]').click()
      steps.closed = shadow.querySelector('.card').childElementCount
      return steps
    })
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(widgetReady)
    await page.waitForFunction(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--imp-color-primary').trim() ===
        '#0f766e'
    )
    const afterReload = await page.evaluate(primaryToken)
    const findResetButton = () => {
      const deep = (root) => {
        for (const element of root.querySelectorAll('*')) {
          if (
            element.localName === 'imp-button' && element.shadowRoot.textContent.trim() === 'reset'
          ) {
            return element
          }
          const found = element.shadowRoot ? deep(element.shadowRoot) : null
          if (found) return found
        }
        return null
      }
      return deep(document.getElementById('imp-review').shadowRoot.querySelector('.card'))
    }
    await page.evaluate(() => {
      const shadow = document.getElementById('imp-review').shadowRoot
      shadow.querySelector('.toggle').click()
      shadow.querySelector('[data-action="theme"]').click()
    })
    const resetButton = await page.waitForFunction(findResetButton)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      resetButton.evaluate((host) => host.shadowRoot.querySelector('button').click()),
    ])
    await page.waitForFunction(widgetReady)
    const afterReset = await page.evaluate(() => ({
      primary: getComputedStyle(document.documentElement).getPropertyValue('--imp-color-primary')
        .trim(),
      draftKeys: Object.keys(localStorage).filter((key) => key.startsWith('imp.theme-draft.'))
        .length,
    }))
    const report = [
      `primary before editing: ${edited.before}`,
      `actions: ${edited.actions}`,
      `view after Theme editor: ${edited.view} (aria-pressed ${edited.pressed})`,
      `panel background: ${edited.panel}`,
      `editor mounted in the panel: ${edited.editor}`,
      `knobs in the panel: ${edited.knobs}`,
      `tokens editor shows: ${edited.json}`,
      `after editing the JSON: surface ${edited.jsonSurface}, primary ${edited.jsonPrimary}`,
      `surface while the JSON is broken: ${edited.jsonBroken}`,
      `draft stored under: ${edited.draftKeys}`,
      `editor removed when closed: ${edited.closed === 0}`,
      `primary after a reload: ${afterReload}`,
      `primary after reset: ${afterReset.primary}, drafts left: ${afterReset.draftKeys}`,
    ].join('\n')
    await assertSnapshot('start-theme-editor-widget', report + '\n')
  } finally {
    await browser.close().catch(() => {})
    await server.stop()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp start warns about missing vendored dependency', async () => {
  const server = await startServer(fixture('with-config'))
  try {
    const banner = normalize(server.banner).replaceAll(`:${server.port}`, ':<port>')
    await assertSnapshot('start-missing-dependency-warning', banner)
  } finally {
    await server.stop()
  }
})

Deno.test('imp start warns about an entry copy in public', async () => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('basic'), dir)
  await Deno.writeTextFile(join(dir, 'public', 'index.html'), '<h1>public copy</h1>\n')
  const server = await startServer(dir)
  try {
    const banner = normalize(server.banner)
      .replaceAll(`:${server.port}`, ':<port>')
      .replaceAll(dir, '<tmp>')
    const served = await (await fetch(`http://localhost:${server.port}/`)).text()
    const source = served.includes('public copy') ? 'public/index.html' : 'index.html'
    await assertSnapshot(
      'start-public-entry-warning',
      `${banner}\nGET / serves ${source}\n`,
    )
  } finally {
    await server.stop()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('injectImp', async () => {
  const headInjection = '<script>imp-injection</script>'
  const cases = [
    ['document with head', '<html>\n<head>\n<title>x</title>\n</head>\n<body></body>\n</html>'],
    ['document without head', '<html>\n<body>no head here</body>\n</html>'],
    ['bare fragment', '<h1>fragment</h1>'],
    [
      'already injected',
      '<html>\n<head><script type="importmap">{"imports":{"imp":"/@imp/imp.js"}}</script></head>\n<body></body>\n</html>',
    ],
  ]
  const transcript = cases
    .map(([label, html]) =>
      `=== ${label} ===\n${section('input', html)}\n${
        section('output', injectImp(html, headInjection))
      }\n`
    )
    .join('\n')
  await assertSnapshot('inject-imp', transcript)
})

Deno.test('resolveWithinRoot', async () => {
  const root = join(await Deno.makeTempDir(), 'app')
  const requests = [
    '/index.html',
    '/sub/page.js',
    '/',
    '/sub/',
    '/.git/config',
    '/.git/HEAD',
    '/node_modules/pkg/index.js',
    '/dist/app.js',
    '/.imp/dev.log',
    '/sub/.git/config',
    '/dependencies/lodash/lodash.js',
    '/.well-known/assetlinks.json',
    '/../outside.txt',
    '/%2e%2e%2fapp-secrets/keys.env',
    '/%2e%2e%2f%2e%2e%2fetc/passwd',
    '/..%2f..%2fetc/passwd',
    '/sub/%2e%2e%2f%2e%2e%2foutside.txt',
    '/%',
  ]
  const transcript = requests
    .map((request) => {
      const within = resolveWithinRoot(root, new URL('http://host' + request).pathname)
      const where = within ? relative(root, within.fsPath).replaceAll('\\', '/') : 'forbidden'
      return `${request.padEnd(36)} ${where}`
    })
    .join('\n') + '\n'
  await assertSnapshot('resolve-within-root', transcript)
})

Deno.test('resolveEnvironment', async () => {
  const dir = await Deno.makeTempDir()
  await Deno.writeTextFile(
    join(dir, 'dev.json'),
    JSON.stringify({ API_URL: 'https://dev.example.com', FEATURE: false }),
  )
  await Deno.writeTextFile(
    join(dir, 'prod.json'),
    JSON.stringify({ API_URL: 'https://api.example.com', TOKEN: '$env.IMP_TEST_TOKEN', COUNT: 3 }),
  )
  await Deno.writeTextFile(join(dir, 'nested.json'), JSON.stringify({ obj: { a: 1 } }))
  await Deno.writeTextFile(join(dir, 'array.json'), JSON.stringify([1, 2]))
  await Deno.writeTextFile(join(dir, 'broken.json'), '{ not json')
  await Deno.writeTextFile(
    join(dir, 'prod.env'),
    [
      '# production values',
      'API_URL=https://api.example.com  # inline comment',
      'export TOKEN=$env.IMP_TEST_TOKEN',
      'GREETING="hello world"',
      "RAW='keep $env.NOT_EXPANDED literal'",
      'FEATURE=true',
      '',
    ].join('\n'),
  )

  const config = {
    environments: {
      dev: 'dev.json',
      prod: 'prod.json',
      default: 'dev.json',
      nested: 'nested.json',
      array: 'array.json',
      broken: 'broken.json',
      missingFile: 'nope.json',
      dotenv: 'prod.env',
    },
  }

  const savedImpEnv = Deno.env.get('IMP_ENV')

  const run = async (
    label,
    { config: cfg = config, requestedAlias = null, impEnv, token } = {},
  ) => {
    if (impEnv === undefined) Deno.env.delete('IMP_ENV')
    else Deno.env.set('IMP_ENV', impEnv)
    if (token === undefined) Deno.env.delete('IMP_TEST_TOKEN')
    else Deno.env.set('IMP_TEST_TOKEN', token)
    let outcome
    try {
      const resolved = await resolveEnvironment({ root: dir, config: cfg, requestedAlias })
      outcome = `ok: ${JSON.stringify(resolved)}`
    } catch (error) {
      outcome = `error: ${error.message}`
    }
    return `=== ${label} ===\n${outcome}\n`
  }

  try {
    const transcript = [
      await run('no selection uses default alias'),
      await run('explicit dev alias', { requestedAlias: 'dev' }),
      await run('explicit prod with token set', { requestedAlias: 'prod', token: 'sekret' }),
      await run('prod with unset shell variable', { requestedAlias: 'prod' }),
      await run('IMP_ENV selects the alias', { impEnv: 'prod', token: 'ci-token' }),
      await run('flag overrides IMP_ENV', { requestedAlias: 'dev', impEnv: 'prod' }),
      await run('unknown alias', { requestedAlias: 'staging' }),
      await run('referenced file missing', { requestedAlias: 'missingFile' }),
      await run('array file rejected', { requestedAlias: 'array' }),
      await run('nested value rejected', { requestedAlias: 'nested' }),
      await run('malformed json rejected', { requestedAlias: 'broken' }),
      await run('dotenv file parsed', { requestedAlias: 'dotenv', token: 'env-token' }),
      await run('no environments block returns empty', { config: {} }),
      await run('environments without default and no selection', {
        config: { environments: { dev: 'dev.json' } },
      }),
      `=== envInjectionScript empty ===\n${JSON.stringify(envInjectionScript({}))}\n`,
      `=== envInjectionScript with values ===\n${envInjectionScript({ API_URL: 'x', N: 1 })}\n`,
    ].join('\n')
    await assertSnapshot('resolve-environment', transcript)
  } finally {
    if (savedImpEnv === undefined) Deno.env.delete('IMP_ENV')
    else Deno.env.set('IMP_ENV', savedImpEnv)
    Deno.env.delete('IMP_TEST_TOKEN')
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build and start with environments', async (t) => {
  const dir = await Deno.makeTempDir()
  await Deno.writeTextFile(
    join(dir, 'index.html'),
    '<!doctype html>\n<html lang="en">\n<head>\n<title>env app</title>\n</head>\n<body>\n<div id="app"></div>\n<script type="module" src="/app.js"></script>\n</body>\n</html>\n',
  )
  await Deno.writeTextFile(
    join(dir, 'app.js'),
    "import { env } from 'imp'\nexport const apiUrl = env.API_URL\n",
  )
  await Deno.mkdir(join(dir, 'env'))
  await Deno.writeTextFile(
    join(dir, 'env', 'dev.json'),
    JSON.stringify({ API_URL: 'https://dev.example.com', FEATURE_ANALYTICS: false }, null, 2),
  )
  await Deno.writeTextFile(
    join(dir, 'env', 'prod.json'),
    JSON.stringify({ API_URL: 'https://api.example.com', TOKEN: '$env.IMP_DEMO_TOKEN' }, null, 2),
  )
  const writeImpJson = (config) =>
    Deno.writeTextFile(join(dir, 'imp.json'), JSON.stringify(config, null, 2) + '\n')
  await writeImpJson({
    environments: { dev: 'env/dev.json', prod: 'env/prod.json', default: 'env/dev.json' },
  })

  const savedToken = Deno.env.get('IMP_DEMO_TOKEN')
  const savedImpEnv = Deno.env.get('IMP_ENV')
  Deno.env.delete('IMP_ENV')

  const mask = (text) => text.replaceAll(dir, '<tmp>').replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')
  const envLine = (html) => html.match(/globalThis\.__IMP_ENV__ = [^<]*/)?.[0] ?? '(none injected)'

  try {
    await t.step('build-default-env', async () => {
      Deno.env.delete('IMP_DEMO_TOKEN')
      const result = await runImp(['build'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      const envFileCopied = await Deno.stat(join(dir, 'dist', 'env', 'dev.json'))
        .then(() => true).catch(() => false)
      await assertSnapshot(
        'env-build-default',
        `${mask(commandTranscript('imp build  (cwd: <tmp>)', result))}\n${
          section('injected env', envLine(html))
        }\n\n[env file copied into dist: ${envFileCopied}]\n`,
      )
    })

    await t.step('build-selected-env-with-secret', async () => {
      Deno.env.set('IMP_DEMO_TOKEN', 'prod-secret')
      const result = await runImp(['build', '--env', 'prod'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      await assertSnapshot(
        'env-build-selected',
        `${mask(commandTranscript('imp build --env prod  (cwd: <tmp>)', result))}\n${
          section('injected env', envLine(html))
        }\n`,
      )
    })

    await t.step('build-missing-shell-variable', async () => {
      Deno.env.delete('IMP_DEMO_TOKEN')
      const result = await runImp(['build', '--env', 'prod'], dir)
      await assertSnapshot(
        'env-build-missing-variable',
        mask(commandTranscript('imp build --env prod  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-unknown-alias', async () => {
      const result = await runImp(['build', '--env', 'staging'], dir)
      await assertSnapshot(
        'env-build-unknown-alias',
        mask(commandTranscript('imp build --env staging  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-invalid-environments-config', async () => {
      await writeImpJson({ environments: 5 })
      const result = await runImp(['build'], dir)
      await writeImpJson({
        environments: { dev: 'env/dev.json', prod: 'env/prod.json', default: 'env/dev.json' },
      })
      await assertSnapshot(
        'env-build-invalid-config',
        mask(commandTranscript('imp build  (cwd: <tmp>)', result)),
      )
    })

    await t.step('start-injects-selected-env', async () => {
      const server = await startServer(dir, ['--env', 'dev'])
      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`)
        const html = await response.text()
        await assertSnapshot('env-start-injected', `${section('injected env', envLine(html))}\n`)
      } finally {
        await server.stop()
      }
    })
  } finally {
    if (savedToken === undefined) Deno.env.delete('IMP_DEMO_TOKEN')
    else Deno.env.set('IMP_DEMO_TOKEN', savedToken)
    if (savedImpEnv === undefined) Deno.env.delete('IMP_ENV')
    else Deno.env.set('IMP_ENV', savedImpEnv)
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build and start with feature flags', async (t) => {
  const dir = await Deno.makeTempDir()
  await Deno.writeTextFile(
    join(dir, 'index.html'),
    '<!doctype html>\n<html lang="en">\n<head>\n<title>flag app</title>\n</head>\n<body>\n<div id="app"></div>\n<script type="module" src="/app.js"></script>\n</body>\n</html>\n',
  )
  await Deno.writeTextFile(
    join(dir, 'checkout.js'),
    "export const newCheckout = () => 'NEW-CHECKOUT-CODE'\n",
  )
  const appSource = [
    "import { env, flag } from 'imp'",
    '',
    "if (flag('CHECKOUT_V2')) {",
    "  const { newCheckout } = await import('./checkout.js')",
    '  console.log(newCheckout())',
    '}',
    "export const nav = flag('NEW_NAV') ? 'NAV-NEXT' : 'NAV-CLASSIC'",
    'export const apiUrl = env.API_URL',
    '',
  ].join('\n')
  const writeApp = (source) => Deno.writeTextFile(join(dir, 'app.js'), source)
  await writeApp(appSource)
  await Deno.mkdir(join(dir, 'env'))
  await Deno.writeTextFile(
    join(dir, 'env', 'dev.json'),
    JSON.stringify({ API_URL: 'https://dev.example.com', CHECKOUT_V2: true, NEW_NAV: true }),
  )
  await Deno.writeTextFile(
    join(dir, 'env', 'prod.json'),
    JSON.stringify({ API_URL: 'https://api.example.com', CHECKOUT_V2: false }),
  )
  await Deno.writeTextFile(join(dir, 'env', 'stage.env'), 'CHECKOUT_V2=false\nNEW_NAV=true\n')
  await Deno.writeTextFile(join(dir, 'env', 'broken.json'), JSON.stringify({ NEW_NAV: 'maybe' }))
  const environments = {
    dev: 'env/dev.json',
    prod: 'env/prod.json',
    stage: 'env/stage.env',
    broken: 'env/broken.json',
  }
  const writeImpJson = (config) =>
    Deno.writeTextFile(join(dir, 'imp.json'), JSON.stringify(config, null, 2) + '\n')
  const withFlags = (flags) => writeImpJson({ flags, environments })
  await withFlags(['CHECKOUT_V2', 'NEW_NAV'])

  const savedImpEnv = Deno.env.get('IMP_ENV')
  Deno.env.delete('IMP_ENV')

  const mask = (text) =>
    text.replaceAll(dir, '<tmp>').replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')
      .replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js')
  const globalsIn = (html) =>
    [...html.matchAll(/globalThis\.__IMP_[A-Z_]+ = [^<]*/g)].map(([line]) => line).join('\n')

  const buildReport = async (alias) => {
    const result = await runImp(['build', '--env', alias], dir)
    const bundle = await Deno.readTextFile(join(dir, 'dist', 'app.js')).catch(() => '')
    const chunks = await Array.fromAsync(Deno.readDir(join(dir, 'dist', 'chunks')))
      .catch(() => [])
    const chunkSources = await Promise.all(
      chunks.map((chunk) => Deno.readTextFile(join(dir, 'dist', 'chunks', chunk.name))),
    )
    const output = [bundle, ...chunkSources].join('\n')
    const html = await Deno.readTextFile(join(dir, 'dist', 'index.html')).catch(() => '')
    return `${mask(commandTranscript(`imp build --env ${alias}  (cwd: <tmp>)`, result))}\n${
      section(
        'folded bundle',
        [
          `gated checkout code shipped: ${output.includes('NEW-CHECKOUT-CODE')}`,
          `split chunk emitted: ${chunks.length > 0}`,
          `nav label: ${output.includes('NAV-NEXT') ? 'NAV-NEXT' : 'NAV-CLASSIC'}`,
          `flag() call left in the output: ${output.includes('__IMP_FLAGS__')}`,
        ].join('\n'),
      )
    }\n\n${section('injected globals', globalsIn(html))}\n`
  }

  try {
    await t.step('build-with-flag-off', async () => {
      await assertSnapshot('flags-build-off', await buildReport('prod'))
    })

    await t.step('build-with-flag-on', async () => {
      await assertSnapshot('flags-build-on', await buildReport('dev'))
    })

    await t.step('build-reads-dotenv-booleans', async () => {
      await assertSnapshot('flags-build-dotenv', await buildReport('stage'))
    })

    await t.step('build-rejects-undeclared-flag', async () => {
      await writeApp("import { flag } from 'imp'\nexport const on = flag('CHEKOUT_V2')\n")
      const result = await runImp(['build', '--env', 'prod'], dir)
      await assertSnapshot(
        'flags-build-undeclared',
        mask(commandTranscript('imp build --env prod  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-rejects-computed-flag-name', async () => {
      await writeApp(
        "import { flag } from 'imp'\nconst name = 'NEW_NAV'\nexport const on = flag(name)\n",
      )
      const result = await runImp(['build', '--env', 'prod'], dir)
      await assertSnapshot(
        'flags-build-computed-name',
        mask(commandTranscript('imp build --env prod  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-refuses-to-ship-an-unfolded-flag', async () => {
      await writeApp(
        'const ready = true; import{flag}from"imp";\nexport const on = ready && flag("NEW_NAV")\n',
      )
      const result = await runImp(['build', '--env', 'prod'], dir)
      await assertSnapshot(
        'flags-build-unfolded',
        mask(commandTranscript('imp build --env prod  (cwd: <tmp>)', result)),
      )
    })

    await t.step('build-rejects-non-boolean-flag-value', async () => {
      await writeApp(appSource)
      const result = await runImp(['build', '--env', 'broken'], dir)
      await assertSnapshot(
        'flags-build-non-boolean',
        mask(commandTranscript('imp build --env broken  (cwd: <tmp>)', result)),
      )
    })

    await t.step('invalid-flags-config', async () => {
      await withFlags('CHECKOUT_V2')
      const listOnly = await runImp(['build', '--env', 'prod'], dir)
      await withFlags(['IMP_BASEPATH'])
      const reserved = await runImp(['build', '--env', 'prod'], dir)
      await withFlags(['CHECKOUT_V2', 'NEW_NAV'])
      await assertSnapshot(
        'flags-invalid-config',
        `${mask(commandTranscript('imp build --env prod  (flags: "CHECKOUT_V2")', listOnly))}\n${
          mask(commandTranscript('imp build --env prod  (flags: ["IMP_BASEPATH"])', reserved))
        }`,
      )
    })

    await t.step('start-injects-flags-and-keeps-them-out-of-env', async () => {
      const server = await startServer(dir, ['--env', 'dev'])
      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`)
        const html = await response.text()
        await assertSnapshot(
          'flags-start-injected',
          `${section('injected globals', globalsIn(html))}\n`,
        )
      } finally {
        await server.stop()
      }
    })
  } finally {
    if (savedImpEnv === undefined) Deno.env.delete('IMP_ENV')
    else Deno.env.set('IMP_ENV', savedImpEnv)
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('bundleDependency keeps bare imp imports external', async () => {
  const dir = await Deno.makeTempDir()
  const entry = join(dir, 'component.js')
  await Deno.writeTextFile(
    entry,
    "import { div } from 'imp/html'\nexport const box = (text) => div(text)\n",
  )
  try {
    const { files, packages, impImports } = await bundleDependency({
      specifier: toFileUrl(entry).href,
      alias: 'component',
    })
    const code = new TextDecoder().decode(files[0].contents)
    const transcript = `${section('files', files.map((file) => file.name).join('\n'))}\n\n${
      section('bundled packages', packages.join('\n'))
    }\n\n${section('imp imports kept bare', impImports.join('\n'))}\n\n${
      section('component.js', code)
    }\n`
    await assertSnapshot('bundle-dependency-imp-external', transcript)
  } finally {
    await shutdownBundler()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp preview slices the call site of every scenario', async () => {
  const source = `import { form, select } from 'imp/std/inputs'
import { luBox, luUser } from 'imp/icons'
import { icon } from 'imp/std'
import * as fixtures from './fixtures.js'
import { mockModule } from 'imp/preview'

export const name = 'Select'
export const group = 'Inputs'
export const description = \`
  Picks one plan.

  - the **free** plan is the default
\`

mockModule('./http.js', ({ spy }) => ({ load: spy(async () => []) }))

const wrap = (...fields) => form({ initialValues: { plan: 'pro' } }, ...fields)
const plans = ['free', 'pro']
const badge = () =>
  icon(luBox, { size: 'sm' })

export const basic = wrap(select({ field: 'plan', label: 'Plan', options: plans }))
export const lazy = () => select({ field: 'plan', options: fixtures.plans, icon: badge() })
export const plain = select({ field: 'plan', label: \`Plan \${plans.length}\` })
export const arrowWithBody = () => {
  const options = plans
  return select({ field: 'plan', options })
}
export function declared() {
  return select({ field: 'plan', options: plans })
}
export const labelled = {
  scenario: 'With a placeholder',
  component: wrap(select({ field: 'plan', placeholder: 'Pick a plan', options: plans })),
}
export const labelledLazy = { scenario: 'Built at render time', component: () => select(plans) }
export const shadowed = () => {
  const plans = ['enterprise']
  return select({ field: 'plan', options: plans })
}
export { luUser as reexported }
`
  const { scenarios, declared, code } = scanPreviewSource(source)
  const report = [
    `scenarios: ${scenarios.join(', ')}`,
    `declared: ${JSON.stringify(declared)}`,
    ...scenarios.map((scenario) => `--- ${scenario}\n${code[scenario] ?? '(no code)'}`),
  ].join('\n')
  await assertSnapshot('preview-source-slices', `${report}\n`)
})

Deno.test('imp preview reads a group as a key of the groups module', () => {
  const module = `import { luBox, luUser } from 'imp/icons'

export const groups = {
  widgets: { name: 'Widgets', icon: luBox },
  people: { icon: luUser, name: "People" },
  unnamed: { icon: luBox },
}
`
  const names = scanGroupsModule(module)
  check(
    JSON.stringify([...names]) === '[["widgets","Widgets"],["people","People"],["unnamed",null]]',
    `group names read from the module: ${JSON.stringify([...names])}`,
  )
  check(scanGroupsModule('export const groups = []') === null, 'an array is not a groups object')

  const keyed = scanPreviewSource(`import { groups } from '../preview-groups.js'
export const group = groups.widgets
export const one = 1
`).declared.group
  check(
    JSON.stringify(keyed) === '{"key":"widgets","specifier":"../preview-groups.js"}',
    `a member expression on an import is a key: ${JSON.stringify(keyed)}`,
  )
  const literal = scanPreviewSource("export const group = 'Widgets'\n").declared.group
  check(
    literal.literal === 'Widgets',
    `a string is reported as a literal: ${JSON.stringify(literal)}`,
  )
  const local = scanPreviewSource('const groups = {}\nexport const group = groups.widgets\n')
    .declared.group
  check(local.specifier === null, `a local object has no specifier: ${JSON.stringify(local)}`)
})

Deno.test('imp preview renders a multiline description as markdown', () => {
  const declared = scanPreviewSource(
    'export const description = `\n  A number.\n\n  - counts up\n`\nexport const one = 1\n',
  ).declared
  check(
    declared.description === 'A number.\n\n- counts up',
    `a template literal is dedented: ${JSON.stringify(declared.description)}`,
  )
  const html = renderDescription(declared.description)
  check(html.includes('<p>A number.</p>'), `a paragraph is rendered: ${html}`)
  check(html.includes('<li>counts up</li>'), `a list is rendered: ${html}`)
  check(
    scanPreviewSource('export const description = `count: ${1}`\n').declared.description ===
      undefined,
    'a template literal with a substitution is ignored',
  )
  check(
    previewIdentity('components/counter.preview.js').description === null,
    'a preview file without a description has none',
  )
})

Deno.test('imp preview renders a sidecar to HTML with its links retargeted', () => {
  const html = renderSkill('# counter - a number\n\nSee [state](state.md) and `demo.count`.\n')
  check(html.includes('<h1>counter - a number</h1>'), `a heading is rendered: ${html}`)
  check(html.includes('state (imp skill state)'), `a subject link is retargeted: ${html}`)
  check(html.includes('<code>demo.count</code>'), `inline code is rendered: ${html}`)
})

Deno.test('imp preview frames a page with the entry file, keeping its head', () => {
  const entry = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>My previews</title>
<link rel="stylesheet" href="/fonts/inter.css">
</head>
<body>
<p>kept</p>
</body>
</html>`
  const page = entryShell(entry, 'imp preview - Widgets / Counter', '<script>preview</script>')
  check(page.includes('<title>imp preview - Widgets / Counter</title>'), 'the title is replaced')
  check(!page.includes('My previews'), 'the original title is gone')
  check(page.includes('<link rel="stylesheet" href="/fonts/inter.css">'), 'the head is kept')
  check(
    page.indexOf('<p>kept</p>') < page.indexOf('<script>preview</script>'),
    'the preview scripts land at the end of the body',
  )
  check(page.trim().endsWith('</html>'), 'the document still closes')

  const bare = entryShell('<html><head></head><body></body></html>', 't', '<script></script>')
  check(bare.includes('<head>\n<title>t</title>'), 'a missing title is added to the head')
  check(
    bare.includes('<body>\n<script></script>\n</body>'),
    'the scripts sit alone before the body close',
  )
})

Deno.test('a derived theme puts white text on a saturated primary and dark text on a pale one', () => {
  const onPrimary = (primary) =>
    buildTokens({ ...THEME_DEFAULTS, primary, mode: 'light' })['color-on-primary']
  check(onPrimary('#ef4444') === '#ffffff', 'a saturated red gets white text')
  check(onPrimary('#ea580c') === '#ffffff', 'a saturated orange gets white text')
  check(onPrimary('#f59e0b') !== '#ffffff', 'a pale amber gets dark text')
  check(onPrimary('#0ea5e9') !== '#ffffff', 'a pale sky blue gets dark text')
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
    theme.tokens['color-primary'] === '#3b6fe0',
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
  const dir = await Deno.makeTempDir()
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
  return normalizePath(config.preview.groups)
}

Deno.test('a library preview imports imp through its entry points only', async () => {
  const problems = []
  const groupsModule = await libraryGroupsModule()
  for (const { path, source } of await libraryPreviews()) {
    for (const [index, line] of source.split('\n').entries()) {
      const relativeImport = line.match(RELATIVE_IMPORT)?.[1]
      if (relativeImport && normalize(join(dirname(path), relativeImport)) === groupsModule) {
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
  const dir = await Deno.makeTempDir()
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

Deno.test('imp skill', async (t) => {
  await t.step('every skills page is registered as a subject', async () => {
    const pages = []
    for await (const entry of Deno.readDir(join(REPO_ROOT, 'skills'))) {
      if (entry.isFile && entry.name.endsWith('.md')) pages.push(entry.name)
    }
    const registered = SKILLS.map((skill) => `${skill.name}.md`)
    for (const page of pages) {
      check(
        registered.includes(page),
        `skills/${page} has no subject in cli/src/skill.js - a page is named after its subject`,
      )
    }
    for (const file of registered) {
      check(pages.includes(file), `subject points at a missing skills/${file}`)
    }
  })

  await t.step('every subject prints its manual out of the binary', async () => {
    for (const skill of SKILLS) {
      const { code, stdout, stderr } = await runImp(['skill', skill.name])
      check(code === 0, `imp skill ${skill.name} exited ${code}: ${stderr}`)
      check(stderr === '', `imp skill ${skill.name} wrote to stderr: ${stderr}`)
      check(
        stdout.startsWith(`imp skill: ${skill.name} - ${skill.summary}`),
        `imp skill ${skill.name} is missing its banner`,
      )
      check(stdout.split('\n').length > 20, `imp skill ${skill.name} printed no manual`)
      const danglingLink = stdout.match(/\]\([\w-]+\.md[^)]*\)/)
      check(
        danglingLink === null,
        `imp skill ${skill.name} still links to a markdown file: ${danglingLink?.[0]}`,
      )
    }
  })

  await t.step('every std component is derived from the barrels with a skill file', async () => {
    const derived = await standardComponentSubjects()
    const exported = Object.entries(IMP_MODULE_EXPORTS)
      .filter(([specifier]) => specifier.startsWith('imp/std'))
      .flatMap(([, module]) => Object.keys(module))
    check(exported.length > 0, 'no std components found in the barrels')
    for (const name of exported) {
      const subject = derived.find((component) => component.name === `std/${name}`)
      check(subject !== undefined, `std/${name} is exported by imp/std but was not derived`)
      const exists = await Deno.stat(subject.url).then(() => true).catch(() => false)
      check(exists, `missing ${subject.url} - every std component ships a skill file`)
    }
    for (const { name } of derived) {
      const exportName = name.slice('std/'.length)
      check(
        exported.includes(exportName),
        `${name} was derived but imp/std exports no ${exportName}`,
      )
    }
  })

  await t.step(
    'a std folder is one group: its import, its preview group and its previews',
    async () => {
      const stdRoot = new URL('../../lib/src/std/', import.meta.url)
      const groupKeys = scanGroupsModule(
        await Deno.readTextFile(new URL('preview-groups.js', stdRoot)),
      )
      const folders = []
      for await (const entry of Deno.readDir(stdRoot)) {
        if (entry.isDirectory && entry.name !== 'shared' && !entry.name.startsWith('.')) {
          folders.push(entry.name)
        }
      }
      for (const key of groupKeys.keys()) {
        check(folders.includes(key), `preview group '${key}' has no lib/src/std/${key} folder`)
      }
      for (const folder of folders) {
        check(groupKeys.has(folder), `lib/src/std/${folder} has no preview group named '${folder}'`)
        const specifier = folder === 'general' ? 'imp/std' : `imp/std/${folder}`
        const barrel = IMP_MODULES[specifier]
        check(barrel !== undefined, `${specifier} is not a registered barrel`)
        const barrelSource = await Deno.readTextFile(new URL(`../${barrel}`, stdRoot))
        check(
          barrel === `std/${folder}/index.js` || barrelSource.includes(`'./${folder}/index.js'`),
          `${specifier} does not export lib/src/std/${folder}`,
        )
        for await (const file of Deno.readDir(new URL(`${folder}/`, stdRoot))) {
          if (!file.name.endsWith('.preview.js')) continue
          const source = await Deno.readTextFile(new URL(`${folder}/${file.name}`, stdRoot))
          const declared = source.match(/export const group = groups\.(\w+)/)?.[1]
          check(
            declared === folder,
            `lib/src/std/${folder}/${file.name} names group '${declared}', not '${folder}'`,
          )
        }
      }
    },
  )

  await t.step('a std component prints its skill file verbatim', async () => {
    for (const component of await standardComponentSubjects()) {
      const source = (await Deno.readTextFile(component.url)).trimEnd()
      const { code, stdout } = await runImp(['skill', component.name])
      check(code === 0, `imp skill ${component.name} exited ${code}`)
      check(
        stdout.trimEnd() === source,
        `imp skill ${component.name} did not print ${component.url}`,
      )
    }
  })

  await t.step('subjects resolve by alias, specifier and file name', async () => {
    const resolves = async (subject) => (await findSkill(subject))?.name ?? null
    for (const skill of SKILLS) {
      for (const alias of [skill.name, ...skill.aliases]) {
        check(await resolves(alias) === skill.name, `'${alias}' does not resolve to ${skill.name}`)
      }
    }
    check(await resolves('imp/State') === 'state', 'subject lookup is not case-insensitive')
    check(await resolves('state.md') === 'state', 'a docs file name does not resolve')
    check(await resolves('button') === 'std/button', "'button' does not resolve to std/button")
    check(
      await resolves('imp/std/emptyState') === 'std/emptyState',
      'an imp/std specifier does not resolve to its component',
    )
    check(await resolves('bogus') === null, 'an unknown subject resolved to something')
  })

  await t.step('the index lists every subject once', async () => {
    const index = await skillIndex()
    for (const skill of [...SKILLS, ...await standardComponentSubjects()]) {
      const lines = index.split('\n').filter((line) => line.startsWith(`  ${skill.name} `))
      check(lines.length === 1, `${skill.name} appears ${lines.length} times in the index`)
    }
  })

  await t.step('the index lists the components of the project it runs in', async () => {
    const { stdout } = await runImp(['skill'], fixture('skill-project'))
    check(stdout.includes('THIS PROJECT'), 'the index has no project section')
    check(
      /\n {2}\.\/counter\.js\s+counter - a self-contained/.test(stdout),
      'the project component is missing from the index',
    )
    check(
      stdout.includes('read: imp skill ./path/to/component.js'),
      'the index does not say how to read a component by path',
    )
    check(
      stdout.includes('imp skill std/button'),
      'the index does not say how to read a standard component',
    )
  })

  await t.step('a project with no skill files still explains the convention', async () => {
    const { stdout } = await runImp(['skill'], fixture('basic'))
    check(stdout.includes('THIS PROJECT'), 'the project section is missing when nothing is found')
    check(stdout.includes('counter.skill.md'), 'the empty project section names no file to write')
  })
})
