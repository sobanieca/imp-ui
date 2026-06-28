#!/usr/bin/env -S deno run -A
import { dirname, fromFileUrl, join } from '@std/path'

const HERE = dirname(fromFileUrl(import.meta.url))

const HELP = `imp — buildless UI toolkit

USAGE
  imp start [file.html] [--port 4507]   serve a page: imp auto-injected,
                                        live reload, console + network → terminal
  imp lint [...paths]                   deno lint + imp rules
  imp fmt [...paths]                    deno fmt
`

function flag(args, name, fallback) {
  const index = args.indexOf('--' + name)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

function positional(args) {
  return args.filter((arg, index) => {
    if (arg.startsWith('--')) return false
    const previous = args[index - 1]
    return !(previous && previous.startsWith('--'))
  })
}

async function runDeno(subcommand, args) {
  const child = new Deno.Command(Deno.execPath(), {
    args: [subcommand, ...args],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn()
  const status = await child.status
  Deno.exit(status.code)
}

async function lint(args) {
  let hasProjectPlugins = false
  try {
    const config = JSON.parse(await Deno.readTextFile('deno.json'))
    hasProjectPlugins = Array.isArray(config.lint?.plugins) && config.lint.plugins.length > 0
  } catch { /* no project config */ }
  if (hasProjectPlugins) {
    await runDeno('lint', args)
    return
  }
  const tempConfig = await Deno.makeTempFile({ suffix: '.json' })
  await Deno.writeTextFile(
    tempConfig,
    JSON.stringify({ lint: { plugins: [join(HERE, 'lint_plugin.js')] } }),
  )
  await runDeno('lint', ['--config', tempConfig, ...args])
}

const [command, ...rest] = Deno.args

switch (command) {
  case 'start': {
    const { start } = await import('./start.js')
    await start({
      entry: positional(rest)[0] ?? 'index.html',
      port: Number(flag(rest, 'port', 4507)),
    })
    break
  }
  case 'lint':
    await lint(rest)
    break
  case 'fmt':
    await runDeno('fmt', rest)
    break
  default:
    console.log(HELP)
    if (command && command !== 'help' && command !== '--help') Deno.exit(1)
}
