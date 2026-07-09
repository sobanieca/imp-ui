#!/usr/bin/env -S deno run -A
import { VERSION } from './version.js'
import { projectRoot } from './config.js'
import { maybeDelegate, notifyUpdate, prune, update } from './version_manager.js'

const HELP = `imp — buildless UI toolkit

USAGE
  imp start [file.html] [--port 4507]   serve a page: imp auto-injected,
                     [--env <name>]     live reload, console + network → terminal
                                        (--env selects an "environments" entry
                                        from imp.json, exposed as import { env })
  imp build [file.html] [--outdir dist]   build the app for production: minified,
                                        code-split JS, ready to upload as-is
                                        ("targetImpHost": true in imp.json keeps
                                        imp imports for the host app to provide)
                     [--pwa]            also emit a PWA: web manifest, icon set,
                                        and an offline service worker (needs a
                                        "pwa" block in imp.json)
                     [--env <name>]     select an "environments" entry from imp.json
  imp install [package[@version]]       vendor a dependency into dependencies/
                                        (no version: latest · no package: update all)
  imp uninstall <package>               remove a vendored dependency
  imp test <file>                       run one test file: *.test.js unit in-process,
                                        *.spec.js e2e in a real browser
  imp test --unit | --e2e               run every file of that level, each in its own
                                        process, in parallel — passing files are summarized,
                                        failing files print their full output
                                        (--jobs <n> caps parallelism · --filter <text> ·
                                        --list prints the selected files as JSON ·
                                        --screenshots <dir> saves a screenshot per failed e2e test ·
                                        --video <dir> records each e2e spec as an animated GIF)
  imp resize <image> [-w <px>] [-h <px>]   shrink an oversized PNG/JPEG asset in place,
                     [--out <path>]     keeping aspect ratio (-w & -h: fit within that box ·
                     [--stretch]        --stretch: exact -w×-h, may distort ·
                                        neither -w nor -h: report current dimensions and
                                        size, plus a recommended resize command ·
                                        --out writes a copy instead of overwriting)
  imp lint [...paths] [--fix]           lint with imp rules (--fix applies autofixes)
  imp fmt [...paths]                    format source
  imp update [version] [--check]        update to the latest release (or a given version) and
                                        pin it in imp.json (--check only reports if one is available)
  imp prune                             delete cached imp versions unused for 30+ days
  imp licenses                          print third-party license notices for the bundled tools
  imp --version                         print the imp version this binary runs
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
  await maybeDelegate(Deno.args)
  switch (command) {
    case '--version':
    case '-v': {
      console.log(VERSION)
      break
    }
    case 'update': {
      const requested = positional(rest)[0] ?? null
      await update({
        root: Deno.cwd(),
        check: rest.includes('--check'),
        requestedVersion: requested,
      })
      break
    }
    case 'prune': {
      await prune()
      break
    }
    case 'start': {
      const { start } = await import('./start.js')
      notifyUpdate(rest)
      await start({
        entry: positional(rest)[0] ?? 'index.html',
        port: Number(flag(rest, 'port', 4507)),
        env: flag(rest, 'env', null),
      })
      break
    }
    case 'bundle': {
      throw new Error(
        "'imp bundle' has been renamed to 'imp build' — run 'imp build' instead",
      )
    }
    case 'build': {
      if (rest.includes('--external')) {
        throw new Error(
          '--external has been removed — set "targetImpHost": true in imp.json to keep imp imports for the host application to provide',
        )
      }
      const { build } = await import('./build.js')
      await build({
        entry: positional(rest)[0] ?? 'index.html',
        outdir: flag(rest, 'outdir', 'dist'),
        pwa: rest.includes('--pwa'),
        env: flag(rest, 'env', null),
      })
      break
    }
    case 'install': {
      const { install } = await import('./install.js')
      const positionals = positional(rest)
      await install({
        root: await projectRoot(Deno.cwd()),
        packageArg: positionals[0] ?? null,
        versionArg: positionals[1] ?? null,
        aliasArg: flag(rest, 'alias', null),
      })
      break
    }
    case 'uninstall': {
      const { uninstall } = await import('./install.js')
      await uninstall({ root: await projectRoot(Deno.cwd()), alias: positional(rest)[0] ?? null })
      break
    }
    case 'test': {
      const { runTests } = await import('./test.js')
      const booleanFlags = ['--list', '--unit', '--e2e']
      const args = rest.filter((arg) => !booleanFlags.includes(arg))
      const jobsArg = flag(rest, 'jobs', null)
      if (jobsArg !== null && !(Number(jobsArg) > 0)) {
        throw new Error(`--jobs must be a positive integer, got '${jobsArg}'`)
      }
      Deno.exit(
        await runTests({
          root: Deno.cwd(),
          paths: positional(args),
          list: rest.includes('--list'),
          unit: rest.includes('--unit'),
          e2e: rest.includes('--e2e'),
          jobs: jobsArg === null ? null : Math.floor(Number(jobsArg)),
          filter: flag(rest, 'filter', null),
          screenshotDir: flag(rest, 'screenshots', null),
          videoDir: flag(rest, 'video', null),
        }),
      )
      break
    }
    case 'resize': {
      const { resize } = await import('./resize.js')
      const valued = new Set(['-w', '--width', '-h', '--height', '--out'])
      const image = rest.find((arg, index) => {
        if (arg.startsWith('-')) return false
        const previous = rest[index - 1]
        return !(previous && valued.has(previous))
      }) ?? null
      const readDim = (short, long) => {
        const index = rest.findIndex((arg) => arg === short || arg === long)
        if (index === -1) return null
        const raw = rest[index + 1]
        const value = Number(raw)
        if (!raw || !Number.isInteger(value) || value <= 0) {
          throw new Error(`${long} must be a positive integer, got '${raw ?? ''}'`)
        }
        return value
      }
      await resize({
        root: await projectRoot(Deno.cwd()),
        image,
        width: readDim('-w', '--width'),
        height: readDim('-h', '--height'),
        out: flag(rest, 'out', null),
        stretch: rest.includes('--stretch'),
      })
      break
    }
    case 'licenses': {
      const { printLicenses } = await import('./licenses.js')
      await printLicenses()
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
  const { logger } = await import('./logger.js')
  logger.error(error.message)
  Deno.exit(1)
}
