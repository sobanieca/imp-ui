import { dirname, fromFileUrl, join, toFileUrl } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { clientScript } from '../src/client.js'
import { createMockBundler } from '../src/mocks.js'
import { bundleDependency, shutdownBundler } from '../src/deps.js'
import { injectImp } from '../src/start.js'
import { envInjectionScript, resolveEnvironment } from '../src/environments.js'
import { defaultAlias, parseSpecifier } from '../src/specifiers.js'
import { COMPONENT_SKILLS, findSkill, skillFileFor, skillIndex, SKILLS } from '../src/skill.js'
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
    const copy = await runImp(['resize', 'logo.png', '-h', '30', '--out', 'small.png'], dir)
    const boxFit = await runImp(
      ['resize', 'logo.png', '-w', '100', '-h', '100', '--out', 'box.png'],
      dir,
    )
    const stretched = await runImp(
      ['resize', 'logo.png', '-w', '100', '-h', '100', '--stretch', '--out', 'stretched.png'],
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
        `${commandTranscript('imp resize logo.png -h 30 --out small.png  (cwd: <tmp>)', copy)}\n` +
        `--- sibling output ---\n${sibling}\n\n` +
        `${
          commandTranscript('imp resize logo.png -w 100 -h 100 --out box.png  (cwd: <tmp>)', boxFit)
        }\n` +
        `--- box-fit output ---\n${boxFitOutput}\n\n` +
        `${
          commandTranscript(
            'imp resize logo.png -w 100 -h 100 --stretch --out stretched.png  (cwd: <tmp>)',
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
      const module = await import(toFileUrl(join(dir, 'dist', 'app.js')).href)
      const usage =
        `[bundled module: message='${module.message}', impLogLevel=${module.impLogLevel}, lazy loadShout()='${await module
          .loadShout()}']`
      await assertSnapshot(
        'build-app',
        mask(
          `${commandTranscript('imp build  (cwd: <tmp>)', result)}\n${await outputTree(
            'dist',
          )}\n\n${section('dist/index.html', html)}\n\n${usage}\n`,
        ),
      )
    })

    await t.step('build-js-entry', async () => {
      const result = await runImp(['build', 'app.js', '--outdir', 'component'], dir)
      const module = await import(toFileUrl(join(dir, 'component', 'app.js')).href)
      const usage = `[bundled module: message='${module.message}', lazy loadShout()='${await module
        .loadShout()}']`
      await assertSnapshot(
        'build-js-entry',
        mask(
          `${
            commandTranscript('imp build app.js --outdir component  (cwd: <tmp>)', result)
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
      const resolved = await runImp(['build', 'std-entry.js', '--outdir', 'std'], dir)
      const code = await Deno.readTextFile(join(dir, 'std', 'std-entry.js'))
      await Deno.writeTextFile(
        entry,
        "import { table } from 'imp/std/data'\n\nexport const shell = table\n",
      )
      const unknown = await runImp(['build', 'std-entry.js', '--outdir', 'std'], dir)
      await Deno.remove(entry)
      await Deno.remove(join(dir, 'std'), { recursive: true })
      await assertSnapshot(
        'build-imp-subpath',
        mask(
          `${
            commandTranscript('imp build std-entry.js --outdir std  (cwd: <tmp>)', resolved)
          }\n[bundle defines the element: ${code.includes('imp-button')}]\n\n${
            commandTranscript(
              'imp build std-entry.js --outdir std  (cwd: <tmp>, unknown subpath)',
              unknown,
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
      const result = await runImp(['build', 'app.js', '--outdir', 'shared'], dir)
      const code = await Deno.readTextFile(join(dir, 'shared', 'app.js'))
      await assertSnapshot(
        'build-target-imp-host',
        mask(
          `${
            commandTranscript('imp build app.js --outdir shared  (cwd: <tmp>)', result)
          }\n${await outputTree('shared')}\n\n${section('shared/app.js', code)}\n`,
        ),
      )
    })

    await t.step('build-component-skill', async () => {
      const marker = 'WIDGETSKILLMARKER'
      const project = await Deno.makeTempDir()
      const write = (name, text) => Deno.writeTextFile(join(project, name), text)
      await write('eager.js', "export const eager = () => 'eager'\n")
      await write('eager.skill.md', `# eager — ${marker} a statically imported component\n`)
      await write('lazy.js', "export const lazy = () => 'lazy'\n")
      await write('lazy.skill.md', `# lazy — ${marker} a lazily imported component\n`)
      await write(
        'app.js',
        "import { eager } from './eager.js'\n\n" +
          "export const boot = async () => eager() + (await import('./lazy.js')).lazy()\n",
      )
      await write('index.html', '<!doctype html>\n<script type="module" src="app.js"></script>\n')
      const componentOut = await Deno.makeTempDir()
      const component = await runImp(['build', 'eager.js', '--outdir', componentOut], project)
      const { impSkill } = await import(toFileUrl(join(componentOut, 'eager.js')).href)
      const app = await runImp(['build', '--outdir', 'app'], project)
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
              'imp build eager.js --outdir <component-out>  (cwd: <tmp>, component build)',
              component,
            )
          }\n${section('impSkill exported by the component bundle', String(impSkill))}\n\n${
            commandTranscript('imp build --outdir app  (cwd: <tmp>, app build)', app)
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
        `var s="# widget — ${marker} a published component";var w=()=>"widget";` +
          'export{s as impSkill,w as widget};\n',
      )
      await write('imp.json', '{ "dependencies": { "widget": "npm:widget@1.0.0" } }\n')
      await write(
        'hand.js',
        `export const impSkill = "# hand — ${marker} written into the module by hand"\n` +
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

    await t.step('build-external-flag-removed', async () => {
      const result = await runImp(['build', 'app.js', '--external', 'imp'], dir)
      await assertSnapshot(
        'build-external-flag-removed',
        mask(commandTranscript('imp build app.js --external imp  (cwd: <tmp>)', result)),
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

    await t.step('build-outdir-contains-project', async () => {
      const result = await runImp(['build', '--outdir', '.'], dir)
      await assertSnapshot(
        'build-outdir-contains-project',
        mask(commandTranscript('imp build --outdir .  (cwd: <tmp>)', result)),
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

    await t.step('build-renamed-from-bundle', async () => {
      const result = await runImp(['bundle'], dir)
      await assertSnapshot(
        'build-renamed-from-bundle',
        mask(commandTranscript('imp bundle  (cwd: <tmp>)', result)),
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
    await page.goto(`${base}/preview/components/counter.preview.js`, { waitUntil: 'load' })
    await page.waitForFunction(
      () => document.querySelectorAll('.imp-preview__row textarea:not([disabled])').length === 3,
    )
    const counter = await page.evaluate(() => {
      const scenarios = [...document.querySelectorAll('.imp-preview__scenario')]
      const read = (scenario) =>
        scenario.querySelector('demo-counter').shadowRoot.querySelector('#value').textContent
      return {
        names: scenarios.map((scenario) => scenario.querySelector('h2').textContent),
        rendered: scenarios.map(read),
        states: scenarios.map((scenario) =>
          `${scenario.querySelector('.imp-preview__name').textContent}=${
            scenario.querySelector('textarea').value
          }`
        ),
        handles: scenarios[0].querySelectorAll('.imp-preview__handle').length,
      }
    })
    const edited = await page.evaluate(() => {
      const scenario = document.querySelector('.imp-preview__scenario')
      scenario.querySelector('textarea').value = '42'
      scenario.querySelector('.imp-preview__row button').click()
      return scenario.querySelector('demo-counter').shadowRoot.querySelector('#value').textContent
    })
    const rejected = await page.evaluate(() => {
      const scenario = document.querySelector('.imp-preview__scenario')
      scenario.querySelector('textarea').value = '{ not json'
      scenario.querySelector('.imp-preview__row button').click()
      return scenario.querySelector('.imp-preview__message').classList
        .contains('imp-preview__message--error')
    })
    const localized = await page.evaluate(async () => {
      const languages = document.querySelector('.imp-preview__select--language')
      const directions = document.querySelector('.imp-preview__select--direction')
      const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
      const stage = () => document.querySelector('.imp-preview__stage')
      const pick = async (picker, value) => {
        picker.value = value
        picker.dispatchEvent(new Event('change'))
        await settle()
        return `${document.documentElement.lang}/${document.documentElement.dir}/${stage().dir}`
      }
      const chrome = () => document.querySelector('.imp-preview__bar').dir
      const words = () => {
        const shadow = document.querySelector('demo-counter').shadowRoot
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
      const picker = document.querySelector('.imp-preview__select--theme')
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

    await page.goto(`${base}/preview/components/counter.preview.js?scenario=lazy`, {
      waitUntil: 'load',
    })
    await page.waitForFunction(() => document.querySelector('demo-counter')?.shadowRoot?.children)
    const isolated = await page.evaluate(() => ({
      panels: document.querySelectorAll('.imp-preview__scenario').length,
      name: document.querySelector('h2').textContent,
    }))

    await page.goto(`${base}/preview/components/todos.preview.js`, { waitUntil: 'load' })
    await page.waitForFunction(() =>
      document.querySelector('demo-todos')?.shadowRoot?.querySelectorAll('.todo').length === 2
    )
    const todos = await page.evaluate(() => ({
      items: [...document.querySelector('demo-todos').shadowRoot.querySelectorAll('.todo')]
        .map((item) => item.textContent),
      state: document.querySelector('.imp-preview__name').textContent,
    }))

    const report = [
      `scenarios: ${counter.names.join(', ')}`,
      `rendered values: ${counter.rendered.join(', ')}`,
      `state rows: ${counter.states.join(', ')}`,
      `resize handles per stage: ${counter.handles}`,
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
      `?scenario=lazy panels: ${isolated.panels} (${isolated.name})`,
      `mocked todos: ${todos.items.join(', ')}`,
      `mocked todos state row: ${todos.state}`,
    ].join('\n')
    await assertSnapshot('preview-browser', `${report}\n`)
  } finally {
    await browser.close().catch(() => {})
    await server.stop()
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
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
  }

  await t.step('every skills page is registered as a subject', async () => {
    const pages = []
    for await (const entry of Deno.readDir(join(REPO_ROOT, 'skills'))) {
      if (entry.isFile && entry.name.endsWith('.md')) pages.push(entry.name)
    }
    const registered = SKILLS.map((skill) => skill.file)
    for (const page of pages) {
      check(
        registered.includes(page),
        `skills/${page} has no subject in cli/src/skill.js — every skills page is an imp skill`,
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
        stdout.startsWith(`imp skill: ${skill.name} — ${skill.summary}`),
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

  await t.step('every std component has a skill file next to it', async () => {
    const exported = []
    for (const barrel of ['general', 'display', 'layout', 'inputs']) {
      const path = join(REPO_ROOT, 'lib', 'src', 'std', barrel, 'index.js')
      const source = await Deno.readTextFile(path)
      for (const match of source.matchAll(/export\s*{\s*(\w+)\s*}\s*from\s*'\.\/([\w.]+)'/g)) {
        exported.push({ name: match[1], module: join(dirname(path), match[2]) })
      }
    }
    check(exported.length > 0, 'no std components found in the barrels')
    for (const { name, module } of exported) {
      const registered = COMPONENT_SKILLS.find((skill) => skill.name === `std/${name}`)
      check(registered !== undefined, `std/${name} has no entry in COMPONENT_SKILLS`)
      const expected = skillFileFor(module)
      const actual = join(REPO_ROOT, 'lib', 'src', registered.file)
      check(actual === expected, `std/${name} skill should be ${expected}, registered ${actual}`)
      const exists = await Deno.stat(expected).then(() => true).catch(() => false)
      check(exists, `missing ${expected} — every std component ships a skill file`)
    }
  })

  await t.step('a std component prints its skill file verbatim', async () => {
    for (const component of COMPONENT_SKILLS) {
      const file = join(REPO_ROOT, 'lib', 'src', component.file)
      const source = (await Deno.readTextFile(file)).trimEnd()
      const { code, stdout } = await runImp(['skill', component.name])
      check(code === 0, `imp skill ${component.name} exited ${code}`)
      check(stdout.trimEnd() === source, `imp skill ${component.name} did not print ${file}`)
    }
  })

  await t.step('subjects resolve by alias, specifier and file name', () => {
    for (const skill of SKILLS) {
      for (const alias of [skill.name, ...skill.aliases]) {
        check(findSkill(alias)?.name === skill.name, `'${alias}' does not resolve to ${skill.name}`)
      }
    }
    check(findSkill('imp/State')?.name === 'state', 'subject lookup is not case-insensitive')
    check(findSkill('state.md')?.name === 'state', 'a docs file name does not resolve')
    check(findSkill('button')?.name === 'std/button', "'button' does not resolve to std/button")
    check(
      findSkill('imp/std/emptyState')?.name === 'std/emptyState',
      'an imp/std specifier does not resolve to its component',
    )
    check(findSkill('bogus') === null, 'an unknown subject resolved to something')
  })

  await t.step('the index lists every subject once', async () => {
    const index = await skillIndex()
    for (const skill of [...SKILLS, ...COMPONENT_SKILLS]) {
      const lines = index.split('\n').filter((line) => line.startsWith(`  ${skill.name} `))
      check(lines.length === 1, `${skill.name} appears ${lines.length} times in the index`)
    }
  })

  await t.step('the index lists the components of the project it runs in', async () => {
    const { stdout } = await runImp(['skill'], fixture('skill-project'))
    check(stdout.includes('THIS PROJECT'), 'the index has no project section')
    check(
      /\n {2}\.\/counter\.js\s+counter — a self-contained/.test(stdout),
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
