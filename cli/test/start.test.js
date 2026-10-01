import { join } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { clientScript } from '../src/client.js'
import { bundleMockFiles, createMocks } from '../src/mocks.js'
import {
  check,
  commandTranscript,
  copyDirectory,
  firstReloadEvent,
  fixture,
  normalize,
  responseTranscript,
  runImp,
  runServiceWorker,
  section,
  startServer,
  tempDir,
  touch,
  widgetMark,
  withBuiltScripts,
  workerReport,
} from './helpers.js'

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
  const disabled = await tempDir()
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

Deno.test('--no-reload keeps the page as it is when a file changes', async (t) => {
  const runs = [
    { label: 'default', args: [], expected: 'reload' },
    { label: '--no-reload', args: ['--no-reload'], expected: null },
  ]
  const lines = []
  const banners = []
  const logs = []
  for (const run of runs) {
    const dir = await tempDir()
    await copyDirectory(fixture('basic'), dir)
    const server = await startServer(dir, run.args)
    try {
      const banner = normalize(server.banner).replaceAll(`:${server.port}`, ':<port>')
      banners.push(
        section(run.label, banner.replaceAll(dir, '<tmp>').replaceAll(dir.slice(1), '<tmp>')),
      )
      const events = firstReloadEvent(server.port, 1500)
      await settled()
      await touch(join(dir, 'lib.js'))
      const result = await events
      check(result === run.expected, `${run.label}: the event stream sends ${result ?? 'nothing'}`)
      lines.push(`${run.label} -> ${result ?? 'nothing'}`)
      await settled()
      const session = await runImp(['logs'], dir)
      const changes = session.stdout.split('\n').filter((line) => line.includes('change detected'))
      logs.push(section(run.label, changes.join('\n')))
    } finally {
      await server.stop()
      await Deno.remove(dir, { recursive: true })
    }
  }

  await t.step('no-reload-flag', async () => {
    await assertSnapshot('no-reload-flag', `${section('imp start', lines.join('\n'))}\n`)
  })

  await t.step('no-reload-banner', async () => {
    await assertSnapshot('no-reload-banner', `${banners.join('\n\n')}\n`)
  })

  await t.step('no-reload-logs', async () => {
    await assertSnapshot('no-reload-logs', `${logs.join('\n\n')}\n`)
  })

  await t.step('no-reload-keeps-the-entry-argument', async () => {
    const dir = await tempDir()
    await copyDirectory(fixture('basic'), dir)
    await Deno.writeTextFile(join(dir, 'app.html'), '<!doctype html><title>app entry</title>\n')
    const server = await startServer(dir, ['--no-reload'], ['start', 'app.html'])
    try {
      const body = await (await fetch(`http://127.0.0.1:${server.port}/`)).text()
      check(body.includes('app entry'), 'app.html is the entry when --no-reload follows it')
      check(server.banner.includes('serving app.html'), 'the banner names app.html')
    } finally {
      await server.stop()
      await Deno.remove(dir, { recursive: true })
    }
  })

  await t.step('no-reload-with-mock', async () => {
    const dir = await tempDir()
    await copyDirectory(fixture('start-mocks'), dir)
    const server = await startServer(dir, ['--mock', '--no-reload'])
    try {
      check(server.banner.includes('serving index.html'), 'index.html stays the entry')
      check(server.banner.includes('no reload'), 'the banner says no reload')
      const mocked = await mockedRequest(server.port)
      const events = firstReloadEvent(server.port, 1500)
      await settled()
      await touch(join(dir, 'app.js'))
      const result = await events
      check(result === null, `no reload arrives with --mock --no-reload, got ${result}`)
      await assertSnapshot(
        'no-reload-with-mock',
        `${section('imp start --mock --no-reload', mocked)}\n`,
      )
    } finally {
      await server.stop()
      await Deno.remove(dir, { recursive: true })
    }
  })
})

