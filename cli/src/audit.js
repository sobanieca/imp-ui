import { basename, join, relative, resolve } from '@std/path'
import { decodeBase64 } from '@std/encoding/base64'
import { loadImpConfig } from './config.js'
import { packageId } from './deps.js'
import { DEPENDENCY_MANIFEST_FILE, readDependencyManifest } from './dependency-manifest.js'
import { isNewer, VERSION } from './version.js'
import { parseSpecifier } from './specifiers.js'
import { logger } from './logger.js'

const OSV_API = 'https://api.osv.dev/v1'
const OSV_BATCH_SIZE = 1000
const OSV_LINK = 'https://osv.dev/vulnerability/'

export const SBOM_FILE = 'sbom.cdx.json'
const CYCLONEDX_VERSION = '1.7'

const SPDX_EXPRESSION = /^\(*[\w.+:-]+\)*( (AND|OR|WITH) \(*[\w.+:-]+\)*)*$/

async function readManifests(root, dependencies) {
  const manifests = []
  const missing = []
  for (const alias of Object.keys(dependencies)) {
    const manifest = await readDependencyManifest(root, alias)
    if (manifest) manifests.push(manifest)
    else missing.push(alias)
  }
  if (missing.length) {
    logger.warn(
      `no ${DEPENDENCY_MANIFEST_FILE} for ${missing.join(', ')} - ${
        missing.length === 1 ? 'that dependency is' : 'those dependencies are'
      } left out; run 'imp install' to record ${missing.length === 1 ? 'it' : 'them'}`,
    )
  }
  return manifests
}

export function auditedPackages(manifests) {
  const packages = new Map()
  for (const manifest of manifests) {
    for (const entry of manifest.packages) {
      const id = `${entry.registry}:${packageId(entry)}`
      if (!packages.has(id)) packages.set(id, { ...entry, aliases: [] })
      packages.get(id).aliases.push(manifest.alias)
    }
  }
  return [...packages.values()].sort((a, b) => packageId(a).localeCompare(packageId(b)))
}

export const osvQuery = ({ name, version }) => ({
  package: { name, ecosystem: 'npm' },
  version,
})

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`the OSV database did not answer - ${url} responded ${response.status}`)
  }
  return await response.json()
}

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`the OSV database did not answer - ${url} responded ${response.status}`)
  }
  return await response.json()
}

async function knownVulnerabilityIds(packages) {
  const ids = []
  for (let start = 0; start < packages.length; start += OSV_BATCH_SIZE) {
    const batch = packages.slice(start, start + OSV_BATCH_SIZE)
    const { results } = await postJson(`${OSV_API}/querybatch`, {
      queries: batch.map(osvQuery),
    })
    batch.forEach((_, index) => ids.push((results[index]?.vulns ?? []).map(({ id }) => id)))
  }
  return ids
}

export function fixedVersion(vulnerability, { name, version }) {
  const fixes = []
  for (const affected of vulnerability.affected ?? []) {
    if (affected.package?.ecosystem !== 'npm' || affected.package?.name !== name) continue
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed && isNewer(event.fixed, version)) fixes.push(event.fixed)
      }
    }
  }
  return fixes.sort((a, b) => (isNewer(a, b) ? 1 : isNewer(b, a) ? -1 : 0))[0] ?? null
}

export const describeVulnerability = (vulnerability, entry) => ({
  id: vulnerability.id,
  severity: vulnerability.database_specific?.severity ?? null,
  summary: (vulnerability.summary ?? vulnerability.details?.split('\n')[0] ?? '').trim(),
  fixed: fixedVersion(vulnerability, entry),
})

export function auditReport(checked, unchecked) {
  const lines = []
  const affected = checked.filter(({ vulnerabilities }) => vulnerabilities.length)
  for (const { entry, vulnerabilities } of affected) {
    lines.push(`${packageId(entry)} (in ${entry.aliases.join(', ')})`)
    for (const vulnerability of vulnerabilities) {
      const severity = vulnerability.severity ? ` ${vulnerability.severity}` : ''
      const fix = vulnerability.fixed ? ` - fixed in ${vulnerability.fixed}` : ' - no fix yet'
      lines.push(`  ${vulnerability.id}${severity} ${vulnerability.summary}${fix}`)
      lines.push(`    ${OSV_LINK}${vulnerability.id}`)
    }
  }
  const count = affected.reduce((sum, { vulnerabilities }) => sum + vulnerabilities.length, 0)
  const packages = (number) => `${number} npm package${number === 1 ? '' : 's'}`
  const found = count === 1 ? '1 known vulnerability' : `${count} known vulnerabilities`
  lines.push(
    count
      ? `${found} in ${packages(affected.length)}, of ${checked.length} checked`
      : `no known vulnerabilities in ${packages(checked.length)}`,
  )
  if (unchecked.length) {
    lines.push(
      `not checked: ${
        unchecked.map(packageId).join(', ')
      } - the OSV database has no records for jsr packages`,
    )
  }
  return { text: lines.join('\n'), vulnerable: count > 0 }
}

