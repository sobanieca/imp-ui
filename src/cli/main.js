#!/usr/bin/env -S deno run -A
const HELP = `imp — buildless UI toolkit

USAGE
  imp start [file.html] [--port 4507]   serve a page: imp auto-injected,
                                        live reload, console + network → terminal
  imp bundle [file.html] [--outdir dist]  build the app for production: minified,
                                        code-split JS, ready to upload as-is
                                        ("targetImpHost": true in imp.json keeps
                                        imp imports for the host app to provide)
  imp install [package[@version]]       vendor a dependency into dependencies/
                                        (no version: latest · no package: update all)
  imp uninstall <package>               remove a vendored dependency
  imp lint [...paths] [--fix]           lint with imp rules (--fix applies autofixes)
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
    case 'bundle': {
      if (rest.includes('--external')) {
        throw new Error(
          '--external has been removed — set "targetImpHost": true in imp.json to keep imp imports for the host application to provide',
        )
      }
      const { bundle } = await import('./bundle.js')
      await bundle({
        entry: positional(rest)[0] ?? 'index.html',
        outdir: flag(rest, 'outdir', 'dist'),
      })
      break
    }
    case 'install': {
      const { install } = await import('./install.js')
      const positionals = positional(rest)
      await install({
        root: Deno.cwd(),
        packageArg: positionals[0] ?? null,
        versionArg: positionals[1] ?? null,
        aliasArg: flag(rest, 'alias', null),
      })
      break
    }
    case 'uninstall': {
      const { uninstall } = await import('./install.js')
      await uninstall({ root: Deno.cwd(), alias: positional(rest)[0] ?? null })
      break
    }
    case 'lint': {
      const { lint } = await import('./lint.js')
      const fix = rest.includes('--fix')
      const args = rest.filter((arg) => arg !== '--fix')
      Deno.exit(await lint({ root: Deno.cwd(), paths: positional(args), fix }))
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
