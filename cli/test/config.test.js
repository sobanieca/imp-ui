import { join, relative, toFileUrl } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { bundleDependency, runEsbuild, shutdownBundler } from '../src/deps.js'
import { fromEsbuildPath, toEsbuildPath } from '../src/esbuild-paths.js'
import { dirname as win32Dirname, join as win32Join } from '@std/path/windows'
import { injectImp, resolveWithinRoot } from '../src/start.js'
import { envInjectionScript, resolveEnvironment } from '../src/environments.js'
import {
  check,
  commandTranscript,
  copyDirectory,
  fixture,
  normalize,
  runImp,
  section,
  startServer,
  tempDir,
  withBuiltScripts,
} from './helpers.js'

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
  const dir = await tempDir()
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

Deno.test('an injected value cannot end its script', () => {
  const tag = envInjectionScript({ NOTE: 'a </script><script>alert(1)</script> <!-- b' })
  const inner = tag.slice('<script>'.length, -'</script>'.length)
  check(!/<\/script|<!--/i.test(inner), `the value escaped its script: ${tag}`)
  const values = {}
  new Function('globalThis', inner)(values)
  check(
    values.__IMP_ENV__.NOTE === 'a </script><script>alert(1)</script> <!-- b',
    'the value changed',
  )
})

