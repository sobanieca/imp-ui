import { encodeBase64 } from '@std/encoding/base64'
import { extname, isAbsolute, join } from '@std/path'
import { initWasm, Resvg } from '@resvg/resvg-wasm'

const RESVG_WASM_URL = import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm')

const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_THEME = '#ffffff'

const MASKABLE_PADDING = 0.1

const ICON_TARGETS = [
  { file: 'icons/icon-192.png', size: 192 },
  { file: 'icons/icon-512.png', size: 512 },
  { file: 'icons/icon-maskable-512.png', size: 512, opaque: true, padding: MASKABLE_PADDING },
  { file: 'icons/apple-touch-icon.png', size: 180, opaque: true },
]

const MANIFEST_ICONS = [
  { file: 'icons/icon-192.png', sizes: '192x192', purpose: 'any' },
  { file: 'icons/icon-512.png', sizes: '512x512', purpose: 'any' },
  { file: 'icons/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
]

export const APPLE_TOUCH_ICON = 'icons/apple-touch-icon.png'

const IMAGE_MEDIA_TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png' }

const resolveIcon = (root, icon) => isAbsolute(icon) ? icon : join(root, icon)

let resvgReady = null
function initResvg() {
  if (!resvgReady) {
    resvgReady = (async () => {
      await initWasm(await WebAssembly.compile(await Deno.readFile(new URL(RESVG_WASM_URL))))
    })()
  }
  return resvgReady
}

async function sourceDataUri(iconPath) {
  const mediaType = IMAGE_MEDIA_TYPES[extname(iconPath).toLowerCase()]
  if (!mediaType) {
    throw new Error(`pwa icon must be an .svg or .png file, got '${iconPath}'`)
  }
  return `data:${mediaType};base64,${encodeBase64(await Deno.readFile(iconPath))}`
}

function renderIcon(dataUri, { size, background = null, padding = 0 }) {
  const inset = Math.round(size * padding)
  const drawn = size - inset * 2
  const backgroundRect = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : ''
  const wrapper =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${backgroundRect}` +
    `<image href="${dataUri}" x="${inset}" y="${inset}" width="${drawn}" height="${drawn}" ` +
    `preserveAspectRatio="xMidYMid meet"/></svg>`
  return new Resvg(wrapper, { fitTo: { mode: 'width', value: size } }).render().asPng()
}

export async function renderIconSet({ root, pwa }) {
  await initResvg()
  const dataUri = await sourceDataUri(resolveIcon(root, pwa.icon))
  const background = pwa.backgroundColor ?? DEFAULT_BACKGROUND
  return ICON_TARGETS.map((target) => ({
    file: target.file,
    bytes: renderIcon(dataUri, {
      size: target.size,
      background: target.opaque ? background : null,
      padding: target.padding ?? 0,
    }),
  }))
}

export function buildManifest(pwa, { iconBase = '', startUrl = '.', scope = './' } = {}) {
  return JSON.stringify(
    {
      name: pwa.name,
      short_name: pwa.shortName ?? pwa.name,
      theme_color: pwa.themeColor ?? DEFAULT_THEME,
      background_color: pwa.backgroundColor ?? DEFAULT_BACKGROUND,
      display: pwa.display ?? 'standalone',
      start_url: startUrl,
      scope,
      icons: MANIFEST_ICONS.map((icon) => ({
        src: `${iconBase}${icon.file}`,
        sizes: icon.sizes,
        type: 'image/png',
        purpose: icon.purpose,
      })),
    },
    null,
    2,
  )
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function cacheVersion(files) {
  const lines = []
  for (const { path, bytes } of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    lines.push(`${path}:${await sha256Hex(bytes)}`)
  }
  return (await sha256Hex(new TextEncoder().encode(lines.join('\n')))).slice(0, 16)
}

export function buildServiceWorker({ cacheName, precache, shell }) {
  return `const CACHE = ${JSON.stringify(cacheName)}
const PRECACHE = ${JSON.stringify(precache)}
const SHELL = ${JSON.stringify(shell)}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    )
    return
  }
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)))
})
`
}

export function pwaHeadTags({ manifestHref, themeColor, appleTouchHref, swHref = null }) {
  const tags = [
    `<link rel="manifest" href="${manifestHref}">`,
    themeColor ? `<meta name="theme-color" content="${themeColor}">` : null,
    `<link rel="apple-touch-icon" href="${appleTouchHref}">`,
  ]
  if (swHref) {
    tags.push(
      `<script>if('serviceWorker' in navigator)addEventListener('load',` +
        `()=>navigator.serviceWorker.register(${JSON.stringify(swHref)}))</script>`,
    )
  }
  return tags.filter(Boolean).join('\n')
}

export async function validatePwaBuild(pwa, isHtmlEntry, root) {
  if (!pwa) {
    throw new Error("--pwa requires a 'pwa' block in imp.json (name, icon, …)")
  }
  if (!isHtmlEntry) {
    throw new Error('--pwa applies to an HTML page — a JS component build has no PWA to emit')
  }
  if (!pwa.name) {
    throw new Error("invalid imp.json — 'pwa.name' is required to build with --pwa")
  }
  if (!pwa.icon) {
    throw new Error("invalid imp.json — 'pwa.icon' is required to build with --pwa")
  }
  const iconPath = resolveIcon(root, pwa.icon)
  if (!IMAGE_MEDIA_TYPES[extname(iconPath).toLowerCase()]) {
    throw new Error(`invalid imp.json — 'pwa.icon' must be an .svg or .png file, got '${pwa.icon}'`)
  }
  try {
    await Deno.stat(iconPath)
  } catch {
    throw new Error(`pwa icon not found: ${pwa.icon}`)
  }
}
