import { formatSize } from '../cli/src/file_size.js'

const BINARY = Deno.build.os === 'windows' ? 'imp.exe' : 'imp'
const LIMIT_FILE = new URL('../binary-size-limit.json', import.meta.url)

const describe = (bytes) => `${formatSize(bytes)} (${bytes.toLocaleString('en-US')} bytes)`

const { target, maxBytes } = JSON.parse(await Deno.readTextFile(LIMIT_FILE))

const info = await Deno.stat(new URL(`../${BINARY}`, import.meta.url)).catch(() => null)
if (!info) {
  console.error(`error: ${BINARY} not found - run "deno task compile" first`)
  Deno.exit(1)
}

if (target !== Deno.build.target) {
  console.log(`note: limit was recorded for ${target}, measuring on ${Deno.build.target}`)
}

console.log(`imp binary: ${describe(info.size)}`)
console.log(`size limit: ${describe(maxBytes)}`)

if (info.size > maxBytes) {
  const over = ((info.size / maxBytes - 1) * 100).toFixed(1)
  console.error(
    `error: imp binary exceeds the size limit by ${describe(info.size - maxBytes)} (+${over}%)`,
  )
  console.error('shrink the binary or raise "maxBytes" in binary-size-limit.json')
  Deno.exit(1)
}

const headroom = ((1 - info.size / maxBytes) * 100).toFixed(1)
console.log(`within limit - ${headroom}% headroom`)
