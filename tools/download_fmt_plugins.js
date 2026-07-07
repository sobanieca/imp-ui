import { dirname, fromFileUrl } from '@std/path'
import { FMT_PLUGINS, wasmUrl } from '../cli/src/fmt_plugins.js'

const sha256 = async (bytes) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const existingChecksum = async (path) => {
  try {
    return await sha256(await Deno.readFile(path))
  } catch {
    return null
  }
}

for (const plugin of FMT_PLUGINS) {
  const target = fromFileUrl(wasmUrl(plugin.file))
  if (await existingChecksum(target) === plugin.sha256) continue
  console.error(`vendoring ${plugin.file}…`)
  const response = await fetch(plugin.url)
  if (!response.ok) {
    console.error(`error: fetching ${plugin.url} failed (${response.status})`)
    Deno.exit(1)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const digest = await sha256(bytes)
  if (digest !== plugin.sha256) {
    console.error(`error: checksum mismatch for ${plugin.file} (got ${digest})`)
    Deno.exit(1)
  }
  await Deno.mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  await Deno.writeFile(temporary, bytes)
  await Deno.rename(temporary, target)
}
