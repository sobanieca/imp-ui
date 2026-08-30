import { dirname, fromFileUrl } from '@std/path'
import { FMT_PLUGINS, wasmUrl } from '../cli/src/fmt_plugins.js'

const REGISTRY_URL = 'https://plugins.dprint.dev/info.json'
const PLUGINS_SOURCE_URL = new URL('../cli/src/fmt_plugins.js', import.meta.url)

const sha256 = async (bytes) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const versionlessUrl = (url) => url.replace(/-v?[\d.]+\.wasm$/, '')

const fetchBytes = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    console.error(`error: fetching ${url} failed (${response.status})`)
    Deno.exit(1)
  }
  return new Uint8Array(await response.arrayBuffer())
}

const registry = JSON.parse(new TextDecoder().decode(await fetchBytes(REGISTRY_URL)))
const latestByVersionlessUrl = new Map(
  registry.latest.map((entry) => [versionlessUrl(entry.url), entry]),
)

let source = await Deno.readTextFile(PLUGINS_SOURCE_URL)
let updated = 0

for (const plugin of FMT_PLUGINS) {
  const latest = latestByVersionlessUrl.get(versionlessUrl(plugin.url))
  if (!latest) {
    console.error(`warning: no dprint registry entry matches ${plugin.url}`)
    continue
  }
  if (latest.url === plugin.url) continue
  const bytes = await fetchBytes(latest.url)
  const digest = await sha256(bytes)
  const latestFile = latest.url.slice(latest.url.lastIndexOf('/') + 1)
  const target = fromFileUrl(wasmUrl(latestFile))
  await Deno.mkdir(dirname(target), { recursive: true })
  await Deno.writeFile(target, bytes)
  await Deno.remove(fromFileUrl(wasmUrl(plugin.file))).catch(() => {})
  source = source
    .replaceAll(plugin.file, latestFile)
    .replaceAll(plugin.url, latest.url)
    .replaceAll(plugin.sha256, digest)
  console.error(`${plugin.file} -> ${latestFile}`)
  updated++
}

if (updated) {
  await Deno.writeTextFile(PLUGINS_SOURCE_URL, source)
  console.error(`updated ${updated} formatter plugin${updated === 1 ? '' : 's'}`)
} else {
  console.error('formatter plugins are up to date')
}
