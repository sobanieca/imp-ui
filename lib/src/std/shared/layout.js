import { impLogger } from '../../logger.js'
import { defaultTokens } from '../../theme.js'
import { token } from './css.js'

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

const SPACE_TOKEN = /^space-(\d+)$/

let steps = null

export const spaceSteps = () => (steps ??= [
  0,
  ...Object.keys(defaultTokens())
    .map((name) => name.match(SPACE_TOKEN)?.[1])
    .filter(Boolean)
    .map(Number),
])

export const spaceToken = (step) => (step === 0 ? '0px' : token(`space-${step}`))

export const toSpace = (name, prop, fallbackStep) => (value) => {
  if (spaceSteps().includes(value)) return spaceToken(value)
  impLogger.warn(
    `${name}: '${prop}' must be a spacing step ${
      quoted(spaceSteps())
    } from the theme scale - got '${value}', using ${fallbackStep}`,
  )
  return spaceToken(fallbackStep)
}

export const DIRECTIONS = ['row', 'column', 'row-reverse', 'column-reverse']

const JUSTIFY_VALUES = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

const ALIGN_VALUES = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}

export const toKeyword = (name, prop, values, fallback) => (value) => {
  if (Object.hasOwn(values, value)) return values[value]
  impLogger.warn(
    `${name}: '${prop}' must be one of ${
      quoted(Object.keys(values))
    } - got '${value}', using '${fallback}'`,
  )
  return values[fallback]
}

export const toDirection = (name) => (value) => {
  if (DIRECTIONS.includes(value)) return value
  impLogger.warn(
    `${name}: 'direction' must be one of ${quoted(DIRECTIONS)} - got '${value}', ignoring it`,
  )
  return null
}

export const toJustify = (name) => toKeyword(name, 'justify', JUSTIFY_VALUES, 'start')

export const toAlign = (name) => toKeyword(name, 'align', ALIGN_VALUES, 'stretch')

export const toWrap = () => (value) => (value ? 'wrap' : 'nowrap')

export const toGrow = (name) => (value) => {
  if (value === true) return '1 1 0'
  if (value === false || value === 0) return '0 1 auto'
  if (Number.isInteger(value) && value > 0) return `${value} 1 0`
  impLogger.warn(
    `${name}: 'grow' must be a boolean or a whole number 0 or greater - got '${value}', ignoring it`,
  )
  return null
}

const GRID_PLACEMENT_VALUES = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'stretch',
}

export const toGridPlacement = (name, prop) =>
  toKeyword(name, prop, GRID_PLACEMENT_VALUES, 'stretch')

const MAX_COLUMNS = 12

const columnRange = `1-${MAX_COLUMNS}`

const wholeNumberInRange = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_COLUMNS

export const toColumns = (name) => (value) => {
  if (wholeNumberInRange(value)) return `repeat(${value}, minmax(0, 1fr))`
  impLogger.warn(
    `${name}: 'columns' must be a whole number ${columnRange} - got '${value}', using 1`,
  )
  return 'repeat(1, minmax(0, 1fr))'
}
