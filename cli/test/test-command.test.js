import { join } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import {
  check,
  commandTranscript,
  copyDirectory,
  fixture,
  posixPath,
  ROOT,
  runImp,
  tempDir,
} from './helpers.js'

Deno.test('imp test', async (t) => {
  const test = async (name, args, cwd) => {
    await t.step(name, async () => {
      const result = await runImp(args, cwd)
      const location = cwd ? `  (cwd: ${posixPath(cwd.slice(ROOT.length))})` : ''
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
  const dir = await tempDir()
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

    await t.step('test-e2e-level-forwards-mock', async () => {
      await Deno.mkdir(join(dir, 'mocks'))
      await Deno.writeTextFile(
        join(dir, 'imp.json'),
        JSON.stringify({ mocks: { folder: 'mocks', enabled: false } }),
      )
      await Deno.writeTextFile(
        join(dir, 'mocks', 'ping.mock.js'),
        "export const mocks = [{ match: (request) => request.path === '/api/ping', " +
          'handler: () => ({ body: { pong: true } }) }]\n',
      )
      await Deno.writeTextFile(
        join(dir, 'ping.spec.js'),
        "import { expect, test } from 'imp/test'\n\n" +
          "test('answers from a mocked endpoint', async ({ page }) => {\n" +
          "  const body = await page.evaluate(() => fetch('/api/ping').then((response) => response.json()))\n" +
          '  expect(body).toEqual({ pong: true })\n' +
          '})\n',
      )
      const result = await runImp(['test', '--e2e', '--mock', '--filter', 'mocked'], dir)
      await Deno.remove(join(dir, 'ping.spec.js'))
      await Deno.remove(join(dir, 'mocks'), { recursive: true })
      await Deno.remove(join(dir, 'imp.json'))
      check(
        result.code === 0 && result.stdout.includes('\u2713 ping.spec.js'),
        `the level run must forward --mock to every spec:\n${result.stdout}\n${result.stderr}`,
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
