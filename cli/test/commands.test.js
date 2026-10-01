import { dirname, join } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { createDevLog } from '../src/dev-log.js'
import { VERSION } from '../src/version.js'
import {
  check,
  commandTranscript,
  fixture,
  IMP,
  listFiles,
  posixPath,
  ROOT,
  runImp,
  tempDir,
} from './helpers.js'

Deno.test('imp commands', async (t) => {
  const test = async (name, args, cwd) => {
    await t.step(name, async () => {
      const result = await runImp(args, cwd)
      const location = cwd ? `  (cwd: ${posixPath(cwd.slice(ROOT.length))})` : ''
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
  await test('lint-analytics-names', ['lint', 'src/main.js'], fixture('lint-analytics'))
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
  await test('lint-accessible-names', ['lint', 'app.js'], fixture('lint-accessible-names'))
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    if (Deno.build.os !== 'windows') {
      check(status.code === 0, `imp logs -f exits 0 on Ctrl-C, got ${status.code}`)
    }
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
    const dir = await tempDir()
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
    const dir = await tempDir()
    const existing = '# my stuff\nnode_modules\n*.log\n.env*\n/dist\n.DS_Store\n'
    await Deno.writeTextFile(join(dir, '.gitignore'), existing)
    const merged = await runImp(['init'], dir)
    const afterMerge = await Deno.readTextFile(join(dir, '.gitignore'))
    const covered = await tempDir()
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
    const dir = join(await tempDir(), 'my-shop')
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
    const dir = await tempDir()
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