const ownWorkerFixture = async (edit = null) => {
  const dir = await tempDir()
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
      .replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js')

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
    const dir = await tempDir()
    await copyDirectory(fixture('build-pwa'), dir)
    await copyDirectory(join(fixture('start-service-worker'), 'src'), join(dir, 'src'))
    await Deno.writeTextFile(
      join(dir, 'src', 'sw.js'),
      "import { precacheBuild } from 'imp/service-worker'\n" +
        "import { greeting } from './greeting.js'\n\n" +
        'self.__fixture = { greeting }\n\n' +
        'precacheBuild()\n',
    )
    const config = JSON.parse(await Deno.readTextFile(join(dir, 'imp.json')))
    await Deno.writeTextFile(
      join(dir, 'imp.json'),
      JSON.stringify({ ...config, serviceWorker: 'src/sw.js' }, null, 2) + '\n',
    )
    const plain = await runImp(['build'], dir)
    check(plain.code === 0, `the plain build failed:\n${plain.stderr}`)
    const plainWorker = await Deno.readTextFile(join(dir, 'dist', 'sw.js'))
    const result = await runImp(['build', '--pwa'], dir)
    const html = await withBuiltScripts(
      join(dir, 'dist'),
      await Deno.readTextFile(join(dir, 'dist', 'index.html')),
    )
    const sw = await Deno.readTextFile(join(dir, 'dist', 'sw.js'))
    const report = [
      `registration: ${html.match(/serviceWorker\.register\([^)]*\)/)?.[0] ?? '(none)'}`,
      `dist/sw.js is the project worker: ${sw.includes('__fixture') ? 'yes' : 'no'}`,
      workerReport(sw),
      '',
      'without --pwa:',
      workerReport(plainWorker),
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
  const dir = await tempDir()
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
  const dir = await tempDir()
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
        stdout: result.stdout.replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')
          .replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js'),
      })
    }\n${section('output files', built.join('\n').replace(/-[A-Z0-9]{8}\.js/g, '-<hash>.js'))}\n`,
  )
})

Deno.test('the mocks of the imp process report problems and keep their state', async () => {
  const root = await tempDir()
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

const askMocks = async (mocks) => {
  const response = await mocks.answer(
    new Request('http://app.test/@imp/mock', {
      method: 'POST',
      body: JSON.stringify({ method: 'GET', path: '/api/value' }),
    }),
  )
  return await response.text()
}

const valueMock = (value) =>
  `export const mocks = [{ match: () => true, handler: () => ({ body: ${
    JSON.stringify(value)
  } }) }]\n`

Deno.test('an edit to a mock file during a rebuild wins over the rebuild', async () => {
  const root = await tempDir()
  const directory = join(root, 'mocks')
  await Deno.mkdir(directory)
  const file = join(directory, 'value.mock.js')
  let holdNextBundle = false
  let bundleHeld = null
  let releaseBundle = null
  const bundle = async (...args) => {
    const bundled = await bundleMockFiles(...args)
    if (holdNextBundle) {
      holdNextBundle = false
      await new Promise((resolve) => {
        releaseBundle = resolve
        bundleHeld()
      })
    }
    return bundled
  }
  const mocks = createMocks({ root, directory, bundle })
  try {
    await Deno.writeTextFile(file, valueMock('one'))
    const first = await askMocks(mocks)
    await Deno.writeTextFile(file, valueMock('two'))
    holdNextBundle = true
    const held = new Promise((resolve) => bundleHeld = resolve)
    const running = mocks.refresh()
    await held
    await Deno.writeTextFile(file, valueMock('three'))
    const during = mocks.refresh()
    releaseBundle()
    await running
    await during
    const after = await askMocks(mocks)
    check(first === 'one', `the first answer is ${first}`)
    check(after === 'three', `after the edit during the rebuild, the mocks answer ${after}`)
  } finally {
    await Deno.remove(root, { recursive: true })
  }
})

Deno.test('a mock that throws outside its handler stops only the mocks, and they load again', async () => {
  const root = await tempDir()
  const directory = join(root, 'mocks')
  await Deno.mkdir(directory)
  const reported = []
  const mocks = createMocks({
    root,
    directory,
    onChange: (state) => reported.push(`${state.entries.length} entry`),
  })
  await Deno.writeTextFile(
    join(directory, 'late.mock.js'),
    [
      'let calls = 0',
      'export const mocks = [{',
      '  match: () => true,',
      '  handler: (request) => {',
      '    calls++',
      "    if (request.path === '/crash') setTimeout(() => { throw new Error('late failure') })",
      '    return { body: calls }',
      '  },',
      '}]',
      '',
    ].join('\n'),
  )
  const ask = async (path) => {
    const response = await mocks.answer(
      new Request('http://app.test/@imp/mock', {
        method: 'POST',
        body: JSON.stringify({ method: 'GET', path }),
      }),
    )
    return await response.text().catch((error) => error.message)
  }
  try {
    const first = await ask('/api/value')
    await ask('/crash')
    await new Promise((resolve) => setTimeout(resolve, 500))
    const afterCrash = await ask('/api/value')
    check(first === '1', `the first answer is ${first}`)
    check(afterCrash === '1', `a reloaded mock set starts again, and answers ${afterCrash}`)
    check(reported.length === 2, `the mocks loaded ${reported.length} time(s)`)
  } finally {
    await Deno.remove(root, { recursive: true })
  }
})
