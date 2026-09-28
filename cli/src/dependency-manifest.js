import { isAbsolute, join } from '@std/path'
import { packageId } from './deps.js'

export const DEPENDENCY_MANIFEST_FILE = 'manifest.json'

const JSR_REGISTRY = 'https://jsr.io'

const LICENSE_FILE = /^(licen[sc]e|copying)(\.[a-z]+)?$/i

const absoluteCachePath = (path) => isAbsolute(path) ? path : `/${path}`

function spdxFrom(packageJson) {
  const { license, licenses } = packageJson
  if (typeof license === 'string') return license
  if (typeof license?.type === 'string') return license.type
  if (typeof licenses?.[0]?.type === 'string') return licenses[0].type
  return null
}

async function npmLicense(directory) {
  const root = absoluteCachePath(directory)
  const packageJson = await Deno.readTextFile(join(root, 'package.json'))
    .then(JSON.parse)
    .catch(() => ({}))
  let text = null
  for await (const entry of Deno.readDir(root)) {
    if (entry.isFile && LICENSE_FILE.test(entry.name)) {
      text = (await Deno.readTextFile(join(root, entry.name))).trimEnd()
      break
    }
  }
  return { license: spdxFrom(packageJson), licenseText: text }
}

async function jsrLicense({ name, version }) {
  const base = `${JSR_REGISTRY}/${name}/${version}`
  const meta = await fetch(`${JSR_REGISTRY}/${name}/${version}_meta.json`)
  if (!meta.ok) {
    await meta.body?.cancel()
    return { license: null, licenseText: null }
  }
  const { manifest } = await meta.json()
  const file = Object.keys(manifest ?? {}).find((path) => LICENSE_FILE.test(path.slice(1)))
  if (!file) return { license: null, licenseText: null }
  const response = await fetch(base + file)
  if (!response.ok) {
    await response.body?.cancel()
    return { license: null, licenseText: null }
  }
  return { license: null, licenseText: (await response.text()).trimEnd() }
}

const licenseOf = (record) =>
  record.registry === 'npm' ? npmLicense(record.directory) : jsrLicense(record)

export async function recordPackageLicenses(packages) {
  return await Promise.all(
    packages.map(async ({ registry, name, version, directory, integrity, provenance }) => {
      const { license, licenseText } = await licenseOf({ registry, name, version, directory })
        .catch(() => ({ license: null, licenseText: null }))
      return { registry, name, version, integrity, provenance, license, licenseText }
    }),
  )
}

export const unlicensedPackages = (manifest) =>
  manifest.packages.filter((entry) => !entry.license && !entry.licenseText).map(packageId)

export const dependencyManifest = ({ alias, specifier, packages, impImports }) => ({
  alias,
  specifier,
  installedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  impImports,
  packages,
})

export const manifestFileContents = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`

export async function readDependencyManifest(root, alias) {
  const path = join(root, 'dependencies', alias, DEPENDENCY_MANIFEST_FILE)
  const text = await Deno.readTextFile(path).catch(() => null)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`invalid dependencies/${alias}/${DEPENDENCY_MANIFEST_FILE} - not valid JSON`)
  }
}

export function recordedNotices(manifests) {
  const notices = new Map()
  for (const manifest of manifests) {
    for (const entry of manifest.packages) {
      const id = packageId(entry)
      if (notices.has(id) || !entry.licenseText) continue
      const heading = entry.license ? `${id} - ${entry.license}` : `${id} - license not declared`
      notices.set(id, `${heading}\n\n${entry.licenseText}`)
    }
  }
  return [...notices.keys()].sort().map((id) => notices.get(id))
}
