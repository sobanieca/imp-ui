import { extname, isAbsolute, join } from '@std/path'
import { composeImage, dataUri, IMAGE_MEDIA_TYPES, initResvg, rasterDimensions } from './image.js'
import { logger } from './logger.js'

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

const resolveIcon = (root, icon) => isAbsolute(icon) ? icon : join(root, icon)

const renderIcon = (source, { size, background = null, padding = 0 }) =>
  composeImage(source, { width: size, height: size, fit: 'contain', background, padding }).asPng()

function warnIfUpscaling(icon, mediaType, bytes) {
  if (mediaType === 'image/svg+xml') return
  const source = rasterDimensions(mediaType, bytes)
  const largestTarget = Math.max(...ICON_TARGETS.map((target) => target.size))
  if (Math.max(source.width, source.height) >= largestTarget) return
  logger.warn(
    `pwa icon ${icon} is ${source.width}x${source.height} - icons up to ` +
      `${largestTarget}x${largestTarget} will be upscaled, so some quality loss is expected; ` +
      `use an SVG or a source at least ${largestTarget}px on its longest edge for sharp icons`,
  )
}

export async function renderIconSet({ root, pwa }) {
  await initResvg()
  const iconPath = resolveIcon(root, pwa.icon)
  const mediaType = IMAGE_MEDIA_TYPES[extname(iconPath).toLowerCase()]
  if (!mediaType) {
    throw new Error(`pwa icon must be an .svg, .png, or .jpg file, got '${iconPath}'`)
  }
  const bytes = await Deno.readFile(iconPath)
  warnIfUpscaling(pwa.icon, mediaType, bytes)
  const source = dataUri(mediaType, bytes)
  const background = pwa.backgroundColor ?? DEFAULT_BACKGROUND
  return ICON_TARGETS.map((target) => ({
    file: target.file,
    bytes: renderIcon(source, {
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
    throw new Error("--pwa requires a 'pwa' block in imp.json (name, icon, ...)")
  }
  if (!isHtmlEntry) {
    throw new Error('--pwa applies to an HTML page - a JS component build has no PWA to emit')
  }
  if (!pwa.name) {
    throw new Error("invalid imp.json - 'pwa.name' is required to build with --pwa")
  }
  if (!pwa.icon) {
    throw new Error("invalid imp.json - 'pwa.icon' is required to build with --pwa")
  }
  const iconPath = resolveIcon(root, pwa.icon)
  if (!IMAGE_MEDIA_TYPES[extname(iconPath).toLowerCase()]) {
    throw new Error(
      `invalid imp.json - 'pwa.icon' must be an .svg, .png, or .jpg file, got '${pwa.icon}'`,
    )
  }
  try {
    await Deno.stat(iconPath)
  } catch {
    throw new Error(`pwa icon not found: ${pwa.icon}`)
  }
}
