import { join } from '@std/path'
import {
  ensureVersion,
  maybeDelegate,
  notifyUpdate,
  prune,
  resolveLatestVersion,
  update,
} from '../src/version-manager.js'
import { VERSION } from '../src/version.js'
import { check, tempDir } from './helpers.js'

const EXECUTABLE = Deno.build.os === 'windows' ? 'imp.exe' : 'imp'

const DAY = 24 * 60 * 60 * 1000

const sha256Hex = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')

const exists = (path) => Deno.stat(path).then(() => true, () => false)

const withEnv = async (values, run) => {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, Deno.env.get(key)]))
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) Deno.env.delete(key)
    else Deno.env.set(key, value)
  }
  try {
    return await run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

const withFetch = async (answer, run) => {
  const original = globalThis.fetch
  const requests = []
  globalThis.fetch = (input) => {
    const url = String(input?.url ?? input)
    requests.push(url)
    return Promise.resolve(answer(url))
  }
  try {
    await run(requests)
  } finally {
    globalThis.fetch = original
  }
}

const withConsole = async (run) => {
  const lines = []
  const { log, error } = console
  console.log = (...args) => lines.push(args.join(' '))
  console.error = (...args) => lines.push(args.join(' '))
  try {
    await run(lines)
  } finally {
    console.log = log
    console.error = error
  }
}

const withCache = async (run) => {
  const cache = await tempDir()
  try {
    await withEnv({ IMP_CACHE_DIR: cache }, () => run(cache))
  } finally {
    await Deno.remove(cache, { recursive: true })
  }
}

const releaseServer = async (bytes, { checksum = null } = {}) => {
  const digest = checksum ?? await sha256Hex(bytes)
  return (url) => {
    if (url.endsWith('.sha256')) return new Response(`${digest}  imp\n`)
    if (url.includes('/releases/download/v9.9.9/')) return new Response(bytes)
    return new Response('not found', { status: 404 })
  }
}

Deno.test('ensureVersion accepts only an exact version', async () => {
  for (const version of ['latest', '1.2', '^1.2.3', 7]) {
    let message = ''
    await ensureVersion(version).catch((error) => message = error.message)
    check(message.includes('is not an exact imp version'), `'${version}' gave '${message}'`)
  }
})

Deno.test('ensureVersion downloads a verified binary once, then reuses it', async () => {
  await withCache(async (cache) => {
    const bytes = new TextEncoder().encode('imp 9.9.9 binary')
    await withConsole(async () => {
      await withFetch(await releaseServer(bytes), async (requests) => {
        const path = await ensureVersion('9.9.9')
        check(path === join(cache, 'versions', '9.9.9', EXECUTABLE), `unexpected path ${path}`)
        check(await Deno.readTextFile(path) === 'imp 9.9.9 binary', 'the binary is stored')
        check(requests.length === 2, `the first call fetches binary and checksum: ${requests}`)
        check(
          requests[1] === `${requests[0]}.sha256`,
          'the checksum comes from the same release as the binary',
        )
        check(await ensureVersion('9.9.9') === path, 'the second call returns the cached binary')
        check(requests.length === 2, 'the second call fetches nothing')
      })
    })
  })
})

Deno.test('ensureVersion refuses a binary whose checksum does not match', async () => {
  await withCache(async (cache) => {
    const bytes = new TextEncoder().encode('tampered')
    await withConsole(async () => {
      await withFetch(await releaseServer(bytes, { checksum: 'a'.repeat(64) }), async () => {
        let message = ''
        await ensureVersion('9.9.9').catch((error) => message = error.message)
        check(message.includes('failed checksum verification'), `unexpected '${message}'`)
      })
    })
    check(
      !await exists(join(cache, 'versions', '9.9.9', EXECUTABLE)),
      'a binary that fails verification is not stored',
    )
  })
})

Deno.test('ensureVersion names the status of a release that is missing', async () => {
  await withCache(async () => {
    await withConsole(async () => {
      await withFetch(() => new Response('gone', { status: 404 }), async () => {
        let message = ''
        await ensureVersion('9.9.8').catch((error) => message = error.message)
        check(message.includes('responded 404'), `unexpected '${message}'`)
      })
    })
  })
})

Deno.test('resolveLatestVersion reads tag_name without the leading v', async () => {
  await withFetch(() => Response.json({ tag_name: 'v4.5.6' }), async (requests) => {
    check(await resolveLatestVersion() === '4.5.6', 'the v prefix is removed')
    check(requests[0].endsWith('/releases/latest'), `unexpected request ${requests[0]}`)
  })
  await withFetch(() => new Response('rate limited', { status: 403 }), async () => {
    let message = ''
    await resolveLatestVersion().catch((error) => message = error.message)
    check(message.includes('GitHub responded 403'), `unexpected '${message}'`)
  })
  await withFetch(() => Response.json({}), async () => {
    let message = ''
    await resolveLatestVersion().catch((error) => message = error.message)
    check(message.includes('no tag_name'), `unexpected '${message}'`)
  })
})

Deno.test('prune removes only the versions unused for over 30 days', async () => {
  await withCache(async (cache) => {
    const install = async (version, lastUsed) => {
      const dir = join(cache, 'versions', version)
      await Deno.mkdir(dir, { recursive: true })
      await Deno.writeTextFile(join(dir, EXECUTABLE), 'binary')
      await Deno.writeTextFile(join(dir, 'lastUsed'), new Date(lastUsed).toISOString())
    }
    await install('0.0.1', Date.now() - 40 * DAY)
    await install('0.0.2', Date.now() - 2 * DAY)
    await install(VERSION, Date.now() - 90 * DAY)
    await withConsole(async (lines) => {
      await prune()
      check(lines.includes('removed imp 0.0.1'), `unexpected output ${lines}`)
      check(lines.some((line) => line.startsWith('pruned 1 unused version')), `${lines}`)
    })
    check(!await exists(join(cache, 'versions', '0.0.1')), 'the stale version is removed')
    check(await exists(join(cache, 'versions', '0.0.2')), 'a recent version is kept')
    check(await exists(join(cache, 'versions', VERSION)), 'the running version is kept')
    await withConsole(async (lines) => {
      await prune()
      check(lines[0].startsWith('no unused imp versions to prune'), `unexpected ${lines}`)
    })
  })
})

Deno.test('update --check compares the latest release with the running version', async () => {
  await withConsole(async (lines) => {
    await update({ root: Deno.cwd(), check: true, requestedVersion: '999.0.0' })
    await update({ root: Deno.cwd(), check: true, requestedVersion: '0.0.0' })
    check(lines[0].startsWith('imp 999.0.0 is available'), `unexpected ${lines[0]}`)
    check(lines[1] === `imp ${VERSION} is up to date`, `unexpected ${lines[1]}`)
  })
})

Deno.test('update downloads the version and pins it in the imp.json of the project', async () => {
  await withCache(async () => {
    const project = await tempDir()
    try {
      await Deno.mkdir(join(project, '.git'))
      await Deno.writeTextFile(join(project, 'imp.json'), '{\n  "version": "0.0.1"\n}\n')
      const bytes = new TextEncoder().encode('imp 9.9.9 binary')
      await withConsole(async (lines) => {
        await withFetch(await releaseServer(bytes), async () => {
          await update({ root: project, requestedVersion: '9.9.9' })
        })
        check(
          lines.some((line) => line.startsWith('imp updated 0.0.1 -> 9.9.9')),
          `unexpected output ${lines}`,
        )
      })
      const pinned = JSON.parse(await Deno.readTextFile(join(project, 'imp.json')))
      check(pinned.version === '9.9.9', `the pin is ${pinned.version}`)
    } finally {
      await Deno.remove(project, { recursive: true })
    }
  })
})

Deno.test('maybeDelegate removes IMP_DELEGATED, so a child process does not inherit it', async () => {
  await withCache(async () => {
    await withEnv({ IMP_DELEGATED: '1' }, async () => {
      await maybeDelegate([])
      check(Deno.env.get('IMP_DELEGATED') === undefined, 'IMP_DELEGATED is still set')
    })
  })
})

Deno.test('notifyUpdate never asks GitHub when the check is turned off', async () => {
  await withFetch(() => Response.json({ tag_name: 'v999.0.0' }), async (requests) => {
    await withConsole(async (lines) => {
      await notifyUpdate(['--no-update-check'])
      await withEnv({ IMP_NO_UPDATE_CHECK: '1' }, () => notifyUpdate([]))
      await withEnv({ IMP_VERSION: 'system' }, () => notifyUpdate([]))
      check(lines.length === 0, `unexpected output ${lines}`)
    })
    check(requests.length === 0, `unexpected requests ${requests}`)
  })
})
