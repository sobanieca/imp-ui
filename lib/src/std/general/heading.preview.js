import { heading } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Heading'
export const group = groups.general

export const levelOne = { scenario: 'Level one', component: heading('Page title') }
export const levelTwo = { scenario: 'Level two', component: heading({ level: 2 }, 'Section title') }
export const levelThree = {
  scenario: 'Level three',
  component: heading({ level: 3 }, 'Subsection title'),
}
export const levelFour = {
  scenario: 'Level four',
  component: heading({ level: 4 }, 'Minor heading'),
}
export const levelFive = {
  scenario: 'Level five',
  component: heading({ level: 5 }, 'Smaller heading'),
}
export const levelSix = {
  scenario: 'Level six',
  component: heading({ level: 6 }, 'Smallest heading'),
}
export const secondaryTone = {
  scenario: 'Secondary tone',
  component: heading({ level: 2, tone: 'secondary' }, 'Muted section title'),
}
export const centered = {
  scenario: 'Centered',
  component: heading({ level: 2, align: 'center' }, 'Centered title'),
}
export const alignedToEnd = {
  scenario: 'Aligned to the end',
  component: heading({ level: 2, align: 'end' }, 'End-aligned title'),
}
export const wrapsLongText = {
  scenario: 'Wraps a long text',
  component: heading(
    'A deliberately long page title that has to wrap across more than one line',
  ),
}
