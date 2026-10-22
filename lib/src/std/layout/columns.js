import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { oneOf } from '../shared/args.js'
import { token } from '../shared/css.js'
import { toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'

const NAME = 'columns'

const VERTICAL_ALIGNMENTS = ['top', 'stretch']

const KNOWN_PROPS = ['weights', 'minInlineSize', 'gap', 'verticalAlign']

const DEFAULT_MIN = '18rem'

const declarations = () => [
  { property: 'gap', variable: 'gap', fallback: token('space-5') },
  { property: '--column-min', variable: 'min', fallback: DEFAULT_MIN },
]

const styles = () => `
  :host {
    display: block;
  }

  .root {
    display: flex;
    flex-wrap: wrap;
    min-inline-size: 0;
  }

  .vertical-top { align-items: flex-start }
  .vertical-stretch { align-items: stretch }

  .column {
    flex: var(--column-weight) 1 calc(var(--column-min) * var(--column-weight));
    min-inline-size: 0;
  }

  ${declarationStyles('.root', declarations())}
`

const weightsOf = (weights, count) => {
  if (weights === undefined) return Array.from({ length: count }, () => 1)
  const usable =
    Array.isArray(weights)
    && weights.length === count
    && weights.every((weight) => typeof weight === 'number' && weight > 0)
  if (usable) return weights
  impLogger.warn(
    `${NAME}: 'weights' must be one positive number per column, like [2, 1] for two columns - using equal columns`,
  )
  return Array.from({ length: count }, () => 1)
}

const minOf = (value) => {
  if (typeof value === 'string' && value.trim() !== '') return value
  impLogger.warn(
    `${NAME}: 'minInlineSize' must be a CSS length, like '20rem' - using ${DEFAULT_MIN}`,
  )
  return DEFAULT_MIN
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    const vertical = oneOf(NAME, 'verticalAlign', props.verticalAlign, VERTICAL_ALIGNMENTS, 'top')
    const weights = weightsOf(props.weights, children.length)
    const root = div(
      { class: ['root', `vertical-${vertical}`] },
      ...children.map((child, index) => {
        const column = div({ class: 'column' }, child)
        column.style.setProperty('--column-weight', String(weights[index]))
        return column
      }),
    )
    return applyValues(root, [
      ['gap', resolveValue(props.gap, toSpace(NAME, 'gap', 5))],
      ['min', resolveValue(props.minInlineSize, minOf)],
    ])
  },
}

export const columns = (...args) => defineComponent(NAME, () => definition)(...args)
