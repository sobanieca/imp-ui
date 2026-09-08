#!/usr/bin/env -S deno run -A
import { VERSION } from './version.js'
import { projectRoot } from './config.js'
import { maybeDelegate, notifyUpdate, prune, update } from './version-manager.js'

const HELP = `imp - buildless UI toolkit

USAGE
  imp init [dir] [--pwa]                scaffold a runnable project: a page, a counter
                                        component, a unit test and an e2e spec
                                        (no dir: here | --pwa: installable, offline-ready)
  imp start [file.html] [--port 4507]   serve a page: imp auto-injected,
                     [--env <name>]     live reload, console + network -> terminal
                                        (--env selects an "environments" entry
                                        from imp.json, exposed as import { env })
                     [--mock]           answer requests from the *.mock.js files in
                     [--no-mock]        the "mocks" folder instead of the network
                                        (--no-mock forces a run against the real API)
  imp build [file.html] [--output dist]   build the app for production: minified,
                                        code-split JS, ready to upload as-is
                                        ("targetImpHost": true in imp.json keeps
                                        imp imports for the host app to provide)
                     [--pwa]            also emit a PWA: web manifest, icon set,
                                        and an offline service worker (needs a
                                        "pwa" block in imp.json)
                     [--env <name>]     select an "environments" entry from imp.json
  imp preview [path] [--port 4517]      preview components in isolation: each *.preview.js
                     [--env <name>]     file renders its named exports as labeled, drag-resizable
                     [--list] [--json]  stages with a live state editor (no path: every preview,
                     [--mock]           listed on an index page | --list prints what was found |
                     [--no-mock]        --mock serves the "mocks" folder to previewed components)
  imp review [clear]                    list what was written from the browser by the review
                                        widget the dev server puts on every page - the page,
                                        the element picked and the comment left on it
                                        (clear: delete every saved review)
  imp install [package[@version]]       vendor a dependency into dependencies/
                                        (no version: latest | no package: update all)
  imp uninstall <package>               remove a vendored dependency
  imp test <file>                       run one test file: *.test.js unit in-process,
                                        *.spec.js e2e in a real browser
  imp test --unit | --e2e               run every file of that level, each in its own
                                        process, in parallel - passing files are summarized,
                                        failing files print their full output
                                        (--jobs <n> caps parallelism | --filter <text> |
                                        --list prints the selected files as JSON |
                                        --screenshots <dir> saves a screenshot per failed e2e test |
                                        --video <dir> records each e2e spec as an animated GIF |
                                        --mock / --no-mock: serve the "mocks" folder to e2e specs)
  imp resize <image> [-w <px>] [-h <px>]   shrink an oversized PNG/JPEG asset in place,
                     [--output <path>]  keeping aspect ratio (-w & -h: fit within that box |
                     [--stretch]        --stretch: exact -wx-h, may distort |
                                        neither -w nor -h: report current dimensions and
                                        size, plus a recommended resize command |
                                        --output writes a copy instead of overwriting)
  imp lint [...paths] [--fix]           lint with imp rules (--fix applies autofixes)
  imp fmt [...paths]                    format source
  imp map [file]                        print the application map of the app: every
                                        node with its path, label, access and
                                        description (the 'map' file of imp.json)
  imp skill [...subject]                print imp's usage manual for a subject -
             [./component.js]           the documentation shipped inside this binary,
                                        written to be read before writing imp code
                                        (a path prints that component's own skill,
                                        from the .skill.md file next to it |
                                        no argument: an index of everything there is)
  imp update [version] [--check]        update to the latest release (or a given version) and
                                        pin it in imp.json (--check only reports if one is available)
  imp prune                             delete cached imp versions unused for 30+ days
  imp licenses                          print third-party license notices for the bundled tools
  imp --version                         print the imp version this binary runs

If you are an AI agent, run 'imp skill' to learn more about imp before writing any code.
`

function flag(args, name, fallback) {
  const index = args.indexOf('--' + name)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

function portFlag(args) {
  const raw = flag(args, 'port', null)
  if (raw === null) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error(`--port must be an integer between 0 and 65535, got '${raw}'`)
  }
  return value
}

