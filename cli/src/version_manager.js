import { dirname, join } from '@std/path'
import { cyan, dim } from './colors.js'
import { findConfigFile, tryParseConfig, updateConfigFile } from './config.js'
import { isNewer, VERSION } from './version.js'

const REPO = 'sobanieca/imp-ui'
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000

const PLATFORM_SLUGS = {
  'darwin-x86_64': 'macos-x64',
  'darwin-aarch64': 'macos-arm64',
  'linux-x86_64': 'linux-x64',
  'linux-aarch64': 'linux-arm64',
}

function platformSlug() {
  const slug = PLATFORM_SLUGS[`${Deno.build.os}-${Deno.build.arch}`]
  if (!slug) {
    throw new Error(
      `imp does not ship a binary for ${Deno.build.os}/${Deno.build.arch} — supported platforms are macOS and Linux on x64 or arm64`,
    )
  }
  return slug
}

const assetName = () => `imp-${platformSlug()}`

const homeDir = () => Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE')

function impHome() {
  const override = Deno.env.get('IMP_HOME')
  if (override) return override
  const home = homeDir()
  if (!home) throw new Error('cannot locate the imp home directory — set IMP_HOME or HOME')
  return join(home, '.imp')
}

const versionBinaryPath = (version) => join(impHome(), 'versions', version, 'imp')

const releaseAssetUrl = (version) =>
  `https://github.com/${REPO}/releases/download/v${version}/${assetName()}`

const isDevMode = () => /(^|[/\\])deno(\.exe)?$/i.test(Deno.execPath())

