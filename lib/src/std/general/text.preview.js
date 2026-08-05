import { text } from 'imp/std'

export const name = 'Text'
export const category = 'General'
export const description = "Run 'imp skill std/text' to learn what text can do before using it."

export const paragraph = text('The quick brown fox jumps over the lazy dog.')
export const secondaryTone = text({ tone: 'secondary' }, 'Supporting copy in a muted tone.')
export const small = text({ size: 'sm' }, 'Small text.')
export const medium = text({ size: 'md' }, 'Medium text.')
export const large = text({ size: 'lg' }, 'Large text.')
export const mediumWeight = text({ weight: 'medium' }, 'Medium weight text.')
export const boldWeight = text({ weight: 'bold' }, 'Bold text.')
export const centered = text({ align: 'center' }, 'Centered text.')
export const alignedToEnd = text({ align: 'end' }, 'End-aligned text.')
export const inline = text({ inline: true }, 'Inline text that flows with its neighbours.')
export const longParagraph = text(
  'A longer paragraph that runs past a single line so the line height and measure are visible: the quick brown fox jumps over the lazy dog, again and again, until the text wraps.',
)
