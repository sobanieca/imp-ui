import { heading } from 'imp/std'

export const levelOne = heading('Page title')
export const levelTwo = heading({ level: 2 }, 'Section title')
export const levelThree = heading({ level: 3 }, 'Subsection title')
export const levelFour = heading({ level: 4 }, 'Minor heading')
export const levelFive = heading({ level: 5 }, 'Smaller heading')
export const levelSix = heading({ level: 6 }, 'Smallest heading')
export const secondaryTone = heading({ level: 2, tone: 'secondary' }, 'Muted section title')
export const centered = heading({ level: 2, align: 'center' }, 'Centered title')
export const alignedToEnd = heading({ level: 2, align: 'end' }, 'End-aligned title')
export const wrapsLongText = heading(
  'A deliberately long page title that has to wrap across more than one line',
)
