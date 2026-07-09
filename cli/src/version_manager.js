import { dirname, join } from '@std/path'
import { cyan, dim } from './colors.js'
import { findConfigFile, tryParseConfig, updateConfigFile } from './config.js'
import { isNewer, VERSION } from './version.js'
import { formatSize } from './file_size.js'

const REPO = 'sobanieca/imp-ui'
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000
const STALE_AFTER = 30 * 24 * 60 * 60 * 1000

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

const versionsDir = () => join(impHome(), 'versions')
const versionDir = (version) => join(versionsDir(), version)
const versionBinaryPath = (version) => join(versionDir(version), 'imp')
const lastUsedPath = (version) => join(versionDir(version), 'lastUsed')

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
  const downloaded = await downloadVersion(version)
  await warnStaleVersions(version)
  return downloaded
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

async function touchLastUsed(version) {
  try {
    if (!(await exists(versionDir(version)))) return
    await Deno.writeTextFile(lastUsedPath(version), new Date().toISOString())
  } catch {
    // recording usage is best-effort and must never break a command
  }
}

async function lastUsedTime(version) {
  try {
    const parsed = Date.parse((await Deno.readTextFile(lastUsedPath(version))).trim())
    if (!Number.isNaN(parsed)) return parsed
  } catch {
    // no lastUsed marker — fall back to the binary's own timestamp
  }
  try {
    const info = await Deno.stat(versionBinaryPath(version))
    return info.mtime?.getTime() ?? info.birthtime?.getTime() ?? Date.now()
  } catch {
    return Date.now()
  }
}

async function listInstalledVersions() {
  const versions = []
  try {
    for await (const entry of Deno.readDir(versionsDir())) {
      if (entry.isDirectory && await exists(versionBinaryPath(entry.name))) {
        versions.push(entry.name)
      }
    }
  } catch {
    // no versions directory yet — nothing installed
  }
  return versions
}

async function staleVersions(excludeVersion) {
  const now = Date.now()
  const stale = []
  for (const version of await listInstalledVersions()) {
    if (version === excludeVersion) continue
    if (now - await lastUsedTime(version) > STALE_AFTER) stale.push(version)
  }
  return stale.sort()
}

async function directorySize(dir) {
  let total = 0
  try {
    for await (const entry of Deno.readDir(dir)) {
      const path = join(dir, entry.name)
      total += entry.isDirectory
        ? await directorySize(path)
        : await Deno.stat(path).then((info) => info.size).catch(() => 0)
    }
  } catch {
    // an unreadable directory contributes nothing to the total
  }
  return total
}

async function warnStaleVersions(justInstalled) {
  try {
    const stale = await staleVersions(justInstalled)
    if (!stale.length) return
    const single = stale.length === 1
    console.error(
      dim(
        `${stale.length} unused imp ${single ? 'version' : 'versions'} (${stale.join(', ')}) ${
          single ? 'has' : 'have'
        } not run in over 30 days — run 'imp prune' to remove ${
          single ? 'it' : 'them'
        } and reclaim disk space`,
      ),
    )
  } catch {
    // the stale-version notice must never affect an install
  }
}

export async function prune() {
  const stale = await staleVersions(VERSION)
  if (!stale.length) {
    console.log('no unused imp versions to prune — nothing cached is older than 30 days')
    return
  }
  let freed = 0
  for (const version of stale) {
    freed += await directorySize(versionDir(version))
    await Deno.remove(versionDir(version), { recursive: true }).catch(() => {})
    console.log(`removed imp ${version}`)
  }
  const single = stale.length === 1
  console.log(
    `pruned ${stale.length} unused ${single ? 'version' : 'versions'}, freed ${formatSize(freed)}`,
  )
}

export async function maybeDelegate(args) {
  await touchLastUsed(VERSION)
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
