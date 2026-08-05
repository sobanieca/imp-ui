import { encodeBase64 } from '@std/encoding/base64'
import { initWasm, Resvg } from '@resvg/resvg-wasm'

const RESVG_WASM_URL = import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm')

let resvgReady = null
export function initResvg() {
  if (!resvgReady) {
    resvgReady = (async () => {
      await initWasm(await WebAssembly.compile(await Deno.readFile(new URL(RESVG_WASM_URL))))
    })()
  }
  return resvgReady
}

export const IMAGE_MEDIA_TYPES = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export const dataUri = (mediaType, bytes) => `data:${mediaType};base64,${encodeBase64(bytes)}`

export const renderSvg = (svg, fitToWidth = null) =>
  new Resvg(svg, fitToWidth ? { fitTo: { mode: 'width', value: fitToWidth } } : undefined).render()

export function composeImage(
  source,
  { width, height, fit = 'stretch', background = null, padding = 0 },
) {
  const inset = Math.round(Math.min(width, height) * padding)
  const drawnWidth = width - inset * 2
  const drawnHeight = height - inset * 2
  const backgroundRect = background
    ? `<rect width="${width}" height="${height}" fill="${background}"/>`
    : ''
  const preserveAspectRatio = fit === 'contain' ? 'xMidYMid meet' : 'none'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${backgroundRect}` +
    `<image href="${source}" x="${inset}" y="${inset}" width="${drawnWidth}" height="${drawnHeight}" ` +
    `preserveAspectRatio="${preserveAspectRatio}"/></svg>`
  return renderSvg(svg, width)
}

const readU32 = (bytes, offset) =>
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) |
    bytes[offset + 3]) >>>
  0

const readU16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1]

export const isAnimatedPng = (bytes) => {
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = readU32(bytes, offset)
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    )
    if (type === 'acTL') return true
    if (type === 'IDAT') return false
    offset += 12 + length
  }
  return false
}

const pngSize = (bytes) => ({ width: readU32(bytes, 16), height: readU32(bytes, 20) })

const jpegSize = (bytes) => {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: readU16(bytes, offset + 5), width: readU16(bytes, offset + 7) }
    }
    offset += 2 + readU16(bytes, offset + 2)
  }
  throw new Error('could not read JPEG dimensions - the file may be corrupt')
}

export const rasterDimensions = (mediaType, bytes) =>
  mediaType === 'image/png' ? pngSize(bytes) : jpegSize(bytes)
