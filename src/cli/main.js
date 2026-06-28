#!/usr/bin/env -S deno run -A
import { prepareConfig } from './config.js'

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
  case 'lint': {
    const { configPath } = await prepareConfig(Deno.cwd())
    await runDeno('lint', ['--config', configPath, ...rest])
    break
  }
  case 'fmt': {
    const { configPath } = await prepareConfig(Deno.cwd())
    await runDeno('fmt', ['--config', configPath, ...rest])
    break
  }
  default:
    console.log(HELP)
    if (command && command !== 'help' && command !== '--help') Deno.exit(1)
}