const MOCK_FLAGS = ['--mock', '--no-mock']

function mockFlag(args) {
  let chosen = null
  for (const arg of args) {
    if (arg === '--mock') chosen = true
    else if (arg === '--no-mock') chosen = false
  }
  return chosen
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
    case 'init': {
      const { init } = await import('./init.js')
      await init({
        cwd: Deno.cwd(),
        dir: positional(rest.filter((arg) => arg !== '--pwa'))[0] ?? null,
        pwa: rest.includes('--pwa'),
      })
      break
    }
    case 'start': {
      const { start } = await import('./start.js')
      notifyUpdate(rest)
      await start({
        entry: positional(rest.filter((arg) => !MOCK_FLAGS.includes(arg)))[0] ?? 'index.html',
        port: portFlag(rest),
        env: flag(rest, 'env', null),
        mocks: mockFlag(rest),
      })
      break
    }
    case 'preview': {
      const { preview } = await import('./preview.js')
      notifyUpdate(rest)
      const booleanFlags = ['--list', '--json', ...MOCK_FLAGS]
      const args = rest.filter((arg) => !booleanFlags.includes(arg))
      await preview({
        root: await projectRoot(Deno.cwd()),
        paths: positional(args),
        port: portFlag(rest),
        env: flag(rest, 'env', null),
        list: rest.includes('--list'),
        json: rest.includes('--json'),
        mocks: mockFlag(rest),
      })
      break
    }
    case 'review': {
      const { review } = await import('./review.js')
      await review({ root: await projectRoot(Deno.cwd()), args: positional(rest) })
      break
    }
    case 'build': {
      const { build } = await import('./build.js')
      await build({
        entry: positional(rest)[0] ?? 'index.html',
        output: flag(rest, 'output', 'dist'),
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
      const booleanFlags = ['--list', '--unit', '--e2e', ...MOCK_FLAGS]
      const args = rest.filter((arg) => !booleanFlags.includes(arg))
      const jobsArg = flag(rest, 'jobs', null)
      if (jobsArg !== null && !(Number(jobsArg) > 0)) {
        throw new Error(`--jobs must be a positive integer, got '${jobsArg}'`)
      }
      const code = await runTests({
        root: Deno.cwd(),
        paths: positional(args),
        list: rest.includes('--list'),
        unit: rest.includes('--unit'),
        e2e: rest.includes('--e2e'),
        jobs: jobsArg === null ? null : Math.floor(Number(jobsArg)),
        filter: flag(rest, 'filter', null),
        screenshotDir: flag(rest, 'screenshots', null),
        videoDir: flag(rest, 'video', null),
        mocks: mockFlag(rest),
      })
      await notifyUpdate(rest)
      Deno.exit(code)
      break
    }
    case 'resize': {
      const { resize } = await import('./resize.js')
      const valued = new Set(['-w', '--width', '-h', '--height', '--output'])
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
        output: flag(rest, 'output', null),
        stretch: rest.includes('--stretch'),
      })
      break
    }
    case 'map': {
      const { printMap } = await import('./map.js')
      await printMap({ cwd: Deno.cwd(), file: positional(rest)[0] ?? null })
      break
    }
    case 'skill': {
      const { printSkill } = await import('./skill.js')
      await printSkill({
        subjects: positional(rest),
        root: await projectRoot(Deno.cwd()),
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
      const code = await lint({ root: Deno.cwd(), paths: positional(args), fix })
      await notifyUpdate(rest)
      Deno.exit(code)
      break
    }
    case 'fmt': {
      const { fmt } = await import('./fmt.js')
      const check = rest.includes('--check')
      const args = rest.filter((arg) => arg !== '--check')
      const code = await fmt({ root: Deno.cwd(), paths: positional(args), check })
      await notifyUpdate(rest)
      Deno.exit(code)
      break
    }
    default:
      console.log(HELP)
      if (command && command !== 'help' && command !== '--help') Deno.exit(1)
  }
  if (command !== 'update') await notifyUpdate(rest)
} catch (error) {
  const { logger } = await import('./logger.js')
  logger.error(error.message)
  Deno.exit(1)
}
