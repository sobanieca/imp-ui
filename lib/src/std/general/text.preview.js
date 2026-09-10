import { text } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Text'
export const group = groups.general

export const paragraph = {
  scenario: 'Paragraph',
  component: text('The quick brown fox jumps over the lazy dog.'),
}
export const secondaryTone = {
  scenario: 'Secondary tone',
  component: text({ tone: 'secondary' }, 'Supporting copy in a muted tone.'),
}
export const small = { scenario: 'Small', component: text({ size: 'sm' }, 'Small text.') }
export const medium = { scenario: 'Medium', component: text({ size: 'md' }, 'Medium text.') }
export const large = { scenario: 'Large', component: text({ size: 'lg' }, 'Large text.') }
export const boldWeight = {
  scenario: 'Bold weight',
  component: text({ weight: 'bold' }, 'Bold text.'),
}
export const centered = {
  scenario: 'Centered',
  component: text({ align: 'center' }, 'Centered text.'),
}
export const alignedToEnd = {
  scenario: 'Aligned to the end',
  component: text({ align: 'end' }, 'End-aligned text.'),
}
export const inline = {
  scenario: 'Inline',
  component: text({ inline: true }, 'Inline text that flows with its neighbours.'),
}
export const longParagraph = {
  scenario: 'Long paragraph',
  component: text(
    'A longer paragraph that runs past a single line so the line height and measure are visible: the quick brown fox jumps over the lazy dog, again and again, until the text wraps.',
  ),
}
