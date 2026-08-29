import { dirname, fromFileUrl, join, relative, toFileUrl } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { clientScript } from '../src/client.js'
import { createMockBundler } from '../src/mocks.js'
import { BINARY_ASSET_EXTENSIONS, bundleDependency, shutdownBundler } from '../src/deps.js'
import { CONTENT_TYPES, injectImp, resolveWithinRoot } from '../src/start.js'
import { envInjectionScript, resolveEnvironment } from '../src/environments.js'
import { defaultAlias, parseSpecifier } from '../src/specifiers.js'
import { formatReview, isLocalRequest, reviewFileName } from '../src/review.js'
import { tokenizeJs } from '../src/preview_highlight.js'
import { themeFileSource } from '../src/preview_theme_source.js'
import { findSkill, skillIndex, SKILLS, standardComponentSubjects } from '../src/skill.js'
import impPlugin, { IMP_MODULE_EXPORTS } from '../src/lint_rules.js'
import { MAX_FILE_SIZE_RULE } from '../src/lint.js'
import { IMP_MODULES, IMP_TOOLING_MODULES } from '../src/specifiers.js'
import { defaultTokens } from '../../lib/src/theme.js'
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

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, 'g')

const normalize = (text) =>
  text.replaceAll(ANSI, '').replaceAll(ROOT, '<root>/').replaceAll(VERSION, '<version>')
    .replace(/\b\d+ms\b/g, '*ms')
    .replace(/time="[\d.]+"/g, 'time="*"')
    .replace(/"durationMs": \d+/g, '"durationMs": *')

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
  await test('lint-clean', ['lint', 'app.js'], fixture('with-config'))
  await test('lint-vendored-imports', ['lint', 'app.js'], fixture('basic'))
  await test('lint-capital-component', ['lint', 'components.js'], fixture('lint-bad'))
  await test('lint-multiple-props-objects', ['lint', 'app.js'], fixture('lint-props'))
  await test('lint-state-name-namespace', ['lint', 'app.js'], fixture('lint-state'))
  await test('lint-state-setup-before-await', ['lint', 'app.js'], fixture('lint-state-async'))
  await test('lint-http-client-setup', ['lint', 'app.js'], fixture('lint-http-client'))
  await test('lint-router-setup-before-await', ['lint', 'app.js'], fixture('lint-router-async'))
  await test('lint-no-root-query-in-mount', ['lint', 'app.js'], fixture('lint-root-query'))
  await test('lint-component-name', ['lint', 'app.js'], fixture('lint-component'))
  await test('lint-import-source', ['lint', 'app.js'], fixture('lint-import-source'))
  await test('lint-html-embedded-script', ['lint', 'index.html'], fixture('lint-html'))
  await test('lint-dependency-errors', ['lint', 'app.js'], fixture('lint-unpinned'))
  await test('lint-imports-removed', ['lint', 'app.js'], fixture('legacy-imports'))
  await test('lint-ignore-directive', ['lint', 'app.js'], fixture('lint-ignore'))
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
      return `${name}: ${isPng ? 'PNG' : 'NOT PNG'} ${width}×${height}`
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

  const withoutDownloadNoise = (result) => ({
    ...result,
    stderr: result.stderr
      .split('\n')
      .filter((line) => !/^Download(ing)? /.test(line))
      .join('\n'),
  })

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
  await test('preview-bad-port', ['preview', '--port', 'abc'], fixture('preview'))
})

const isTelemetryLine = (line) => line.startsWith('[BROWSER:') || line.startsWith('[HTTP]')

const withoutTelemetry = (result) => ({
  ...result,
  stdout: result.stdout.split('\n').filter((line) => !isTelemetryLine(line)).join('\n'),
})

