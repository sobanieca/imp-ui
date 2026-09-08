import { decodeBase64 } from '@std/encoding/base64'
import { applyPalette, decodeJpeg, GIFEncoder, quantize } from './vendor/video.js'

const DEFAULTS = { fps: 10, maxDuration: 30, width: 800, quality: 80 }

const MIN_FRAME_DELAY_MS = 20

export function resolveVideoOptions(config = {}) {
  return {
    fps: config.fps ?? DEFAULTS.fps,
    maxDuration: config.maxDuration ?? DEFAULTS.maxDuration,
    width: config.width ?? DEFAULTS.width,
    quality: config.quality ?? DEFAULTS.quality,
  }
}

export async function startScreencast(page, options) {
  const client = await page.createCDPSession()
  const frames = []
  const onFrame = async ({ data, sessionId, metadata }) => {
    frames.push({ data, timestamp: metadata.timestamp })
    try {
      await client.send('Page.screencastFrameAck', { sessionId })
    } catch { /* session may be gone */ }
  }
  client.on('Page.screencastFrame', onFrame)
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: options.quality,
    maxWidth: options.width,
    maxHeight: options.width,
    everyNthFrame: 1,
  })
  return { client, frames, onFrame }
}

export async function stopScreencast(recording) {
  const { client, frames, onFrame } = recording
  try {
    await client.send('Page.stopScreencast')
  } catch { /* session may be gone */ }
  client.off('Page.screencastFrame', onFrame)
  try {
    await client.detach()
  } catch { /* already detached */ }
  return frames
}

function selectFrames(frames, { fps, maxDuration }) {
  if (!frames.length) return []
  const minSpacing = 1000 / fps
  const base = frames[0].timestamp
  const selected = []
  let lastKeptMs = -Infinity
  for (const frame of frames) {
    const elapsedMs = (frame.timestamp - base) * 1000
    if (elapsedMs > maxDuration * 1000) break
    if (elapsedMs - lastKeptMs < minSpacing) continue
    selected.push({ data: frame.data, elapsedMs })
    lastKeptMs = elapsedMs
  }
  return selected
}

export function encodeGif(frames, options) {
  const selected = selectFrames(frames, options)
  if (!selected.length) return null
  const fallbackDelay = Math.round(1000 / options.fps)
  const gif = GIFEncoder()
  for (let index = 0; index < selected.length; index++) {
    const { data, width, height } = decodeJpeg(decodeBase64(selected[index].data))
    const next = selected[index + 1]
    const delay = next
      ? Math.max(MIN_FRAME_DELAY_MS, Math.round(next.elapsedMs - selected[index].elapsedMs))
      : fallbackDelay
    const palette = quantize(data, 256, { format: 'rgba4444' })
    const indexed = applyPalette(data, palette, 'rgba4444')
    gif.writeFrame(indexed, width, height, { palette, delay })
  }
  gif.finish()
  return gif.bytes()
}
