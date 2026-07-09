import { fromFileUrl, join, toFileUrl } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { CLIENT_JS } from '../src/client.js'
import { bundleDependency, shutdownBundler } from '../src/deps.js'
import { injectImp } from '../src/start.js'
import { envInjectionScript, resolveEnvironment } from '../src/environments.js'
import { defaultAlias, parseSpecifier } from '../src/specifiers.js'

const ROOT = fromFileUrl(new URL('..', import.meta.url))
const REPO_ROOT = fromFileUrl(new URL('../..', import.meta.url))
const IMP = join(REPO_ROOT, Deno.build.os === 'windows' ? 'imp.exe' : 'imp')
const fixture = (name) => join(ROOT, 'test', 'fixtures', name)

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, 'g')

const normalize = (text) =>
  text.replaceAll(ANSI, '').replaceAll(ROOT, '<root>/').replace(/\b\d+ms\b/g, '*ms')
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
  await test('lint-clean', ['lint', 'app.js'], fixture('with-config'))
  await test('lint-vendored-imports', ['lint', 'app.js'], fixture('basic'))
  await test('lint-capital-component', ['lint', 'components.js'], fixture('lint-bad'))
  await test('lint-multiple-props-objects', ['lint', 'app.js'], fixture('lint-props'))
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
        `[bundled module: message='${module.message}', propsAreObjects=${module.propsAreObjects}, lazy loadShout()='${await module
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

async function startServer(cwd, extraArgs = []) {
  const child = new Deno.Command(IMP, {
    args: ['start', 'index.html', '--port', '0', ...extraArgs],
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
      maskBody: (body) => normalize(body.replace(CLIENT_JS, '\n[imp client script]\n')),
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

Deno.test('imp start warns about missing vendored dependency', async () => {
  const server = await startServer(fixture('with-config'))
  try {
    const banner = normalize(server.banner).replaceAll(`:${server.port}`, ':<port>')
    await assertSnapshot('start-missing-dependency-warning', banner)
  } finally {
    await server.stop()
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

Deno.test('bundleDependency keeps bare imp imports external', async () => {
  const dir = await Deno.makeTempDir()
  const entry = join(dir, 'component.js')
  await Deno.writeTextFile(
    entry,
    "import { div } from 'imp'\nexport const box = (text) => div(text)\n",
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
