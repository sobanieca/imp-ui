import { impLogger } from '../../logger.js'
import { defaultTokens } from '../../theme.js'
import { token } from './css.js'

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

const SPACE_TOKEN = /^space-(\d+)$/

let steps = null

const spaceSteps = () => (steps ??= [
  0,
  ...Object.keys(defaultTokens())
    .map((name) => name.match(SPACE_TOKEN)?.[1])
    .filter(Boolean)
    .map(Number),
])

const spaceToken = (step) => (step === 0 ? '0px' : token(`space-${step}`))

export const toSpace = (name, prop, fallbackStep) => (value) => {
  if (spaceSteps().includes(value)) return spaceToken(value)
  impLogger.warn(
    `${name}: '${prop}' must be a spacing step ${
      quoted(spaceSteps())
    } from the theme scale - got '${value}', using ${fallbackStep}`,
  )
  return spaceToken(fallbackStep)
}
