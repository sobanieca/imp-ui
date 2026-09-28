import { encodeBase64 } from '@std/encoding/base64'
import { isAbsolute, join } from '@std/path'
import { packageId } from './deps.js'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const JSR_API = 'https://api.jsr.io'

const SRI_ALGORITHMS = { sha512: 'SHA-512', sha384: 'SHA-384', sha256: 'SHA-256', sha1: 'SHA-1' }
const SRI_STRENGTH = ['sha512', 'sha384', 'sha256', 'sha1']

const TAR_BLOCK = 512
const REGULAR_FILE_TYPES = ['0', '7']

export async function sriDigest(algorithm, bytes) {
  const digest = await crypto.subtle.digest(SRI_ALGORITHMS[algorithm], bytes)
  return `${algorithm}-${encodeBase64(new Uint8Array(digest))}`
}

export function strongestSri(integrity) {
  const entries = String(integrity ?? '').trim().split(/\s+/)
    .map((entry) => entry.split('?')[0])
    .filter((entry) => SRI_ALGORITHMS[entry.split('-')[0]] && entry.includes('-'))
  for (const algorithm of SRI_STRENGTH) {
    const found = entries.find((entry) => entry.startsWith(`${algorithm}-`))
    if (found) return { algorithm, expected: found }
  }
  return null
}

export async function matchesIntegrity(integrity, bytes) {
  const strongest = strongestSri(integrity)
  if (!strongest) return false
  return await sriDigest(strongest.algorithm, bytes) === strongest.expected
}

const tarText = (bytes, start, length) => {
  const field = bytes.subarray(start, start + length)
  const end = field.indexOf(0)
  return new TextDecoder().decode(end === -1 ? field : field.subarray(0, end))
}

const tarSize = (bytes, start) => parseInt(tarText(bytes, start, 12).trim() || '0', 8)

function paxPath(record) {
  const text = new TextDecoder().decode(record)
  const match = text.match(/(?:^|\n)\d+ path=([^\n]*)\n/)
  return match ? match[1] : null
}

export function readTar(bytes) {
  const files = new Map()
  let offset = 0
  let nextName = null
  while (offset + TAR_BLOCK <= bytes.length) {
    const header = bytes.subarray(offset, offset + TAR_BLOCK)
    if (header.every((byte) => byte === 0)) break
    const size = tarSize(header, 124)
    const type = String.fromCharCode(header[156] || 48)
    const prefix = tarText(header, 345, 155)
    const headerName = tarText(header, 0, 100)
    const body = bytes.subarray(offset + TAR_BLOCK, offset + TAR_BLOCK + size)
    offset += TAR_BLOCK + Math.ceil(size / TAR_BLOCK) * TAR_BLOCK
    if (type === 'x') {
      nextName = paxPath(body) ?? nextName
      continue
    }
    if (type === 'L') {
      nextName = tarText(body, 0, body.length)
      continue
    }
    if (type === 'g') continue
    const name = nextName ?? (prefix ? `${prefix}/${headerName}` : headerName)
    nextName = null
    if (REGULAR_FILE_TYPES.includes(type)) files.set(name, body)
  }
  return files
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const withoutRootFolder = (path) => path.slice(path.indexOf('/') + 1)

export async function tarballFiles(tarball) {
  const files = new Map()
  for (const [path, bytes] of readTar(await gunzip(tarball))) {
    files.set(withoutRootFolder(path), bytes)
  }
  return files
}

async function fetchJson(url, what) {
  const response = await fetch(url)
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`could not read ${what} - ${url} responded ${response.status}`)
  }
  return await response.json()
}

async function fetchBytes(url, what) {
  const response = await fetch(url)
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`could not download ${what} - ${url} responded ${response.status}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

const absoluteCachePath = (path) => isAbsolute(path) ? path : `/${path}`

export function bundledFileProblem(id, tarball, bundled) {
  for (const { path, bytes } of bundled) {
    const published = tarball.get(path)
    if (!published) {
      return `${id} bundled ${path}, which the published package does not contain`
    }
    if (published.length !== bytes.length || published.some((byte, i) => byte !== bytes[i])) {
      return `${id} bundled a copy of ${path} that differs from the published package`
    }
  }
  return null
}

async function verifyNpmPackage({ name, version, directory, files }) {
  const id = packageId({ name, version })
  const metadata = await fetchJson(`${NPM_REGISTRY}/${name}/${version}`, `the metadata of ${id}`)
  const integrity = metadata.dist?.integrity ?? null
  if (!strongestSri(integrity)) {
    throw new Error(
      `${id} has no integrity hash in the npm registry - imp installs only a package it can check`,
    )
  }
  const tarball = await fetchBytes(metadata.dist.tarball, id)
  if (!await matchesIntegrity(integrity, tarball)) {
    throw new Error(
      `integrity check failed for ${id} - the downloaded package does not match the hash that the npm registry publishes; nothing was installed`,
    )
  }
  const bundled = await Promise.all(files.map(async (path) => ({
    path,
    bytes: await Deno.readFile(join(absoluteCachePath(directory), path)),
  })))
  const problem = bundledFileProblem(id, await tarballFiles(tarball), bundled)
  if (problem) throw new Error(`integrity check failed - ${problem}; nothing was installed`)
  return {
    integrity: strongestSri(integrity).expected,
    provenance: Boolean(metadata.dist?.attestations?.provenance),
  }
}

async function jsrProvenance({ name, version }) {
  const [scope, packageName] = name.slice(1).split('/')
  const response = await fetch(
    `${JSR_API}/scopes/${scope}/packages/${packageName}/versions/${version}`,
  ).catch(() => null)
  if (!response?.ok) {
    await response?.body?.cancel()
    return false
  }
  const { rekorLogId } = await response.json()
  return Boolean(rekorLogId)
}

export async function verifyPackages(packages) {
  return await Promise.all(packages.map(async (entry) => {
    if (entry.registry === 'npm') return { ...entry, ...await verifyNpmPackage(entry) }
    return { ...entry, integrity: null, provenance: await jsrProvenance(entry) }
  }))
}
