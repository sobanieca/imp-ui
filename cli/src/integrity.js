import { decodeBase64, encodeBase64 } from '@std/encoding/base64'
import { join } from '@std/path'
import { packageId } from './deps.js'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_SIGNING_KEYS = `${NPM_REGISTRY}/-/npm/v1/keys`
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

const DER_SEQUENCE = 0x30
const DER_INTEGER = 0x02
const P256_COORDINATE = 32

export function signatureFromDer(der) {
  if (der[0] !== DER_SEQUENCE || der[1] !== der.length - 2) return null
  const raw = new Uint8Array(P256_COORDINATE * 2)
  let offset = 2
  for (const start of [0, P256_COORDINATE]) {
    if (der[offset] !== DER_INTEGER) return null
    const length = der[offset + 1]
    let value = der.subarray(offset + 2, offset + 2 + length)
    offset += 2 + length
    while (value.length > P256_COORDINATE && value[0] === 0) value = value.subarray(1)
    if (value.length > P256_COORDINATE || offset > der.length) return null
    raw.set(value, start + P256_COORDINATE - value.length)
  }
  return offset === der.length ? raw : null
}

async function signatureMatches(key, message, signature) {
  const raw = signatureFromDer(decodeBase64(signature))
  if (!raw) return false
  const publicKey = await crypto.subtle.importKey(
    'spki',
    decodeBase64(key),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
  return await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    raw,
    new TextEncoder().encode(message),
  )
}

export async function registrySignatureProblem(
  { name, version, integrity, signatures },
  keys,
  publishTime,
) {
  const id = packageId({ name, version })
  if (!signatures?.length) return `${id} carries no signature of the npm registry`
  for (const { keyid, sig } of signatures) {
    const key = keys.find((candidate) => candidate.keyid === keyid)
    if (!key) return `${id} is signed with the key ${keyid}, which the npm registry does not list`
    if (key.expires) {
      const published = await publishTime()
      if (!published) {
        return `${id} is signed with the key ${keyid}, which expired on ${key.expires}, and the npm registry gives no publish time for the version`
      }
      if (!(Date.parse(published) < Date.parse(key.expires))) {
        return `${id} was published on ${published}, after the key ${keyid} that signs it expired on ${key.expires}`
      }
    }
    const matches = await signatureMatches(key.key, `${name}@${version}:${integrity}`, sig)
      .catch(() => false)
    if (!matches) {
      return `${id} has a signature of the key ${keyid} that does not match its name, version and hash`
    }
  }
  return null
}

async function npmSigningKeys() {
  const { keys } = await fetchJson(NPM_SIGNING_KEYS, 'the signing keys of the npm registry')
  if (!Array.isArray(keys)) {
    throw new Error(`could not read the signing keys of the npm registry - ${NPM_SIGNING_KEYS}`)
  }
  return keys
}

async function npmPublishTime(name, version) {
  const packument = await fetchJson(`${NPM_REGISTRY}/${name}`, `the publish times of ${name}`)
  return packument.time?.[version] ?? null
}

async function verifyNpmPackage({ name, version, directory, files }, signingKeys) {
  const id = packageId({ name, version })
  const metadata = await fetchJson(`${NPM_REGISTRY}/${name}/${version}`, `the metadata of ${id}`)
  const integrity = metadata.dist?.integrity ?? null
  if (!strongestSri(integrity)) {
    throw new Error(
      `${id} has no integrity hash in the npm registry - imp installs only a package it can check`,
    )
  }
  let publishTime = null
  const signatureProblem = await registrySignatureProblem(
    { name, version, integrity, signatures: metadata.dist.signatures },
    await signingKeys(),
    () => publishTime ??= npmPublishTime(name, version),
  )
  if (signatureProblem) {
    throw new Error(`signature check failed - ${signatureProblem}; nothing was installed`)
  }
  const tarball = await fetchBytes(metadata.dist.tarball, id)
  if (!await matchesIntegrity(integrity, tarball)) {
    throw new Error(
      `integrity check failed for ${id} - the downloaded package does not match the hash that the npm registry publishes; nothing was installed`,
    )
  }
  const bundled = await Promise.all(files.map(async (path) => ({
    path,
    bytes: await Deno.readFile(join(directory, path)),
  })))
  const problem = bundledFileProblem(id, await tarballFiles(tarball), bundled)
  if (problem) throw new Error(`integrity check failed - ${problem}; nothing was installed`)
  return {
    integrity: strongestSri(integrity).expected,
    attestationListed: Boolean(metadata.dist?.attestations?.provenance),
  }
}

async function jsrAttestationListed({ name, version }) {
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
  let keys = null
  const signingKeys = () => keys ??= npmSigningKeys()
  return await Promise.all(packages.map(async (entry) => {
    if (entry.registry === 'npm') return { ...entry, ...await verifyNpmPackage(entry, signingKeys) }
    return { ...entry, integrity: null, attestationListed: await jsrAttestationListed(entry) }
  }))
}
