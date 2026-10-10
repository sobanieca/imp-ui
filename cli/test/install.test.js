import { basename, join, toFileUrl } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import { assertSnapshot } from './snapshot.js'
import {
  auditedPackages,
  auditReport,
  describeVulnerability,
  knownVulnerabilityIds,
  osvClient,
  osvQuery,
  retryDelay,
} from '../src/audit.js'
import {
  bundledFileProblem,
  matchesIntegrity,
  registrySignatureProblem,
  signatureFromDer,
  sriDigest,
  strongestSri,
  tarballFiles,
} from '../src/integrity.js'
import { commitDependencies, componentSkill, projectFileSystem } from '../src/install.js'
import {
  check,
  commandTranscript,
  listFiles,
  normalize,
  REPO_ROOT,
  runImp,
  section,
  tempDir,
  withoutDownloadNoise,
} from './helpers.js'

Deno.test('imp install and uninstall', async (t) => {
  const dir = await tempDir()

  const maskLatest = (text) =>
    text
      .replace(/@\d+\.\d+\.\d+([-+][\w.-]+)?/g, '@<latest>')
      .replace(/\(\d+(\.\d+)? k?B\)/g, '(<size>)')

  const projectState = async () => {
    const files = []
    const walk = async (directory, prefix) => {
      for await (const entry of Deno.readDir(directory)) {
        if (entry.isDirectory) await walk(join(directory, entry.name), `${prefix}${entry.name}/`)
        else files.push(prefix + entry.name)
      }
    }
    await walk(join(dir, 'dependencies'), 'dependencies/').catch(() => {})
    files.sort()
    const impJson = await Deno.readTextFile(join(dir, 'imp.json')).catch(() => '(missing)')
    return `\n${section('files', files.join('\n'))}\n\n${section('imp.json', impJson)}\n`
  }

  const test = async (name, args, { state = true, mask = (text) => text } = {}) => {
    await t.step(name, async () => {
      const result = withoutDownloadNoise(await runImp(args, dir))
      const transcript = commandTranscript(`imp ${args.join(' ')}  (cwd: <tmp>)`, result)
      const suffix = state ? await projectState() : ''
      await assertSnapshot(name, mask(transcript + suffix))
    })
  }

  try {
    await t.step('install-nothing-declared', async () => {
      const empty = await tempDir()
      const result = withoutDownloadNoise(await runImp(['install'], empty))
      await Deno.remove(empty, { recursive: true })
      await assertSnapshot(
        'install-nothing-declared',
        commandTranscript('imp install  (cwd: <tmp>)', result),
      )
    })

    await test('install-pinned-npm', ['install', 'mitt@3.0.1'])
    await test('install-alias-flag', ['install', 'mitt', '3.0.1', '--alias', 'bus'])

    await t.step('install-jsr-subpath', async () => {
      const result = withoutDownloadNoise(
        await runImp(['install', 'jsr:@std/encoding@1.0.10/base64'], dir),
      )
      const module = await import(toFileUrl(join(dir, 'dependencies', 'base64', 'base64.js')).href)
      const usage = `[vendored module: encodeBase64('imp') returned '${
        module.encodeBase64('imp')
      }']`
      await assertSnapshot(
        'install-jsr-subpath',
        `${
          commandTranscript(
            'imp install jsr:@std/encoding@1.0.10/base64  (cwd: <tmp>)',
            result,
          )
        }\n${usage}\n${await projectState()}`,
      )
    })

    await test('uninstall-removes-dependency', ['uninstall', 'bus'])
    await test('install-update-all', ['install'], { mask: maskLatest })
    await test('install-imp-package-rejected', ['install', 'imp'], { state: false })
    await test('install-imp-alias-rejected', ['install', 'mitt', '3.0.1', '--alias', 'imp'], {
      state: false,
    })

    await t.step('install-imp-alias-declared', async () => {
      const declared = await tempDir()
      await Deno.writeTextFile(
        join(declared, 'imp.json'),
        '{ "dependencies": { "imp": "npm:imp@1.0.1" } }\n',
      )
      const result = withoutDownloadNoise(await runImp(['install'], declared))
      await Deno.remove(declared, { recursive: true })
      await assertSnapshot(
        'install-imp-alias-declared',
        commandTranscript('imp install  (cwd: <tmp>)', result),
      )
    })

    await t.step('install-all-or-nothing', async () => {
      const project = await tempDir()
      const config =
        '{ "dependencies": { "mitt": "npm:mitt@3.0.1", "zzz": "npm:imp-test-no-such-package-404@1.0.0" } }\n'
      await Deno.writeTextFile(join(project, 'imp.json'), config)
      const result = withoutDownloadNoise(await runImp(['install'], project))
      const folder = await Deno.stat(join(project, 'dependencies')).then(() => true).catch(() =>
        false
      )
      const unchanged = await Deno.readTextFile(join(project, 'imp.json')) === config
      await Deno.remove(project, { recursive: true })
      await assertSnapshot(
        'install-all-or-nothing',
        `${commandTranscript('imp install  (cwd: <tmp>, the second package fails)', result)}\n` +
          `[dependencies/ written: ${folder}]\n[imp.json unchanged: ${unchanged}]\n`,
      )
    })

    await test('install-unknown-package', ['install', 'imp-test-no-such-package-404'], {
      state: false,
    })
    await test('install-range-version-rejected', ['install', 'mitt@^3'], { state: false })
    await test('uninstall-undeclared', ['uninstall', 'lodash'], { state: false })
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp install license policy', async (t) => {
  const withPolicy = async (name, licenses, args) => {
    await t.step(name, async () => {
      const dir = await tempDir()
      await Deno.writeTextFile(
        join(dir, 'imp.json'),
        `${JSON.stringify({ licenses }, null, 2)}\n`,
      )
      const result = withoutDownloadNoise(await runImp(args, dir))
      const wrote = await Deno.stat(join(dir, 'dependencies')).then(() => 'yes').catch(() => 'no')
      await Deno.remove(dir, { recursive: true })
      await assertSnapshot(
        name,
        `${
          commandTranscript(`imp ${args.join(' ')}  (cwd: <tmp>)`, result)
        }\n--- wrote dependencies/ ---\n${wrote}\n`,
      )
    })
  }

  await withPolicy('license-permissive-blocks-weak-copyleft', 'permissive', [
    'install',
    'axe-core@4.8.2',
  ])
  await withPolicy('license-weak-copyleft-allows-mpl', 'weak-copyleft', [
    'install',
    'axe-core@4.8.2',
  ])
  await withPolicy('license-allow-list-blocks-apache', ['MIT', 'ISC'], ['install', 'long@5.2.3'])
  await withPolicy('license-or-expression-takes-permissive-branch', 'permissive', [
    'install',
    'node-forge@0.7.0',
  ])
  await withPolicy('license-unknown-warns-only', 'permissive', [
    'install',
    'jsr:@std/encoding@1.0.10/base64',
  ])
  await withPolicy('license-invalid-policy-value', 'mostly-fine', ['install', 'mitt@3.0.1'])
})

const auditManifests = [
  {
    alias: 'forge',
    specifier: 'npm:node-forge@0.7.0',
    installedAt: '2026-09-01T10:00:00Z',
    impImports: [],
    packages: [{
      registry: 'npm',
      name: 'node-forge',
      version: '0.7.0',
      integrity:
        'sha512-nrGmJHbnyl7LfZyHbcgNyi0yHawEXOAnWYnw/3MJKJ7vyS2NcTqs5+sI4xcaivd6kjoUwnkD53FFRHC7m2FH4A==',
      attestationListed: false,
      license: '(BSD-3-Clause OR GPL-2.0)',
      licenseText: '...',
    }],
  },
  {
    alias: 'base64',
    specifier: 'jsr:@std/encoding@1.0.10/base64',
    installedAt: '2026-09-01T10:00:00Z',
    impImports: [],
    packages: [{
      registry: 'jsr',
      name: '@std/encoding',
      version: '1.0.10',
      integrity: null,
      attestationListed: true,
      license: null,
      licenseText: '...',
    }],
  },
  {
    alias: 'ng',
    specifier: 'npm:@angular/core@17.0.0',
    installedAt: '2026-09-01T10:00:00Z',
    impImports: [],
    packages: [{
      registry: 'npm',
      name: '@angular/core',
      version: '17.0.0',
      integrity: null,
      attestationListed: false,
      license: 'SEE LICENSE IN LICENSE.md',
      licenseText: null,
    }],
  },
]

Deno.test('imp audit reports the known vulnerabilities of a package', async () => {
  const packages = auditedPackages(auditManifests)
  const forge = packages.find((entry) => entry.name === 'node-forge')
  const advisory = {
    id: 'GHSA-5rrq-pxf6-6jx5',
    summary: 'Prototype Pollution in node-forge debug API.',
    database_specific: { severity: 'LOW' },
    affected: [{
      package: { name: 'node-forge', ecosystem: 'npm' },
      ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.0.0' }] }],
    }, {
      package: { name: 'node-forge', ecosystem: 'npm' },
      ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '0.10.0' }] }],
    }],
  }
  const unfixed = { id: 'GHSA-xxxx-yyyy-zzzz', details: 'A second problem.\nMore text.' }
  const affected = auditReport(
    [{
      entry: forge,
      vulnerabilities: [
        describeVulnerability(advisory, forge),
        describeVulnerability(unfixed, forge),
      ],
    }],
    packages.filter((entry) => entry.registry === 'jsr'),
  )
  const clean = auditReport([{ entry: forge, vulnerabilities: [] }], [])
  await assertSnapshot(
    'audit-report',
    `--- query ---\n${
      JSON.stringify(osvQuery(forge))
    }\n\n--- vulnerable (${affected.vulnerable}) ---\n${affected.text}\n\n--- clean (${clean.vulnerable}) ---\n${clean.text}\n`,
  )
})

