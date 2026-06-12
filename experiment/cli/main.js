#!/usr/bin/env -S deno run -A
// imp — the all-in-one CLI/runtime (essence #20). Thin wrappers over Deno's
// native tooling: dev server, test (DOM-polyfilled deno test), lint (with the
// imp plugin), fmt, build (esbuild), showcase, new. Ship as a compiled
// binary: deno compile -A -o imp cli/main.js

import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1'

const HERE = dirname(fromFileUrl(import.meta.url))
const FRAMEWORK_ROOT = join(HERE, '..')

const HELP = `imp — buildless UI toolkit

USAGE
  imp dev [--port 4507]      serve current dir: live reload + browser telemetry
  imp test [...deno args]    run *_test.js with a polyfilled DOM (deno test)
  imp lint [...paths]        deno lint + imp rules (no-capital-component)
  imp fmt [...paths]         deno fmt
  imp build [--outdir dist]  production bundle (esbuild, code-split, hashed)
  imp showcase [--port 4508] stdlib gallery with live theme/locale editor
  imp new <dir>              scaffold a new app (framework vendored in)
`

function flag(args, name, fallback) {
  const i = args.indexOf('--' + name)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

async function run(cmd, args) {
  const child = new Deno.Command(Deno.execPath(), {
    args: [cmd, ...args],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn()
  const status = await child.status
  Deno.exit(status.code)
}

async function copyDir(from, to) {
  await Deno.mkdir(to, { recursive: true })
  for await (const entry of Deno.readDir(from)) {
    const src = join(from, entry.name)
    const dst = join(to, entry.name)
    if (entry.isDirectory) await copyDir(src, dst)
    else await Deno.copyFile(src, dst)
  }
}

const SCAFFOLD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>my imp app</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
`

const SCAFFOLD_APP =
  `import { mount, signal, div, h1, p, button, css, t, defineMessages } from './imp/imp.js'
import { stack, row, card } from './stdlib/index.js'

defineMessages('en', {
  title: 'Hello imp',
  clicks: { zero: 'No clicks yet', one: '{count} click', other: '{count} clicks' },
})

const page = css\`
  padding: var(--imp-space-32);
  font-family: var(--imp-font-family);
  color: var(--imp-color-text);
\`

function app() {
  const count = signal(0)
  return div({ class: page }, stack([
    h1(() => t('title')),
    card([
      p(() => t('clicks', { count: count() })),
      row([button({ events: { click: () => count.update((c) => c + 1) } }, '+1')]),
    ]),
  ]))
}

mount('#app', app)
`

const SCAFFOLD_TEST = `import { mount, fire } from './imp/testing.js'
import { assertEquals } from 'jsr:@std/assert@^1'
import { signal, button } from './imp/imp.js'

Deno.test('counter increments', () => {
  const count = signal(0)
  const view = mount(() => button({ events: { click: () => count.update((c) => c + 1) } }, '+1'))
  view.fire('button', 'click')
  assertEquals(count(), 1)
  view.unmount()
})
`

async function scaffold(dir) {
  if (!dir) {
    console.error('imp new: missing target directory')
    Deno.exit(1)
  }
  await Deno.mkdir(dir, { recursive: true })
  await copyDir(join(FRAMEWORK_ROOT, 'imp'), join(dir, 'imp'))
  await copyDir(join(FRAMEWORK_ROOT, 'stdlib'), join(dir, 'stdlib'))
  await Deno.writeTextFile(join(dir, 'index.html'), SCAFFOLD_HTML)
  await Deno.writeTextFile(join(dir, 'app.js'), SCAFFOLD_APP)
  await Deno.writeTextFile(join(dir, 'app_test.js'), SCAFFOLD_TEST)
  console.log(`imp new → ${dir}/
  index.html, app.js, app_test.js
  imp/ + stdlib/ vendored (buildless — edit and refresh)

  cd ${dir} && imp dev`)
}

const [cmd, ...rest] = Deno.args

switch (cmd) {
  case 'dev': {
    const { dev } = await import('./dev.js')
    await dev({ port: Number(flag(rest, 'port', 4507)) })
    break
  }
  case 'showcase': {
    const { dev } = await import('./dev.js')
    await dev({
      root: FRAMEWORK_ROOT,
      port: Number(flag(rest, 'port', 4508)),
      startPath: '/showcase/',
    })
    break
  }
  case 'test': {
    const args = rest.length ? rest : ['.']
    await run('test', ['-A', ...args])
    break
  }
  case 'lint': {
    // Inject the imp lint plugin unless the project config already has plugins.
    let hasPlugins = false
    try {
      const cfg = JSON.parse(await Deno.readTextFile('deno.json'))
      hasPlugins = !!cfg.lint?.plugins
    } catch { /* no project config */ }
    if (hasPlugins) {
      await run('lint', rest)
    } else {
      const tmp = await Deno.makeTempFile({ suffix: '.json' })
      await Deno.writeTextFile(
        tmp,
        JSON.stringify({
          lint: { plugins: [join(HERE, 'lint_plugin.js')] },
        }),
      )
      await run('lint', ['--config', tmp, ...rest])
    }
    break
  }
  case 'fmt':
    await run('fmt', rest)
    break
  case 'build': {
    const { build } = await import('./build.js')
    await build({ outdir: flag(rest, 'outdir', 'dist') })
    break
  }
  case 'new':
    await scaffold(rest[0])
    break
  default:
    console.log(HELP)
    if (cmd && cmd !== 'help' && cmd !== '--help') Deno.exit(1)
}