Deno.test('IMP_CACHE_DIR resolves a relative folder against the current folder', async () => {
  const { impCacheDirectory } = await import('../src/cache-dir.js')
  const resolved = impCacheDirectory(new Map([['IMP_CACHE_DIR', '.imp/cache']]))
  check(
    resolved === join(Deno.cwd(), '.imp', 'cache'),
    `a relative cache folder stayed relative: ${resolved}`,
  )
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
  const root = join(await tempDir(), 'app')
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
  const dir = await tempDir()
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

  const run = async (
    label,
    { config: cfg = config, requestedAlias = null, impEnv, token } = {},
  ) => {
    const shellEnv = new Map()
    if (impEnv !== undefined) shellEnv.set('IMP_ENV', impEnv)
    if (token !== undefined) shellEnv.set('IMP_TEST_TOKEN', token)
    let outcome
    try {
      const resolved = await resolveEnvironment({
        root: dir,
        config: cfg,
        requestedAlias,
        shellEnv,
      })
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
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build and start with environments', async (t) => {
  const dir = await tempDir()
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

  const savedImpEnv = Deno.env.get('IMP_ENV')
  Deno.env.delete('IMP_ENV')

  const mask = (text) =>
    text.replaceAll(dir, '<tmp>').replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')
      .replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js')
  const envLine = (html) =>
    html.match(/globalThis\.__IMP_ENV__ = [^<\n]*/)?.[0] ?? '(none injected)'

  try {
    await t.step('build-default-env', async () => {
      const result = await runImp(['build'], dir)
      const html = await withBuiltScripts(
        join(dir, 'dist'),
        await Deno.readTextFile(join(dir, 'dist', 'index.html')),
      )
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
      const result = await runImp(['build', '--env', 'prod'], dir, {
        IMP_DEMO_TOKEN: 'prod-secret',
      })
      const html = await withBuiltScripts(
        join(dir, 'dist'),
        await Deno.readTextFile(join(dir, 'dist', 'index.html')),
      )
      await assertSnapshot(
        'env-build-selected',
        `${mask(commandTranscript('imp build --env prod  (cwd: <tmp>)', result))}\n${
          section('injected env', envLine(html))
        }\n`,
      )
    })

    await t.step('build-missing-shell-variable', async () => {
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
    if (savedImpEnv === undefined) Deno.env.delete('IMP_ENV')
    else Deno.env.set('IMP_ENV', savedImpEnv)
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp build and start with build flags', async (t) => {
  const dir = await tempDir()
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
    [...html.matchAll(/globalThis\.__IMP_[A-Z_]+ = [^<\n]*/g)].map(([line]) => line).join('\n')

  const buildReport = async (alias) => {
    const result = await runImp(['build', '--env', alias], dir)
    const files = await Array.fromAsync(Deno.readDir(join(dir, 'dist', 'chunks')))
      .catch(() => [])
    const sources = await Promise.all(
      files.map((file) => Deno.readTextFile(join(dir, 'dist', 'chunks', file.name))),
    )
    const chunks = files.filter((file) => !/^(app|env)-/.test(file.name))
    const output = sources.join('\n')
    const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      .then((text) => withBuiltScripts(join(dir, 'dist'), text)).catch(() => '')
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
  const dir = await tempDir()
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

Deno.test('a Windows path turns into a path that esbuild accepts, and back', () => {
  const pairs = [
    [
      'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\happy-dom.js',
      '/C:/Users/RUNNER~1/AppData/Local/Temp/happy-dom.js',
    ],
    ['d:\\app\\index.html', '/d:/app/index.html'],
    ['C:\\', '/C:/'],
    ['\\\\server\\share\\app\\main.js', '/UNC/server/share/app/main.js'],
  ]
  for (const [native, esbuildPath] of pairs) {
    check(
      toEsbuildPath(native, 'windows') === esbuildPath,
      `${native} -> ${toEsbuildPath(native, 'windows')}`,
    )
    check(
      fromEsbuildPath(esbuildPath, 'windows') === native,
      `${esbuildPath} -> ${fromEsbuildPath(esbuildPath, 'windows')}`,
    )
  }
  const oneWay = [
    ['C:/Users/app/main.js', '/C:/Users/app/main.js'],
    ['\\\\?\\C:\\Users\\app\\main.js', '/C:/Users/app/main.js'],
    ['\\\\?\\UNC\\server\\share\\main.js', '/UNC/server/share/main.js'],
    ['//server/share/main.js', '/UNC/server/share/main.js'],
  ]
  for (const [native, esbuildPath] of oneWay) {
    check(
      toEsbuildPath(native, 'windows') === esbuildPath,
      `${native} -> ${toEsbuildPath(native, 'windows')}`,
    )
  }
  for (const untouched of ['/bundle', 'npm:happy-dom@20.10.6', 'file:///C:/app.js', './a.js', '']) {
    check(toEsbuildPath(untouched, 'windows') === untouched, `${untouched} stays as it is`)
    check(fromEsbuildPath(untouched, 'windows') === untouched, `${untouched} comes back as it is`)
  }
  for (const path of ['C:\\app\\main.js', '/C:/app/main.js', '/home/app/main.js']) {
    check(toEsbuildPath(path, 'linux') === path, `${path} stays as it is on Linux`)
    check(fromEsbuildPath(path, 'linux') === path, `${path} comes back as it is on Linux`)
  }
})

Deno.test('runEsbuild on Windows gives plugins and callers native paths only', async () => {
  const files = new Map([
    [
      'C:\\proj\\src\\app.js',
      "import { b } from './b.js'\nimport './app.css'\nexport const lazy = () => import('./lazy.js')\nconsole.log(b)\n",
    ],
    ['C:\\proj\\src\\b.js', "export { shared as b } from 'shared'\n"],
    ['D:\\shared\\index.js', "export const shared = 'shared'\n"],
    ['C:\\proj\\src\\lazy.js', 'export default 1\n'],
    ['C:\\proj\\src\\app.css', '.a { color: red }\n'],
  ])
  const seen = []
  const plugin = {
    name: 'windows-files',
    setup(build) {
      build.onResolve({ filter: /^shared$/ }, (args) => {
        seen.push(args.importer, args.resolveDir)
        return build.resolve('D:\\shared\\index.js', {
          kind: args.kind,
          importer: args.importer,
          resolveDir: args.resolveDir,
        })
      })
      build.onResolve({ filter: /.*/ }, (args) => {
        seen.push(args.importer, args.resolveDir)
        if (args.kind === 'entry-point') seen.push(args.path)
        if (args.kind === 'entry-point' || files.has(args.path)) return { path: args.path }
        return { path: win32Join(args.resolveDir, args.path) }
      })
      build.onLoad({ filter: /.*/ }, (args) => {
        seen.push(args.path)
        return {
          contents: files.get(args.path),
          loader: args.path.endsWith('.css') ? 'css' : 'js',
          resolveDir: win32Dirname(args.path),
        }
      })
    },
  }
  try {
    const result = await runEsbuild({
      plugins: [plugin],
      entryPoints: ['C:\\proj\\src\\app.js'],
      absWorkingDir: 'C:\\proj',
      bundle: true,
      splitting: true,
      format: 'esm',
      metafile: true,
      write: false,
      outdir: 'C:\\proj\\dist',
      entryNames: 'chunks/[name]-[hash]',
      chunkNames: 'chunks/[name]-[hash]',
    }, { os: 'windows' })
    const nativePath = /^[A-Z]:\\[^/]*$/
    const loaded = seen.filter(Boolean)
    check(loaded.every((path) => nativePath.test(path)), `plugins saw ${loaded.join(', ')}`)
    check(loaded.includes('D:\\shared\\index.js'), `the resolved file loaded: ${loaded.join(', ')}`)
    const outputs = result.outputFiles.map((file) => file.path)
    check(
      outputs.every((path) => /^C:\\proj\\dist\\chunks\\[\w-]+\.(js|css)$/.test(path)),
      `the output files are ${outputs.join(', ')}`,
    )
    const { inputs, outputs: metaOutputs } = result.metafile
    check(
      [...Object.keys(inputs), ...Object.keys(metaOutputs)].every((key) => nativePath.test(key)),
      `the metafile names ${[...Object.keys(inputs), ...Object.keys(metaOutputs)].join(', ')}`,
    )
    check(Object.hasOwn(inputs, 'D:\\shared\\index.js'), 'the metafile keeps the other drive')
    const entry = Object.values(metaOutputs).find((output) => output.cssBundle)
    check(entry?.entryPoint === 'C:\\proj\\src\\app.js', `the entry point is ${entry?.entryPoint}`)
    check(outputs.includes(entry.cssBundle), `the CSS bundle ${entry.cssBundle} is an output`)
    check(
      Object.keys(metaOutputs).every((key) => outputs.includes(key)),
      'every metafile output names an output file',
    )
  } finally {
    await shutdownBundler()
  }
})