const osvResponse = (status, body = {}, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers })

Deno.test('imp audit follows every page of the OSV results', async () => {
  const requests = []
  const pages = {
    'forge-2': { vulns: [{ id: 'GHSA-2' }], next_page_token: 'forge-3' },
    'forge-3': { vulns: [{ id: 'GHSA-3' }] },
    'wide-2': { vulns: [{ id: 'GHSA-9' }] },
  }
  const send = (url, init) => {
    const { queries } = JSON.parse(init.body)
    requests.push(
      `${new URL(url).pathname} ${
        queries.map((query) => `${query.package.name}:${query.page_token ?? '-'}`).join(',')
      }`,
    )
    if (!queries[0].page_token) {
      return osvResponse(200, {
        results: [
          { vulns: [{ id: 'GHSA-1' }], next_page_token: 'forge-2' },
          {},
          { vulns: [{ id: 'GHSA-8' }], next_page_token: 'wide-2' },
        ],
      })
    }
    return osvResponse(200, { results: queries.map((query) => pages[query.page_token]) })
  }
  const ids = await knownVulnerabilityIds(
    [
      { name: 'forge', version: '1.0.0' },
      { name: 'calm', version: '2.0.0' },
      { name: 'wide', version: '3.0.0' },
    ],
    osvClient({ send, sleep: () => Promise.resolve() }),
  )
  check(
    JSON.stringify(ids) ===
      JSON.stringify([['GHSA-1', 'GHSA-2', 'GHSA-3'], [], ['GHSA-8', 'GHSA-9']]),
    `the pages were not joined: ${JSON.stringify(ids)}`,
  )
  check(
    requests.join(' | ') ===
      '/v1/querybatch forge:-,calm:-,wide:- | /v1/querybatch forge:forge-2,wide:wide-2 | ' +
        '/v1/querybatch forge:forge-3',
    `unexpected requests: ${requests.join(' | ')}`,
  )
})

