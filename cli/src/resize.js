import { extname, isAbsolute, join, relative } from '@std/path'
import {
  composeImage,
  dataUri,
  IMAGE_MEDIA_TYPES,
  initResvg,
  isAnimatedPng,
  rasterDimensions,
} from './image.js'
import { encodeJpeg } from './vendor/video.js'
import { formatSize, maxFileBytes } from './file-size.js'
import { loadImpConfig } from './config.js'
import { logger } from './logger.js'

const JPEG_QUALITY = 92
const RECOMMENDED_MAX_EDGE = 1920

const RASTER_ENCODERS = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg' }

const DEFERRED_TYPES = new Set(['.webp', '.gif'])

function targetDimensions(source, width, height, stretch) {
  if (width !== null && height !== null) {
    if (stretch) {
      return { width: Math.min(width, source.width), height: Math.min(height, source.height) }
    }
    const scale = Math.min(width / source.width, height / source.height, 1)
    return {
      width: Math.max(1, Math.round(source.width * scale)),
      height: Math.max(1, Math.round(source.height * scale)),
    }
  }
  if (width !== null) {
    const w = Math.min(width, source.width)
    return { width: w, height: Math.max(1, Math.round(source.height * w / source.width)) }
  }
  const h = Math.min(height, source.height)
  return { width: Math.max(1, Math.round(source.width * h / source.height)), height: h }
}

const encodeResized = (rendered, encoder) =>
  encoder === 'png' ? rendered.asPng() : encodeJpeg(
    { data: rendered.pixels, width: rendered.width, height: rendered.height },
    JPEG_QUALITY,
  )

function recommend(display, source, byteSize, maxBytes) {
  const longestEdge = Math.max(source.width, source.height)
  const oversized = byteSize > maxBytes || longestEdge > RECOMMENDED_MAX_EDGE
  logger.info(`${display} is ${source.width}x${source.height}, ${formatSize(byteSize)}`)
  if (!oversized) {
    logger.info('already within the size budget - nothing to resize')
    return
  }
  const suggestedEdge = longestEdge > RECOMMENDED_MAX_EDGE
    ? RECOMMENDED_MAX_EDGE
    : Math.max(1, Math.round(longestEdge * 0.75))
  const axis = source.width >= source.height ? '-w' : '-h'
  logger.info(`to shrink it, run:  imp resize ${display} ${axis} ${suggestedEdge}`)
  logger.info(
    'resize keeps quality high with minimal compression - reach for a dedicated image tool for fine-grained control',
  )
}

export async function resize({ root, image, width, height, output, stretch = false }) {
  if (!image) {
    throw new Error('usage: imp resize <image> [-w <px>] [-h <px>] [--output <path>] [--stretch]')
  }
  const extension = extname(image).toLowerCase()
  if (DEFERRED_TYPES.has(extension)) {
    throw new Error(
      `${extension} images are not yet supported - imp resize currently handles .png and .jpg`,
    )
  }
  const encoder = RASTER_ENCODERS[extension]
  if (!encoder) {
    throw new Error(
      `unsupported image format '${extension || image}' - imp resize handles .png and .jpg`,
    )
  }
  const mediaType = IMAGE_MEDIA_TYPES[extension]
  if (stretch && (width === null || height === null)) {
    throw new Error('--stretch requires both -w and -h - without it aspect ratio is always kept')
  }

  const path = isAbsolute(image) ? image : join(root, image)
  const display = relative(root, path) || image
  let bytes
  try {
    bytes = await Deno.readFile(path)
  } catch {
    throw new Error(`image not found: ${image}`)
  }
  if (encoder === 'png' && isAnimatedPng(bytes)) {
    throw new Error('animated PNG (APNG) is not yet supported')
  }

  const source = rasterDimensions(mediaType, bytes)

  if (width === null && height === null) {
    const config = await loadImpConfig(root)
    recommend(display, source, bytes.length, maxFileBytes(config))
    return
  }

  const target = targetDimensions(source, width, height, stretch)
  if (target.width === source.width && target.height === source.height) {
    logger.info(
      `${display} is already ${source.width}x${source.height} - requested size would upscale it, so nothing was changed`,
    )
    return
  }

  await initResvg()
  const rendered = composeImage(dataUri(mediaType, bytes), target)
  const encoded = encodeResized(rendered, encoder)

  const outPath = output ? (isAbsolute(output) ? output : join(root, output)) : path
  await Deno.writeFile(outPath, encoded)

  const outDisplay = relative(root, outPath) || output || display
  logger.info(
    `${display} ${source.width}x${source.height} ${formatSize(bytes.length)} -> ` +
      `${outDisplay} ${target.width}x${target.height} ${formatSize(encoded.length)}`,
  )
}
