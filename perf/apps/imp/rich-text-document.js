const WORDS = [
  'editor',
  'value',
  'markdown',
  'image',
  'person',
  'types',
  'every',
  'block',
  'state',
  'form',
  'the',
  'a',
  'of',
  'and',
  'with',
  'text',
  'line',
  'page',
  'list',
  'quote',
]

export const IMAGE_COUNT = 5

export const PARAGRAPH_COUNT = 60

const WORDS_PER_PARAGRAPH = 50

const IMAGE_EDGE = 640

const sentence = (seed, length) =>
  Array.from({ length }, (_, index) => WORDS[(seed * 7 + index * 3) % WORDS.length]).join(' ')

const noiseImage = async (seed) => {
  const canvas = new OffscreenCanvas(IMAGE_EDGE, (IMAGE_EDGE * 3) / 4)
  const context = canvas.getContext('2d')
  const pixels = context.createImageData(canvas.width, canvas.height)
  let value = seed * 2654435761
  for (let index = 0; index < pixels.data.length; index++) {
    value = (value * 1103515245 + 12345) >>> 0
    pixels.data[index] = index % 4 === 3 ? 255 : value >>> 24
  }
  context.putImageData(pixels, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
  return await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

export const makeRichTextDocument = async () => {
  const images = await Promise.all(
    Array.from({ length: IMAGE_COUNT }, (_, index) => noiseImage(index + 1)),
  )
  const blocks = []
  const imageEvery = Math.floor(PARAGRAPH_COUNT / IMAGE_COUNT)
  for (let index = 0; index < PARAGRAPH_COUNT; index++) {
    if (index % 12 === 0) blocks.push(`## ${sentence(index, 4)}`)
    if (index % 9 === 4) {
      blocks.push([0, 1, 2].map((item) => `- ${sentence(index + item, 8)}`).join('\n'))
    }
    blocks.push(`**${sentence(index, 3)}** ${sentence(index + 1, WORDS_PER_PARAGRAPH - 3)}`)
    if (index % imageEvery === imageEvery - 1) {
      const image = images[Math.floor(index / imageEvery)]
      blocks.push(`Figure ${index}: ![figure ${index}](${image}) ${sentence(index, 6)}`)
    }
  }
  return blocks.join('\n\n')
}
