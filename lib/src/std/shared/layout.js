import { createLogger } from '../../logger.js'

const log = createLogger('imp')

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

export const SPACE_STEPS = [0, 1, 2, 3, 4, 5, 6]

const SPACE_FALLBACKS = ['0px', '4px', '8px', '12px', '16px', '24px', '32px']

export const spaceToken = (step) =>
  step === 0 ? '0px' : `var(--imp-space-${step}, ${SPACE_FALLBACKS[step]})`

export const toSpace = (name, prop, fallbackStep) => (value) => {
  if (SPACE_STEPS.includes(value)) return spaceToken(value)
  log.warn(
    `${name}: '${prop}' must be a spacing step ${
      quoted(SPACE_STEPS)
    } from the theme scale — got '${value}', using ${fallbackStep}`,
  )
  return spaceToken(fallbackStep)
}

export const DIRECTIONS = ['row', 'column', 'row-reverse', 'column-reverse']

export const JUSTIFY = ['start', 'center', 'end', 'between', 'around', 'evenly']

const JUSTIFY_VALUES = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

export const ALIGN = ['start', 'center', 'end', 'stretch', 'baseline']

const ALIGN_VALUES = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}

export const toKeyword = (name, prop, values, fallback) => (value) => {
  if (Object.hasOwn(values, value)) return values[value]
  log.warn(
    `${name}: '${prop}' must be one of ${
      quoted(Object.keys(values))
    } — got '${value}', using '${fallback}'`,
  )
  return values[fallback]
}

export const toDirection = (name) => (value) => {
  if (DIRECTIONS.includes(value)) return value
  log.warn(
    `${name}: 'direction' must be one of ${quoted(DIRECTIONS)} — got '${value}', ignoring it`,
  )
  return null
}

export const toJustify = (name) => toKeyword(name, 'justify', JUSTIFY_VALUES, 'start')

export const toAlign = (name) => toKeyword(name, 'align', ALIGN_VALUES, 'stretch')

export const toWrap = () => (value) => (value ? 'wrap' : 'nowrap')

export const GRID_PLACEMENT = ['start', 'center', 'end', 'stretch']

const GRID_PLACEMENT_VALUES = Object.fromEntries(
  GRID_PLACEMENT.map((placement) => [placement, placement]),
)

export const toGridPlacement = (name, prop) =>
  toKeyword(name, prop, GRID_PLACEMENT_VALUES, 'stretch')

export const MAX_COLUMNS = 12

const columnRange = `1–${MAX_COLUMNS}`

const wholeNumberInRange = (value, max) => Number.isInteger(value) && value >= 1 && value <= max

export const toColumns = (name) => (value) => {
  if (wholeNumberInRange(value, MAX_COLUMNS)) return `repeat(${value}, minmax(0, 1fr))`
  log.warn(
    `${name}: 'columns' must be a whole number ${columnRange} — got '${value}', using 1`,
  )
  return 'repeat(1, minmax(0, 1fr))'
}

export const toSpan = (name) => (value) => {
  if (value === 'full') return '1 / -1'
  if (wholeNumberInRange(value, MAX_COLUMNS)) return `span ${value}`
  log.warn(
    `${name}: 'span' must be a whole number ${columnRange} or 'full' — got '${value}', using 1`,
  )
  return 'span 1'
}

export const toRowSpan = (name) => (value) => {
  if (wholeNumberInRange(value, MAX_COLUMNS)) return `span ${value}`
  log.warn(
    `${name}: 'rowSpan' must be a whole number ${columnRange} — got '${value}', using 1`,
  )
  return 'span 1'
}

export const toStart = (name) => (value) => {
  if (wholeNumberInRange(value, MAX_COLUMNS)) return String(value)
  log.warn(
    `${name}: 'start' must be a column line ${columnRange} — got '${value}', placing it automatically`,
  )
  return 'auto'
}

export const toOrder = (name) => (value) => {
  if (Number.isInteger(value)) return String(value)
  log.warn(`${name}: 'order' must be a whole number — got '${value}', using 0`)
  return '0'
}