const localBrowser = await (async () => {
  const { findCachedBrowser, findSystemBrowser } = await import('../src/test_browser.js')
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
        "import { table } from 'imp/std/data'\n\nexport const shell = table\n",
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
          }\n[bundle defines the element: ${code.includes('imp-button')}]\n\n${
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
      const maskOutdir = (text) => text.replace(/→ \.\.[/\\]\S+[/\\]/g, '→ <component-out>/')
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
        normalize(body.replace(clientScript({ mocks: false }), '\n[imp client script]\n')),
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
        (await response.text()).replace(clientScript({ mocks: false }), '\n[imp client script]\n'),
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

function runServiceWorker(source) {
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
    return Promise.resolve(
      new Response('from the network', { headers: { 'content-type': 'text/plain' } }),
    )
  }
  new Function('self', 'fetch', source)(scope, network)

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
      return `${init?.method ?? 'GET'} ${path} → ${response.status} ${type} ${await response
        .text()}${slow}`
    } catch (error) {
      return `${init?.method ?? 'GET'} ${path} → rejected: ${error.message}`
    }
  }

  return { registered: scope.__impMocks.map((entry) => entry.source), send, telemetry }
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
        (await response.text()).replace(clientScript({ mocks: true }), '\n[imp client script]\n'),
      )
      await assertSnapshot(
        'start-mocks-injected-html',
        responseTranscript('/', response, html),
      )
    })

    await t.step('start-mocks-service-worker', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/@imp/sw.js`)
      const worker = runServiceWorker(await response.text())
      const transcript = [
        ...worker.registered,
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
      ]
      await assertSnapshot(
        'start-mocks-service-worker',
        `${section('registered mocks and what they answer', transcript.join('\n'))}\n`,
      )
    })
  } finally {
    await server.stop()
  }
})

const mockedRequest = async (port) => {
  const worker = runServiceWorker(
    await (await fetch(`http://127.0.0.1:${port}/@imp/sw.js`)).text(),
  )
  return `${worker.registered.length} mock(s) registered · ${await worker.send('/api/users')}`
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
      lines.push(`${run.label} → ${await mockedRequest(server.port)}`)
    } finally {
      await server.stop()
    }
  }
  await Deno.remove(disabled, { recursive: true })

  await t.step('mocks-flag-decides', async () => {
    await assertSnapshot('mocks-flag-decides', `${section('imp start', lines.join('\n'))}\n`)
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

Deno.test('mock bundling reports a file it cannot build', async () => {
  const root = await Deno.makeTempDir()
  const directory = join(root, 'mocks')
  await Deno.mkdir(directory)
  await Deno.writeTextFile(join(directory, 'broken.mock.js'), 'export const mocks = [\n')
  const build = createMockBundler({ root, directory })
  const broken = await build()
  await Deno.writeTextFile(
    join(directory, 'broken.mock.js'),
    'export const mocks = [{ match: () => true, handler: () => ({ body: "ok" }) }]\n',
  )
  const repaired = await build()
  const missing = await createMockBundler({ root, directory: join(root, 'absent') })()
  await Deno.remove(root, { recursive: true })

  await assertSnapshot(
    'mocks-build-problem',
    [
      `broken: ${broken.problem}`,
      `repaired: ${repaired.problem} (${repaired.files.length} file, changed: ${repaired.changed})`,
      `missing directory: ${missing.problem}`,
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

    await get('preview-index', '/', {
      maskBody: (body) =>
        normalize(body.replace(clientScript({ mocks: false }), '\n[imp client script]\n')),
    })
    await get('preview-page', '/preview/components/counter.preview.js', {
      maskBody: (body) =>
        normalize(body.replace(clientScript({ mocks: false }), '\n[imp client script]\n')),
    })
    await get('preview-unknown-page', '/preview/components/missing.preview.js')
    await get('preview-bundle', '/@imp/preview/components/todos.preview.js', {
      maskBody: (body) =>
        [
          `[preview bundle: ${body.length > 10000 ? 'imp library inlined' : 'unexpectedly small'}]`,
          `defines the component: ${/component\(["']demo-todos["']/.test(body)}`,
          `mocked fixture inlined: ${body.includes('Buy milk')}`,
          `real http.js excluded: ${!body.includes("fetch('/api/todos')")}`,
          `starts the preview chrome: ${body.includes('startPreview(scenarios')}`,
        ].join('\n'),
    })
  } finally {
    await server.stop()
  }
})

Deno.test('imp preview renders scenarios in a browser', async () => {
  const server = await startPreviewServer(fixture('preview'))
  const { resolveBrowser } = await import('../src/test_browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer_core.js')
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
      globalThis.addEventListener('error', (event) => {
        if (String(event.message).includes('ResizeObserver loop')) globalThis.impResizeLoops++
      })
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
      globalThis.impScenarios = () => globalThis.impAll('imp-preview-scenario')
      globalThis.impPicker = (label) =>
        globalThis.impAll('imp-select')
          .map((host) => host.shadowRoot.querySelector('select'))
          .find((control) => control.getAttribute('aria-label') === label)
      globalThis.impTextareas = (editor) =>
        [...editor.shadowRoot.querySelectorAll('imp-text-area')]
          .map((host) => host.shadowRoot.querySelector('textarea'))
    })
    await page.goto(`${base}/preview/components/counter.preview.js`, { waitUntil: 'load' })
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
          return `${editor.shadowRoot.querySelector('.name').textContent}=${
            globalThis.impTextareas(editor)[0].value
          }`
        }),
        tabs: [
          ...globalThis.impOne('imp-tabs', scenarios[0]).shadowRoot
            .querySelectorAll('[role="tab"]'),
        ].map((tab) => tab.textContent),
        handles: globalThis.impOne('imp-preview-stage', scenarios[0])
          .shadowRoot.querySelectorAll('.handle').length,
      }
    })
    const coded = await page.evaluate(() => {
      const scenario = globalThis.impScenarios()[0]
      const strip = globalThis.impOne('imp-tabs', scenario).shadowRoot
      strip.querySelectorAll('[role="tab"]')[1].click()
      const panels = [...strip.querySelectorAll('[role="tabpanel"]')]
      const pre = globalThis.impOne('imp-preview-code', scenario).shadowRoot.querySelector('pre')
      return {
        selected: [...strip.querySelectorAll('[role="tab"]')]
          .map((tab) => tab.getAttribute('aria-selected')).join('/'),
        shown: panels.map((panel) => (panel.hidden ? 'hidden' : 'shown')).join('/'),
        source: pre.textContent,
        highlighted: [...pre.querySelectorAll('span')]
          .map((token) => `${token.classList[1].replace('token--', '')}:${token.textContent}`)
          .join(' '),
      }
    })
    const agent = await page.evaluate(() => {
      const head = globalThis.impOne('imp-preview-head').shadowRoot
      return {
        strips: globalThis.impAll('imp-preview-head').length,
        region: head.querySelector('.agent').getAttribute('aria-label'),
        instruction: head.querySelector('.instruction').textContent,
      }
    })
    const edited = await page.evaluate(() => {
      const scenario = globalThis.impScenarios()[0]
      const strip = globalThis.impOne('imp-tabs', scenario).shadowRoot
      strip.querySelectorAll('[role="tab"]')[0].click()
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
      const directions = globalThis.impPicker('Text direction')
      const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
      const stage = () => globalThis.impOne('imp-preview-stage').shadowRoot.querySelector('.stage')
      const pick = async (picker, value) => {
        picker.value = value
        picker.dispatchEvent(new Event('change'))
        await settle()
        return `${document.documentElement.lang}/${document.documentElement.dir}/${stage().dir}`
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
        directions: [...directions.options].map((option) => option.value),
        english: words(),
        polish: await pick(languages, 'pl') && words(),
        arabic: await pick(languages, 'ar'),
        arabicWords: words(),
        arabicChrome: chrome(),
        pinnedLtr: await pick(directions, 'ltr'),
        backToAuto: await pick(directions, 'auto'),
        backToEnglish: await pick(languages, 'en'),
      }
    })

    const themed = await page.evaluate(() => {
      const picker = globalThis.impPicker('Theme')
      const apply = (value) => {
        picker.value = value
        picker.dispatchEvent(new Event('change'))
        return getComputedStyle(document.documentElement).getPropertyValue('--imp-color-surface')
      }
      return {
        options: [...picker.options].map((option) => option.value),
        selected: picker.value,
        dark: apply('imp-dark'),
        custom: apply('brand'),
      }
    })

    const themeEdits = await page.evaluate(async () => {
      const open = globalThis.impAll('imp-button')
        .find((node) => node.shadowRoot.textContent.includes('edit theme'))
      open.shadowRoot.querySelector('button').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
      const panel = globalThis.impOne('imp-preview-theme').shadowRoot
      const field = (id) => panel.querySelector(`#${id}`)
      const token = (name) =>
        getComputedStyle(document.documentElement).getPropertyValue(`--imp-${name}`).trim()
      const change = (node, value) => {
        node.value = value
        node.dispatchEvent(new Event(node.localName === 'select' ? 'change' : 'input'))
      }
      const knobs = [...panel.querySelectorAll('.field > label')].map((node) => node.textContent)
      change(field('theme-primary'), '#8821ac')
      const primary = token('color-primary')
      const derived = token('color-primary-hover')
      change(field('theme-radius'), 'none')
      const flat = token('radius-md')
      change(field('theme-mode'), 'dark')
      const darkSurface = token('color-surface')
      return {
        knobs: knobs.join(', '),
        primary,
        derived,
        flat,
        darkSurface,
        usage: panel.querySelector('.usage pre').textContent.split('\n')[0],
      }
    })

    const shell = await page.evaluate(() => {
      const menu = globalThis.impOne('imp-nav-menu').shadowRoot
      const links = [...menu.querySelectorAll('.link')]
      const deepText = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.data
        const scope = node.shadowRoot ?? node
        return [...scope.childNodes].map(deepText).join('')
      }
      const parts = (node) => [...node.childNodes].map(deepText).join(' ')
      return {
        sidebar: links.map((link) => link.textContent).join(', '),
        groups: [...menu.querySelectorAll('.group-title')].map(parts).join(', '),
        current: links.find((link) => link.hasAttribute('aria-current'))?.textContent ?? 'none',
        head: globalThis.impOne('imp-preview-head').shadowRoot.querySelector('.path').textContent,
      }
    })

    await page.goto(`${base}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => globalThis.impOne('imp-preview-index'))
    const index = await page.evaluate(() => {
      const root = globalThis.impOne('imp-preview-index').shadowRoot
      const hero = root.querySelector('.hero')
      const rendered = (name) => globalThis.impOne(name, hero).shadowRoot.textContent.trim()
      return {
        headline: `${rendered('imp-heading')} - ${rendered('imp-text')}`,
        cards: [...root.querySelectorAll('.card-head')]
          .map((head) => [...head.childNodes].map((child) => child.textContent).join(' '))
          .join(' · '),
      }
    })

    await page.goto(`${base}/preview/components/counter.preview.js?scenario=lazy`, {
      waitUntil: 'load',
    })
    await page.waitForFunction(() =>
      globalThis.impRoot() && globalThis.impOne('demo-counter')?.shadowRoot?.children
    )
    const isolated = await page.evaluate(() => ({
      panels: globalThis.impScenarios().length,
      name: globalThis.impScenarios()[0].shadowRoot.querySelector('h2').textContent,
    }))

    await page.goto(`${base}/preview/components/todos.preview.js`, { waitUntil: 'load' })
    await page.waitForFunction(() =>
      globalThis.impRoot() &&
      globalThis.impOne('demo-todos')?.shadowRoot?.querySelectorAll('.todo').length === 2
    )
    const todos = await page.evaluate(() => ({
      items: [...globalThis.impOne('demo-todos').shadowRoot.querySelectorAll('.todo')]
        .map((item) => item.textContent),
      state: globalThis.impOne('imp-preview-state').shadowRoot.querySelector('.name').textContent,
      agent: globalThis.impOne('imp-preview-head').shadowRoot.querySelector('.missing').textContent,
    }))

    const resizeLoops = await page.evaluate(() => globalThis.impResizeLoops)
    check(
      resizeLoops === 0,
      `the preview chrome drove ${resizeLoops} ResizeObserver feedback loops - something read a ` +
        'size and then wrote layout that changes it',
    )

    const readout = await page.evaluate(() => {
      const stage = globalThis.impOne('imp-preview-stage').shadowRoot
      const node = stage.querySelector('.readout')
      const restore = node.textContent
      const widthShowing = (text) => {
        node.textContent = text
        return node.getBoundingClientRect().width
      }
      const result = { narrow: widthShowing('1 × 1'), wide: widthShowing('1280 × 800') }
      node.textContent = restore
      return result
    })
    check(
      readout.narrow === readout.wide,
      'the stage size readout resizes with its own text (' +
        `${readout.narrow} vs ${readout.wide}px) - a ResizeObserver writes that text, so its ` +
        'width must not depend on it or measuring the stage changes the stage',
    )

    const report = [
      `scenarios: ${counter.names.join(', ')}`,
      `rendered values: ${counter.rendered.join(', ')}`,
      `state rows: ${counter.states.join(', ')}`,
      `tabs per scenario: ${counter.tabs.join(', ')}`,
      `resize handles per stage: ${counter.handles}`,
      `after picking the code tab: ${coded.selected} (panels ${coded.shown})`,
      `code shown for zero:\n${coded.source.trimEnd()}`,
      `highlighted tokens for zero: ${coded.highlighted}`,
      `agent instruction strips on the page: ${agent.strips} (region '${agent.region}')`,
      `agent instruction: ${agent.instruction}`,
      `after setting demo.count to 42: ${edited}`,
      `invalid JSON rejected: ${rejected}`,
      `language options: ${localized.languages.join(', ')}`,
      `direction options: ${localized.directions.join(', ')}`,
      `app + imp words in en: ${localized.english}`,
      `app + imp words in pl: ${localized.polish}`,
      `app + imp words in ar: ${localized.arabicWords}`,
      `lang/dir/stage after picking ar: ${localized.arabic}`,
      `chrome direction while previewing ar: ${localized.arabicChrome}`,
      `lang/dir/stage after pinning ltr: ${localized.pinnedLtr}`,
      `lang/dir/stage back on auto: ${localized.backToAuto}`,
      `lang/dir/stage back on en: ${localized.backToEnglish}`,
      `theme options: ${themed.options.join(', ')} (selected ${themed.selected})`,
      `imp-dark surface token: ${themed.dark}`,
      `brand surface token: ${themed.custom}`,
      `theme editor knobs: ${themeEdits.knobs}`,
      `after picking a primary: ${themeEdits.primary} (hover ${themeEdits.derived})`,
      `after picking radius none: ${themeEdits.flat}`,
      `after switching the editor to dark: ${themeEdits.darkSurface}`,
      `theme editor usage line: ${themeEdits.usage}`,
      `sidebar groups: ${shell.groups}`,
      `sidebar components: ${shell.sidebar}`,
      `sidebar current: ${shell.current}`,
      `page head: ${shell.head}`,
      `index headline: ${index.headline}`,
      `index cards: ${index.cards}`,
      `?scenario=lazy panels: ${isolated.panels} (${isolated.name})`,
      `mocked todos: ${todos.items.join(', ')}`,
      `mocked todos state row: ${todos.state}`,
      `agent instruction without a description: ${todos.agent}`,
    ].join('\n')
    await assertSnapshot('preview-browser', `${report}\n`)
  } finally {
    await browser.close().catch(() => {})
    await server.stop()
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
  const { resolveBrowser } = await import('../src/test_browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer_core.js')
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
      `http://localhost:${server.port}/preview/components/counter.preview.js`,
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
      const steps = { hiddenAtFirst: shadow.querySelector('.panel').hidden }
      shadow.querySelector('.toggle').click()
      steps.openedView = view()
      steps.expanded = shadow.querySelector('.toggle').getAttribute('aria-expanded')
      shadow.querySelector('[data-action="pick"]').click()
      await new Promise((resolve) => setTimeout(resolve, 100))
      steps.pickingView = view()
      const target = deep(document, 'demo-counter').shadowRoot.querySelector('#value')
      target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }))
      steps.highlighted = !outline().hidden
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
      steps.commentingView = view()
      steps.outlineKept = !outline().hidden
      steps.locatorShown = shadow.textContent.includes('>>')
      const field = shadow.querySelector('textarea')
      field.value = 'The value is cut off below 320px.'
      shadow.querySelector('[data-action="save"]').click()
      await new Promise((resolve) => setTimeout(resolve, 300))
      steps.status = shadow.querySelector('.status').textContent
      steps.viewAfterSaving = view()
      steps.outlineGone = outline().hidden
      return steps
    })
    const files = []
    for await (const entry of Deno.readDir(join(dir, '.imp', 'reviews'))) files.push(entry.name)
    const written = await Deno.readTextFile(join(dir, '.imp', 'reviews', files[0]))
    const report = [
      `panel hidden before the toggle: ${flow.hiddenAtFirst}`,
      `view after opening it: ${flow.openedView} (aria-expanded ${flow.expanded})`,
      `view after Add review: ${flow.pickingView}`,
      `element highlighted on hover: ${flow.highlighted}`,
      `view after clicking the element: ${flow.commentingView}`,
      `picked element stays outlined while commenting: ${flow.outlineKept}`,
      `element locator shown to the reviewer: ${flow.locatorShown}`,
      `view after saving: ${flow.viewAfterSaving}`,
      `outline cleared after saving: ${flow.outlineGone}`,
      `status after saving: ${flow.status.replace(/[\d-]+T[\d-]+Z/, '<timestamp>')}`,
      `review files written: ${files.length}`,
      '',
      written
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

Deno.test('the theme editor exports a theme file that imports back as two themes', async () => {
  const draft = {
    mode: 'light',
    radius: 'large',
    shadow: 'strong',
    light: { primary: '#3b6fe0', secondary: '#6b7280' },
    dark: { primary: '#7c9cff', secondary: '#94a3b8' },
  }
  const source = themeFileSource('acme', draft)
  const module = await import(`data:text/javascript,${encodeURIComponent(source)}`)

  check(module.default === module.light, 'the default export is the light theme')
  check(module.light.colorScheme === 'light', 'the light theme declares its colour scheme')
  check(module.dark.colorScheme === 'dark', 'the dark theme declares its colour scheme')
  check(module.light.name === 'acme-light', `unexpected theme name ${module.light.name}`)

  for (const theme of [module.light, module.dark]) {
    const missing = Object.keys(defaultTokens()).filter((name) => !(name in theme.tokens))
    check(missing.length === 0, `the exported theme omits ${missing.join(', ')}`)
  }

  check(
    module.light.tokens['color-primary'] === '#3b6fe0',
    'the light theme carries the primary the editor was given',
  )
  check(
    module.dark.tokens['color-primary'] === '#7c9cff',
    'the dark theme carries its own primary',
  )
  check(
    module.light.tokens['color-green'] === module.dark.tokens['color-green'],
    'both themes share one palette block',
  )
  check(
    module.light.tokens['color-success'] === module.light.tokens['color-green'],
    'the semantic aliases point at the palette, so editing a hue moves the role',
  )
  check(
    module.light.tokens['radius-md'] === '10px' && module.light.tokens['shadow-md'] !== 'none',
    'the radius and shadow steps reach the exported tokens',
  )
  check(
    !source.includes("from 'imp"),
    'the exported theme file imports nothing from imp',
  )
})

Deno.test('tokenizeJs', async () => {
  const sources = [
    "import { button } from 'imp/std'\n\nexport const primary = () => button({ variant: 'primary' }, t('Save'))\n",
    'const label = `${count} of ${total} - ${done ? `${done} done` : "none"}`\n',
    '// a line comment\n/* a block\n   comment */\nconst rate = 0.5e3 + 0xff + 12_000n\n',
    'const clean = value.replace(/[a-z/]+/gi, "") / total\n',
    'const flags = { on: true, off: false, missing: null, unset: undefined }\n',
  ]
  const transcript = sources
    .map((source) => {
      const tokens = tokenizeJs(source)
      const roundTrips = tokens.map(({ text }) => text).join('') === source
      const body = tokens
        .map(({ kind, text }) => `  ${kind}: ${JSON.stringify(text)}`)
        .join('\n')
      return `=== ${JSON.stringify(source)} ===\nround-trips: ${roundTrips}\n${body}`
    })
    .join('\n\n')
  await assertSnapshot('tokenize-js', transcript + '\n')
})

Deno.test('the prose export tables match what imp really exports', async () => {
  const pages = [
    'skills/imports.md',
    'skills/std.md',
    'docs/imports.md',
    'docs/std-components.md',
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
      if (body.includes('…') || body.includes('...')) continue
      for (const name of exported) {
        if (!listed.includes(name)) {
          report(`exports '${name}', which the table omits - list it, or mark the list with '…'`)
        }
        if (skillSubjects.length && !skillSubjects.includes(name)) {
          report(`exports '${name}', which the skill column omits`)
        }
      }
    }
  }

  const stdGroups = Object.keys(IMP_MODULE_EXPORTS).filter((name) => name.startsWith('imp/std'))
  for (const page of ['skills/std.md', 'docs/std-components.md']) {
    for (const group of stdGroups) {
      if (!tabulated.get(page).includes(group)) {
        problems.push(`${page}: '${group}' has no row - every std group is listed on this page`)
      }
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
  const ruleNames = Object.keys(impPlugin.rules).map((name) => `imp/${name}`)
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
        `'${specifier}' resolves but cli/src/lint_rules.js imports no module for it - import-source would not cover it`,
      )
    }
  }
  for (const specifier of linted) {
    if (!resolved.includes(specifier)) {
      throw new Error(`cli/src/lint_rules.js lists '${specifier}', which imp does not resolve`)
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
      return `'${input}' → ${JSON.stringify(parsed)}${alias}`
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
