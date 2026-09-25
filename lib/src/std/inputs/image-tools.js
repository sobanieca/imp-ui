const KEEPS_ALPHA = ['image/png', 'image/gif', 'image/svg+xml', 'image/webp']

const JPEG_QUALITY = 0.85

const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg' }

export const isImageFile = (file) => file.type.startsWith('image/')

export const asDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export const decodeImage = (file) => createImageBitmap(file)

export const outputTypeOf = (sourceType) =>
  KEEPS_ALPHA.includes(sourceType) ? 'image/png' : 'image/jpeg'

export const outputNameOf = (sourceName, type) => {
  const stem = String(sourceName || 'image').replace(/\.[^.]*$/, '') || 'image'
  return `${stem}.${EXTENSIONS[type]}`
}

export const fitWithin = (width, height, maxWidth, maxHeight) => {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export const encodeImage = async (source, region, size, type) => {
  const canvas = new OffscreenCanvas(size.width, size.height)
  const context = canvas.getContext('2d')
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    size.width,
    size.height,
  )
  return await canvas.convertToBlob({ type, quality: JPEG_QUALITY })
}

export const embedImage = async (file, maxSize) => {
  const source = await decodeImage(file)
  const region = { x: 0, y: 0, width: source.width, height: source.height }
  const size = fitWithin(source.width, source.height, maxSize, maxSize)
  const blob = await encodeImage(source, region, size, outputTypeOf(file.type))
  source.close()
  return { src: await asDataUrl(blob), ...size }
}
