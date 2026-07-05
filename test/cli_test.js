import { fromFileUrl, join, toFileUrl } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { CLIENT_JS } from '../src/cli/client.js'
import { bundleDependency, shutdownBundler } from '../src/cli/deps.js'
import { injectImp } from '../src/cli/start.js'
import { defaultAlias, parseSpecifier } from '../src/cli/specifiers.js'

const ROOT = fromFileUrl(new URL('..', import.meta.url))
const IMP = join(ROOT, Deno.build.os === 'windows' ? 'imp.exe' : 'imp')
const fixture = (name) => join(ROOT, 'test', 'fixtures', name)

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, 'g')

const normalize = (text) =>
  text.replaceAll(ANSI, '').replaceAll(ROOT, '<root>/').replace(/\b\d+ms\b/g, '*ms')

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

async function copyDirectory(source, destination) {
  await Deno.mkdir(destination, { recursive: true })
  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name)
    const to = join(destination, entry.name)
    if (entry.isDirectory) await copyDirectory(from, to)
    else await Deno.copyFile(from, to)
  }
}

Deno.test('imp bundle', async (t) => {
  const dir = await Deno.makeTempDir()
  await copyDirectory(fixture('bundle'), dir)

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
    await t.step('bundle-app', async () => {
      const result = await runImp(['bundle'], dir)
      const html = await Deno.readTextFile(join(dir, 'dist', 'index.html'))
      const module = await import(toFileUrl(join(dir, 'dist', 'app.js')).href)
      const usage =
        `[bundled module: message='${module.message}', propsAreObjects=${module.propsAreObjects}, lazy loadShout()='${await module
          .loadShout()}']`
      await assertSnapshot(
        'bundle-app',
        mask(
          `${commandTranscript('imp bundle  (cwd: <tmp>)', result)}\n${await outputTree(
            'dist',
          )}\n\n${section('dist/index.html', html)}\n\n${usage}\n`,
        ),
      )
    })

    await t.step('bundle-js-entry', async () => {
      const result = await runImp(['bundle', 'app.js', '--outdir', 'component'], dir)
      const module = await import(toFileUrl(join(dir, 'component', 'app.js')).href)
      const usage = `[bundled module: message='${module.message}', lazy loadShout()='${await module
        .loadShout()}']`
      await assertSnapshot(
        'bundle-js-entry',
        mask(
          `${
            commandTranscript('imp bundle app.js --outdir component  (cwd: <tmp>)', result)
          }\n${await outputTree('component')}\n\n${usage}\n`,
        ),
      )
    })

    const writeImpJson = (config) =>
      Deno.writeTextFile(join(dir, 'imp.json'), JSON.stringify(config, null, 2) + '\n')

    await t.step('bundle-target-imp-host', async () => {
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        targetImpHost: true,
      })
      const result = await runImp(['bundle', 'app.js', '--outdir', 'shared'], dir)
      const code = await Deno.readTextFile(join(dir, 'shared', 'app.js'))
      await assertSnapshot(
        'bundle-target-imp-host',
        mask(
          `${
            commandTranscript('imp bundle app.js --outdir shared  (cwd: <tmp>)', result)
          }\n${await outputTree('shared')}\n\n${section('shared/app.js', code)}\n`,
        ),
      )
    })

    await t.step('bundle-html-entry-ignores-target-imp-host', async () => {
      const result = await runImp(['bundle'], dir)
      await assertSnapshot(
        'bundle-html-entry-ignores-target-imp-host',
        mask(commandTranscript('imp bundle  (cwd: <tmp>)', result)),
      )
    })

    await t.step('bundle-external-flag-removed', async () => {
      const result = await runImp(['bundle', 'app.js', '--external', 'imp'], dir)
      await assertSnapshot(
        'bundle-external-flag-removed',
        mask(commandTranscript('imp bundle app.js --external imp  (cwd: <tmp>)', result)),
      )
    })

    await t.step('bundle-invalid-target-imp-host', async () => {
      await writeImpJson({
        dependencies: { mitt: 'npm:mitt@3.0.1' },
        targetImpHost: 'yes',
      })
      const result = await runImp(['bundle', 'app.js'], dir)
      await writeImpJson({ dependencies: { mitt: 'npm:mitt@3.0.1' } })
      await assertSnapshot(
        'bundle-invalid-target-imp-host',
        mask(commandTranscript('imp bundle app.js  (cwd: <tmp>)', result)),
      )
    })

    await t.step('bundle-missing-entry', async () => {
      const result = await runImp(['bundle', 'missing.html'], dir)
      await assertSnapshot(
        'bundle-missing-entry',
        mask(commandTranscript('imp bundle missing.html  (cwd: <tmp>)', result)),
      )
    })

    await t.step('bundle-outdir-contains-project', async () => {
      const result = await runImp(['bundle', '--outdir', '.'], dir)
      await assertSnapshot(
        'bundle-outdir-contains-project',
        mask(commandTranscript('imp bundle --outdir .  (cwd: <tmp>)', result)),
      )
    })

    await t.step('bundle-not-vendored', async () => {
      const result = await runImp(['bundle'], fixture('with-config'))
      await assertSnapshot(
        'bundle-not-vendored',
        mask(
          commandTranscript('imp bundle  (cwd: /test/fixtures/with-config)', result),
        ),
      )
    })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

async function startServer(cwd) {
  const child = new Deno.Command(IMP, {
    args: ['start', 'index.html', '--port', '0'],
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
