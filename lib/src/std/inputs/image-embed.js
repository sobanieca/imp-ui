const KEEPS_ALPHA = ['image/png', 'image/gif', 'image/svg+xml', 'image/webp']

const JPEG_QUALITY = 0.85

const asDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export const isImageFile = (file) => file.type.startsWith('image/')

export const embedImage = async (file, maxSize) => {
  const source = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  source.close()
  const type = KEEPS_ALPHA.includes(file.type) ? 'image/png' : 'image/jpeg'
  const blob = await canvas.convertToBlob({ type, quality: JPEG_QUALITY })
  return { src: await asDataUrl(blob), width, height }
}