Deno.test('imp audit fails when OSV answers fewer results than it was asked', async () => {
  const send = () => Promise.resolve(osvResponse(200, { results: [{}] }))
  const error = await knownVulnerabilityIds(
    [{ name: 'forge', version: '1.0.0' }, { name: 'calm', version: '2.0.0' }],
    osvClient({ send, sleep: () => Promise.resolve() }),
  ).then(() => null, (thrown) => thrown)
  check(
    error?.message === 'the OSV database answered 2 queries with 1 results',
    `a short answer was not refused: ${error?.message}`,
  )
})

Deno.test('imp audit retries OSV after a rate limit or a server error', async () => {
  const waits = []
  const sleep = (ms) => {
    waits.push(ms)
    return Promise.resolve()
  }
  const answers = [
    osvResponse(429, {}, { 'retry-after': '7' }),
    osvResponse(503),
    osvResponse(200, { id: 'GHSA-1' }),
  ]
  const recovered = await osvClient({ send: () => Promise.resolve(answers.shift()), sleep })
    .get('/vulns/GHSA-1')
  check(recovered.id === 'GHSA-1', `the retry did not return the answer: ${recovered.id}`)
  check(
    JSON.stringify(waits) === '[7000,2000]',
    `the waits did not follow Retry-After, then the backoff: ${waits}`,
  )

  let calls = 0
  const busy = () => {
    calls++
    return Promise.resolve(osvResponse(500))
  }
  const gaveUp = await osvClient({ send: busy, sleep: () => Promise.resolve() })
    .get('/vulns/GHSA-1').then(() => null, (error) => error.message)
  check(calls === 4, `a server that always fails got ${calls} requests, not 4`)
  check(
    gaveUp ===
      'the OSV database did not answer - https://api.osv.dev/v1/vulns/GHSA-1 responded 500',
    `unexpected message: ${gaveUp}`,
  )

  calls = 0
  const refused = () => {
    calls++
    return Promise.resolve(osvResponse(400))
  }
  await osvClient({ send: refused, sleep: () => Promise.resolve() }).get('/vulns/x').catch(() => {})
  check(calls === 1, `a 400 answer was retried ${calls - 1} times`)

  const now = Date.parse('2026-09-01T10:00:00Z')
  const delays = [
    retryDelay('3', 0, now),
    retryDelay('Tue, 01 Sep 2026 10:00:12 GMT', 0, now),
    retryDelay('Tue, 01 Sep 2026 09:00:00 GMT', 0, now),
    retryDelay(null, 2, now),
    retryDelay('3600', 0, now),
  ]
  check(
    JSON.stringify(delays) === '[3000,12000,0,4000,60000]',
    `unexpected delays: ${delays}`,
  )
})