async function vulnerabilityDetails(ids) {
  const details = new Map()
  const unique = [...new Set(ids.flat())]
  await Promise.all(unique.map(async (id) => {
    details.set(id, await getJson(`${OSV_API}/vulns/${encodeURIComponent(id)}`))
  }))
  return details
}

async function checkVulnerabilities(packages) {
  const npm = packages.filter((entry) => entry.registry === 'npm')
  const unchecked = packages.filter((entry) => entry.registry !== 'npm')
  const ids = await knownVulnerabilityIds(npm)
  const details = await vulnerabilityDetails(ids)
  const checked = npm.map((entry, index) => ({
    entry,
    vulnerabilities: ids[index].map((id) => describeVulnerability(details.get(id), entry)),
  }))
  return auditReport(checked, unchecked)
}

const hexOf = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

const CYCLONEDX_HASHES = { sha512: 'SHA-512', sha384: 'SHA-384', sha256: 'SHA-256', sha1: 'SHA-1' }

function componentHashes(integrity) {
  if (!integrity) return []
  const [algorithm, ...digest] = integrity.split('-')
  const alg = CYCLONEDX_HASHES[algorithm]
  return alg ? [{ alg, content: hexOf(decodeBase64(digest.join('-'))) }] : []
}

const componentLicenses = (license) => {
  if (!license) return []
  return SPDX_EXPRESSION.test(license)
    ? [{ expression: license }]
    : [{ license: { name: license } }]
}

export function packageUrl({ registry, name, version }) {
  if (registry !== 'npm') return null
  return `pkg:npm/${name.replace(/^@/, '%40')}@${version}`
}

const bomRef = (entry) => packageUrl(entry) ?? `${entry.registry}:${packageId(entry)}`

function component(entry) {
  const purl = packageUrl(entry)
  return {
    type: 'library',
    'bom-ref': bomRef(entry),
    name: entry.name,
    version: entry.version,
    ...(purl ? { purl } : {}),
    ...(entry.integrity ? { hashes: componentHashes(entry.integrity) } : {}),
    ...(entry.license ? { licenses: componentLicenses(entry.license) } : {}),
    externalReferences: [{
      type: 'distribution',
      url: entry.registry === 'npm'
        ? `https://www.npmjs.com/package/${entry.name}/v/${entry.version}`
        : `https://jsr.io/${entry.name}@${entry.version}`,
    }],
  }
}

export function cycloneDxBom({ appName, manifests, serialNumber, timestamp }) {
  const packages = auditedPackages(manifests)
  const appRef = `app:${appName}`
  const directRefs = manifests.map((manifest) => {
    const declared = parseSpecifier(manifest.specifier)
    const direct = manifest.packages.find((entry) =>
      entry.registry === declared?.scheme && entry.name === declared.name &&
      entry.version === declared.version
    )
    return direct ? bomRef(direct) : null
  }).filter(Boolean)
  return {
    $schema: `http://cyclonedx.org/schema/bom-${CYCLONEDX_VERSION}.schema.json`,
    bomFormat: 'CycloneDX',
    specVersion: CYCLONEDX_VERSION,
    serialNumber,
    version: 1,
    metadata: {
      timestamp,
      tools: { components: [{ type: 'application', name: 'imp', version: VERSION }] },
      component: { type: 'application', 'bom-ref': appRef, name: appName },
    },
    components: packages.map(component),
    dependencies: [{ ref: appRef, dependsOn: [...new Set(directRefs)].sort() }],
  }
}

export async function audit({ root, sbom = false, output = null }) {
  const config = await loadImpConfig(root)
  const dependencies = config.dependencies ?? {}
  if (!Object.keys(dependencies).length) {
    console.log('nothing to audit - no dependencies declared in imp.json')
    return 0
  }
  const manifests = await readManifests(root, dependencies)
  if (sbom) {
    const path = resolve(output ?? join(root, SBOM_FILE))
    const bom = cycloneDxBom({
      appName: basename(root),
      manifests,
      serialNumber: `urn:uuid:${crypto.randomUUID()}`,
      timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    })
    await Deno.writeTextFile(path, `${JSON.stringify(bom, null, 2)}\n`)
    const count = bom.components.length
    console.log(
      `wrote ${relative(Deno.cwd(), path)} - CycloneDX ${CYCLONEDX_VERSION}, ${count} package${
        count === 1 ? '' : 's'
      }`,
    )
    return 0
  }
  const { text, vulnerable } = await checkVulnerabilities(auditedPackages(manifests))
  console.log(text)
  return vulnerable ? 1 : 0
}