async function exists(path) {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

async function configInDir(dir) {
  for (const name of ['imp.json', 'imp.jsonc']) {
    const path = join(dir, name)
    if (await exists(path)) return path
  }
  return null
}

async function readPin(startDir) {
  const found = await findConfigFile(startDir)
  if (!found) return null
  try {
    const version = tryParseConfig(await Deno.readTextFile(found.path))?.version
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

async function findPinTarget(startDir) {
  let dir = startDir
  let nearestConfig = null
  while (true) {
    const config = await configInDir(dir)
    if (config && nearestConfig === null) nearestConfig = config
    if (await exists(join(dir, '.git'))) return config ?? nearestConfig
    const parent = dirname(dir)
    if (parent === dir) return nearestConfig
    dir = parent
  }
}

async function fetchExpectedChecksum(url, version) {
  let response
  try {
    response = await fetch(`${url}.sha256`)
  } catch (error) {
    throw new Error(
      `imp ${version} checksum could not be fetched from ${url}.sha256 — ${error.message}`,
    )
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(
      `imp ${version} checksum could not be fetched — ${url}.sha256 responded ${response.status}`,
    )
  }
  const hex = (await response.text()).trim().split(/\s+/)[0]?.toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(hex ?? '')) {
    throw new Error(`imp ${version} checksum is malformed at ${url}.sha256`)
  }
  return hex
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

async function downloadVersion(version) {
  const url = releaseAssetUrl(version)
  let response
  try {
    response = await fetch(url)
  } catch (error) {
    throw new Error(`imp ${version} could not be downloaded from ${url} — ${error.message}`)
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`imp ${version} could not be downloaded — ${url} responded ${response.status}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const expected = await fetchExpectedChecksum(url, version)
  const actual = await sha256Hex(bytes)
  if (actual !== expected) {
    throw new Error(
      `imp ${version} failed checksum verification — expected ${expected}, got ${actual}`,
    )
  }
  const dir = join(impHome(), 'versions', version)
  await Deno.mkdir(dir, { recursive: true })
  const finalPath = join(dir, 'imp')
  const tempPath = `${finalPath}.download-${crypto.randomUUID()}`
  await Deno.writeFile(tempPath, bytes, { mode: 0o755 })
  await Deno.chmod(tempPath, 0o755).catch(() => {})
  await Deno.rename(tempPath, finalPath)
  return finalPath
}

export async function ensureVersion(version) {
  const path = versionBinaryPath(version)
  if (await exists(path)) return path
  console.error(dim(`imp ${version} — downloading…`))
  return await downloadVersion(version)
}

export async function resolveLatestVersion() {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`
  const response = await fetch(url, { headers: { accept: 'application/vnd.github+json' } })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(
      `could not resolve the latest imp release — GitHub responded ${response.status}`,
    )
  }
  const tag = (await response.json())?.tag_name
  if (typeof tag !== 'string') {
    throw new Error('could not resolve the latest imp release — no tag_name in the GitHub response')
  }
  return tag.replace(/^v/, '')
}

export async function maybeDelegate(args) {
  if (Deno.env.get('IMP_DELEGATED') === '1') return
  if (Deno.env.get('IMP_VERSION') === 'system') return
  if (isDevMode()) return
  const pin = await readPin(Deno.cwd())
  if (!pin || pin === VERSION) return
  let binary
  try {
    binary = await ensureVersion(pin)
  } catch (error) {
    throw new Error(
      `${error.message}\n(imp.json pins version ${pin}; set IMP_VERSION=system to run this binary regardless)`,
    )
  }
  const child = new Deno.Command(binary, {
    args,
    env: { IMP_DELEGATED: '1' },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn()
  const status = await child.status
  Deno.exit(status.code)
}

async function updatePin(path, version) {
  const previous = tryParseConfig(await Deno.readTextFile(path))?.version
  await updateConfigFile(path, [
    { path: ['version'], value: version, getInsertionIndex: () => 0 },
  ])
  return typeof previous === 'string' ? previous : null
}

export async function update({ root, check = false, requestedVersion = null }) {
  const target = requestedVersion ?? await resolveLatestVersion()
  if (check) {
    if (isNewer(target, VERSION)) {
      console.log(`imp ${target} is available (you have ${VERSION}) — run 'imp update'`)
    } else {
      console.log(`imp ${VERSION} is up to date`)
    }
    return
  }
  await ensureVersion(target)
  const pinPath = await findPinTarget(root)
  if (!pinPath) {
    console.log(
      `imp ${target} downloaded — no imp.json or imp.jsonc found, so no project pin was written`,
    )
    return
  }
  const previous = await updatePin(pinPath, target)
  const change = previous && previous !== target ? `${previous} → ${target}` : target
  console.log(`imp updated ${change} (pinned in ${pinPath})`)
}

async function latestReleaseThrottled() {
  const cachePath = join(impHome(), 'update-check.json')
  const now = Date.now()
  try {
    const cache = JSON.parse(await Deno.readTextFile(cachePath))
    if (
      typeof cache?.latest === 'string' &&
      typeof cache?.checkedAt === 'number' &&
      now - cache.checkedAt < UPDATE_CHECK_INTERVAL
    ) {
      return cache.latest
    }
  } catch {
    // no usable cache — fall through to a fresh check
  }
  const latest = await resolveLatestVersion()
  try {
    await Deno.mkdir(impHome(), { recursive: true })
    await Deno.writeTextFile(cachePath, JSON.stringify({ latest, checkedAt: now }))
  } catch {
    // caching is best-effort
  }
  return latest
}

export async function notifyUpdate(args) {
  try {
    if (args.includes('--no-update-check')) return
    if (Deno.env.get('IMP_NO_UPDATE_CHECK')) return
    if (Deno.env.get('IMP_VERSION') === 'system') return
    if (isDevMode()) return
    if (!Deno.stdout.isTerminal()) return
    const latest = await latestReleaseThrottled()
    if (isNewer(latest, VERSION)) {
      console.log(
        cyan(`imp ${latest} is available`) + dim(` (you have ${VERSION}) — run 'imp update'`),
      )
    }
  } catch {
    // update awareness must never affect the command being run
  }
}