Deno.test('imp audit --sbom writes a CycloneDX bill of materials', async () => {
  const dir = await tempDir({ prefix: 'audit-app-' })
  try {
    await Deno.writeTextFile(
      join(dir, 'imp.json'),
      `${
        JSON.stringify(
          { dependencies: Object.fromEntries(auditManifests.map((m) => [m.alias, m.specifier])) },
          null,
          2,
        )
      }\n`,
    )
    for (const manifest of auditManifests) {
      await Deno.mkdir(join(dir, 'dependencies', manifest.alias), { recursive: true })
      await Deno.writeTextFile(
        join(dir, 'dependencies', manifest.alias, 'manifest.json'),
        JSON.stringify(manifest),
      )
    }
    const result = await runImp(['audit', '--sbom'], dir)
    const bom = (await Deno.readTextFile(join(dir, 'sbom.cdx.json')))
      .replace(/"urn:uuid:[0-9a-f-]+"/, '"urn:uuid:<random>"')
      .replace(/"timestamp": "[^"]+"/, '"timestamp": "<now>"')
      .replaceAll(basename(dir), '<app>')
    const empty = await tempDir()
    await Deno.writeTextFile(join(empty, 'imp.json'), '{}\n')
    const nothing = await runImp(['audit'], empty)
    await Deno.remove(empty, { recursive: true })
    await assertSnapshot(
      'audit-sbom',
      `${commandTranscript('imp audit --sbom  (cwd: <tmp>)', result)}\n--- sbom.cdx.json ---\n${
        normalize(bom)
      }\n${commandTranscript('imp audit  (cwd: <tmp with no dependencies>)', nothing)}`,
    )
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('imp audit fails when a dependency has no manifest', async () => {
  const dir = await tempDir()
  try {
    await Deno.writeTextFile(
      join(dir, 'imp.json'),
      '{ "dependencies": { "forge": "npm:node-forge@0.7.0", "ng": "npm:@angular/core@17.0.0" } }\n',
    )
    await Deno.mkdir(join(dir, 'dependencies', 'forge'), { recursive: true })
    await Deno.writeTextFile(
      join(dir, 'dependencies', 'forge', 'manifest.json'),
      JSON.stringify(auditManifests[0]),
    )
    const audited = await runImp(['audit'], dir)
    const sbom = await runImp(['audit', '--sbom'], dir)
    const wrote = await Deno.stat(join(dir, 'sbom.cdx.json')).then(() => 'yes', () => 'no')
    await assertSnapshot(
      'audit-missing-manifest',
      `${commandTranscript('imp audit  (cwd: <tmp>, ng has no manifest)', audited)}\n${
        commandTranscript('imp audit --sbom  (cwd: <tmp>, ng has no manifest)', sbom)
      }\n--- wrote sbom.cdx.json ---\n${wrote}\n`,
    )
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

const tarHeader = (name, size) => {
  const header = new Uint8Array(512)
  const write = (text, offset) => header.set(new TextEncoder().encode(text), offset)
  write(name, 0)
  write('0000644\0', 100)
  write(`${size.toString(8).padStart(11, '0')}\0`, 124)
  write('0', 156)
  write('ustar\0', 257)
  write('00', 263)
  return header
}

async function gzipTar(files) {
  const blocks = []
  for (const [name, text] of Object.entries(files)) {
    const bytes = new TextEncoder().encode(text)
    blocks.push(tarHeader(name, bytes.length))
    const padded = new Uint8Array(Math.ceil(bytes.length / 512) * 512)
    padded.set(bytes)
    blocks.push(padded)
  }
  blocks.push(new Uint8Array(1024))
  const stream = new Blob(blocks).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

Deno.test('imp install checks a package against its published integrity', async () => {
  const tarball = await gzipTar({
    'package/package.json': '{"name":"demo"}',
    'package/lib/index.js': 'export const answer = 42\n',
  })
  const published = await sriDigest('sha512', tarball)
  const tampered = tarball.slice()
  tampered[tampered.length - 1] ^= 1
  const files = await tarballFiles(tarball)
  const encode = (text) => new TextEncoder().encode(text)
  const results = [
    `strongest of sha1 and sha512: ${strongestSri(`sha1-AAAA ${published}`)?.algorithm}`,
    `no known algorithm: ${strongestSri('md5-AAAA')}`,
    `published tarball matches: ${await matchesIntegrity(published, tarball)}`,
    `changed tarball matches: ${await matchesIntegrity(published, tampered)}`,
    `files in the tarball: ${[...files.keys()].join(', ')}`,
    `bundled copy is the published one: ${
      bundledFileProblem('demo@1.0.0', files, [
        { path: 'lib/index.js', bytes: encode('export const answer = 42\n') },
      ])
    }`,
    `bundled copy was edited: ${
      bundledFileProblem('demo@1.0.0', files, [
        { path: 'lib/index.js', bytes: encode('export const answer = 43\n') },
      ])
    }`,
    `bundled file is not in the package: ${
      bundledFileProblem('demo@1.0.0', files, [{ path: 'lib/extra.js', bytes: encode('') }])
    }`,
  ]
  await assertSnapshot('install-integrity-check', `${results.join('\n')}\n`)
})

const derFromP1363 = (raw) => {
  const integer = (bytes) => {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0) start++
    const value = [...bytes.subarray(start)]
    if (value[0] & 0x80) value.unshift(0)
    return [0x02, value.length, ...value]
  }
  const body = [...integer(raw.subarray(0, 32)), ...integer(raw.subarray(32))]
  return new Uint8Array([0x30, body.length, ...body])
}

async function registrySigner() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const key = encodeBase64(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)))
  const sign = async (message) =>
    encodeBase64(derFromP1363(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          pair.privateKey,
          new TextEncoder().encode(message),
        ),
      ),
    ))
  return { key, sign }
}

Deno.test('imp install checks the npm registry signature of a package', async () => {
  const registry = await registrySigner()
  const impostor = await registrySigner()
  const integrity =
    'sha512-nrGmJHbnyl7LfZyHbcgNyi0yHawEXOAnWYnw/3MJKJ7vyS2NcTqs5+sI4xcaivd6kjoUwnkD5'
  const signed = {
    name: '@demo/pkg',
    version: '1.0.0',
    integrity,
    signatures: [{
      keyid: 'SHA256:current',
      sig: await registry.sign(`@demo/pkg@1.0.0:${integrity}`),
    }],
  }
  const keys = [
    { keyid: 'SHA256:current', key: registry.key, expires: null },
    { keyid: 'SHA256:retired', key: registry.key, expires: '2025-01-29T00:00:00.000Z' },
  ]
  let lookups = 0
  const publishedOn = (time) => () => {
    lookups++
    return Promise.resolve(time)
  }
  const retired = { ...signed, signatures: [{ ...signed.signatures[0], keyid: 'SHA256:retired' }] }
  const results = [
    `signed by a current key: ${await registrySignatureProblem(signed, keys, publishedOn(null))}`,
    `publish time looked up for a key with no expiry: ${lookups > 0}`,
    `another hash: ${await registrySignatureProblem(
      { ...signed, integrity: `${integrity.slice(0, -1)}6` },
      keys,
      publishedOn(null),
    )}`,
    `another version: ${await registrySignatureProblem(
      { ...signed, version: '1.0.1' },
      keys,
      publishedOn(null),
    )}`,
    `signed by another key: ${await registrySignatureProblem(
      {
        ...signed,
        signatures: [{
          keyid: 'SHA256:current',
          sig: await impostor.sign(`@demo/pkg@1.0.0:${integrity}`),
        }],
      },
      keys,
      publishedOn(null),
    )}`,
    `no signature: ${await registrySignatureProblem(
      { ...signed, signatures: [] },
      keys,
      publishedOn(null),
    )}`,
    `unknown key: ${await registrySignatureProblem(
      { ...signed, signatures: [{ ...signed.signatures[0], keyid: 'SHA256:other' }] },
      keys,
      publishedOn(null),
    )}`,
    `a second signature that fails: ${await registrySignatureProblem(
      { ...signed, signatures: [...signed.signatures, { keyid: 'SHA256:current', sig: 'AAAA' }] },
      keys,
      publishedOn(null),
    )}`,
    `retired key, published before it expired: ${await registrySignatureProblem(
      retired,
      keys,
      publishedOn('2023-07-04T17:31:47.638Z'),
    )}`,
    `retired key, published after it expired: ${await registrySignatureProblem(
      retired,
      keys,
      publishedOn('2025-03-01T00:00:00.000Z'),
    )}`,
    `retired key, no publish time: ${await registrySignatureProblem(
      retired,
      keys,
      publishedOn(null),
    )}`,
  ]
  const raw = new Uint8Array(64)
  raw.fill(0x91, 0, 32)
  raw.set([0, 0, 0x05], 32)
  raw.fill(0x22, 35)
  const roundTrip = signatureFromDer(derFromP1363(raw))
  results.push(
    `DER with a padded r and a short s reads back: ${
      roundTrip?.length === 64 && roundTrip.every((byte, index) => byte === raw[index])
    }`,
    `DER with a wrong length: ${signatureFromDer(new Uint8Array([0x30, 9, 2, 1, 1, 2, 1, 1]))}`,
  )
  await assertSnapshot('install-signature-check', `${results.join('\n')}\n`)
})

Deno.test('imp install puts every package in place, or none', async (t) => {
  const encode = (text) => new TextEncoder().encode(text)
  const release = (alias, text) => ({
    alias,
    specifier: `npm:${alias}@2.0.0`,
    files: [{ name: `${alias}.js`, contents: encode(text) }],
    manifest: { alias, specifier: `npm:${alias}@2.0.0`, packages: [] },
  })
  const dependencies = [release('events', 'export const version = 2\n'), release('fresh', 'new\n')]
  const configChanges = dependencies.map(({ alias, specifier }) => ({
    path: ['dependencies', alias],
    value: specifier,
  }))
  const originalConfig = '{\n  "dependencies": { "events": "npm:events@1.0.0" }\n}\n'

  const project = async () => {
    const root = await tempDir()
    await Deno.writeTextFile(join(root, 'imp.json'), originalConfig)
    await Deno.mkdir(join(root, 'dependencies', 'events'), { recursive: true })
    await Deno.writeTextFile(
      join(root, 'dependencies', 'events', 'events.js'),
      'export const version = 1\n',
    )
    await Deno.writeTextFile(join(root, 'dependencies', 'events', 'manifest.json'), '{}\n')
    return root
  }

  const state = async (root) => {
    const files = []
    for (const path of (await listFiles(root)).sort()) {
      files.push(`${path}: ${JSON.stringify(await Deno.readTextFile(join(root, path)))}`)
    }
    return files.join('\n')
  }

  const real = projectFileSystem

  const failing = {
    'a write of the second package fails': {
      ...real,
      writeFile: (path, bytes) =>
        basename(path) === 'fresh.js'
          ? Promise.reject(new Error('No space left on device'))
          : Deno.writeFile(path, bytes),
    },
    'the second package cannot move into place': {
      ...real,
      rename: (from, to) =>
        basename(to) === 'fresh'
          ? Promise.reject(new Error('Access is denied'))
          : Deno.rename(from, to),
    },
    'imp.json cannot be written': {
      ...real,
      updateConfig: async (path) => {
        await Deno.writeTextFile(path, '{ "dependencies": {')
        throw new Error('No space left on device')
      },
    },
  }

  for (const [failure, fileSystem] of Object.entries(failing)) {
    await t.step(failure, async () => {
      const root = await project()
      const before = await state(root)
      const error = await commitDependencies({ root, dependencies, configChanges, fileSystem })
        .then(() => null, (thrown) => thrown.message)
      const after = await state(root)
      await Deno.remove(root, { recursive: true })
      check(error?.endsWith(' - nothing was installed'), `unexpected error: ${error}`)
      check(
        after === before,
        `the project changed:\n--- before ---\n${before}\n--- after ---\n${after}`,
      )
    })
  }

  await t.step('every step succeeds', async () => {
    const root = await project()
    await commitDependencies({ root, dependencies, configChanges, fileSystem: real })
    const after = await state(root)
    await Deno.remove(root, { recursive: true })
    await assertSnapshot('install-commit-state', `${after}\n`)
  })

  await t.step('a failure in a new project leaves no dependencies folder', async () => {
    const root = await tempDir()
    await commitDependencies({
      root,
      dependencies,
      configChanges,
      fileSystem: failing['imp.json cannot be written'],
    }).catch(() => {})
    const left = await listFiles(root)
    await Deno.remove(root, { recursive: true })
    check(left.length === 0, `files were left behind: ${left.join(', ')}`)
  })
})

Deno.test('a dependency alias cannot reach outside dependencies/', async (t) => {
  const aliases = ['../escape', '..', '.hidden', 'a/b', 'a\\b', '/abs', 'x..y', '@scope/name']
  await t.step('imp.json refuses the alias', async () => {
    const dir = await tempDir()
    await Deno.writeTextFile(join(dir, 'index.html'), '<!doctype html>\n')
    try {
      for (const alias of aliases) {
        await Deno.writeTextFile(
          join(dir, 'imp.json'),
          JSON.stringify({ dependencies: { [alias]: 'npm:mitt@3.0.1' } }),
        )
        for (const args of [['install'], ['build']]) {
          const result = await runImp(args, dir)
          check(result.code === 1, `imp ${args[0]} accepted the alias '${alias}'`)
          check(
            result.stderr.includes(`dependency alias '${alias}' must be a package name`),
            `unexpected error for '${alias}': ${result.stderr}`,
          )
        }
      }
    } finally {
      await Deno.remove(dir, { recursive: true })
    }
  })

  await t.step('commitDependencies writes nothing for the alias', async () => {
    const parent = await tempDir()
    const root = join(parent, 'project')
    await Deno.mkdir(root)
    try {
      for (const alias of aliases) {
        const dependency = {
          alias,
          specifier: 'npm:mitt@3.0.1',
          files: [{ name: 'escape.js', contents: new TextEncoder().encode('owned\n') }],
          manifest: { alias, specifier: 'npm:mitt@3.0.1', packages: [] },
        }
        const error = await commitDependencies({
          root,
          dependencies: [dependency],
          configChanges: [{ path: ['dependencies', alias], value: dependency.specifier }],
        }).then(() => null, (thrown) => thrown.message)
        check(error?.startsWith(`invalid dependency alias: '${alias}'`), `unexpected: ${error}`)
      }
      const left = await listFiles(parent)
      check(left.length === 0, `files were written: ${left.join(', ')}`)
    } finally {
      await Deno.remove(parent, { recursive: true })
    }
  })
})

Deno.test('imp install takes the skill of an imp component from beside its entry module', async (t) => {
  const folder = await tempDir()
  const entry = join(folder, 'dist', 'widget.js')
  const specifier = 'npm:widget@1.0.0'
  const problemOf = (run) => run().then(() => null, (error) => error.message)
  await Deno.mkdir(join(folder, 'dist'))
  await Deno.writeTextFile(entry, 'export const widget = 1\n')
  try {
    await t.step('a component with its skill', async () => {
      await Deno.writeTextFile(join(folder, 'dist', 'imp-skill.md'), '# widget - a panel\n')
      const file = await componentSkill({ specifier, entry })
      check(file.name === 'imp-skill.md', `unexpected file: ${file.name}`)
      check(
        new TextDecoder().decode(file.contents) === '# widget - a panel\n',
        'the skill was not copied verbatim',
      )
    })
    await t.step('a component that ships no skill', async () => {
      await Deno.remove(join(folder, 'dist', 'imp-skill.md'))
      const problem = await problemOf(() => componentSkill({ specifier, entry }))
      check(
        problem?.startsWith(
          'npm:widget@1.0.0 imports imp, so it is an imp component, and it has no imp-skill.md next to its entry module',
        ),
        `unexpected problem: ${problem}`,
      )
    })
  } finally {
    await Deno.remove(folder, { recursive: true })
  }
})

Deno.test({
  name: 'install.sh downloads the binary and its checksum from one resolved release tag',
  ignore: Deno.build.os === 'windows',
  fn: async () => {
    const dir = await tempDir()
    const bin = join(dir, 'bin')
    const target = join(dir, 'target')
    await Deno.mkdir(bin)
    await Deno.mkdir(target)
    const requests = join(dir, 'requests.log')
    const fakeCurl = [
      '#!/bin/bash',
      'output=""',
      'head=0',
      'url=""',
      'while [ $# -gt 0 ]; do',
      '  case "$1" in',
      '    -o) output="$2"; shift 2 ;;',
      '    -w) shift 2 ;;',
      '    -*I*) head=1; shift ;;',
      '    -*) shift ;;',
      '    *) url="$1"; shift ;;',
      '  esac',
      'done',
      `echo "$url" >> '${requests}'`,
      'if [ "$head" = 1 ]; then',
      '  printf "https://github.com/sobanieca/imp-ui/releases/tag/v9.8.7"',
      '  exit 0',
      'fi',
      'case "$url" in',
      `  *.sha256) printf '17a815baf7efd5341b39e803d557cea4b127e125af8a5f92f0edd6322a0c38e5  imp\\n' > "$output" ;;`,
      '  *) printf \'fake binary\' > "$output" ;;',
      'esac',
    ].join('\n')
    await Deno.writeTextFile(join(bin, 'curl'), `${fakeCurl}\n`, { mode: 0o755 })
    try {
      const { code, stderr } = await new Deno.Command('bash', {
        args: [join(REPO_ROOT, 'install.sh')],
        env: { PATH: `${bin}:${Deno.env.get('PATH')}`, INSTALL_DIR: target },
        stdout: 'null',
        stderr: 'piped',
      }).output()
      check(code === 0, `install.sh failed: ${new TextDecoder().decode(stderr)}`)
      const asked = (await Deno.readTextFile(requests)).trim().split('\n')
      const downloads = asked.filter((url) => url.includes('/releases/download/'))
      check(downloads.length === 2, `expected two downloads, got ${asked.join(', ')}`)
      check(
        downloads.every((url) => url.includes('/releases/download/v9.8.7/')),
        `the binary and the checksum must come from one tag, got ${downloads.join(', ')}`,
      )
      check(
        await Deno.readTextFile(join(target, 'imp')) === 'fake binary',
        'the binary is installed',
      )
    } finally {
      await Deno.remove(dir, { recursive: true })
    }
  },
})
