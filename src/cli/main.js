#!/usr/bin/env -S deno run -A
const HELP = `imp — buildless UI toolkit

USAGE
  imp start [file.html] [--port 4507]   serve a page: imp auto-injected,
                                        live reload, console + network → terminal
  imp lint [...paths]                   lint with imp rules
  imp fmt [...paths]                    format source
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

const [command, ...rest] = Deno.args

try {
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
      const { lint } = await import('./lint.js')
      Deno.exit(await lint({ root: Deno.cwd(), paths: positional(rest) }))
      break
    }
    case 'fmt': {
      const { fmt } = await import('./fmt.js')
      const check = rest.includes('--check')
      const args = rest.filter((arg) => arg !== '--check')
      Deno.exit(await fmt({ root: Deno.cwd(), paths: positional(args), check }))
      break
    }
    default:
      console.log(HELP)
      if (command && command !== 'help' && command !== '--help') Deno.exit(1)
  }
} catch (error) {
  console.error(`error: ${error.message}`)
  Deno.exit(1)
}
