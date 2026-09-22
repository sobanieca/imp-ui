import { defineComponent } from '../shared/define.js'
import { div, span } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { oneOf } from '../shared/args.js'
import { token } from '../shared/css.js'

const NAME = 'skeleton'

const KNOWN_PROPS = ['shape', 'lines']

const SHAPES = ['text', 'circle', 'block']

const MAX_LINES = 20

const styles = () => `
  .root {
    --skeleton-fill: color-mix(in oklab, ${token('color-border')} 85%, ${token('color-surface')});
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    box-sizing: border-box;
    inline-size: var(--imp-skeleton-inline-size, 100%);
    max-inline-size: 100%;
  }

  .bone {
    display: block;
    box-sizing: border-box;
    background-color: var(--skeleton-fill);
    animation: imp-skeleton-pulse 1600ms ease-in-out infinite alternate;
  }

  .shape-text .bone {
    inline-size: 100%;
    block-size: 0.75em;
    margin-block: calc((${token('line-height-normal')} * 1em - 0.75em) / 2);
    border-radius: ${token('radius-item')};
    font-size: ${token('font-size-md')};
  }

  .shape-text {
    gap: 0;
  }

  .shape-text .bone:last-child:not(:first-child) {
    inline-size: 60%;
  }

  .shape-circle {
    inline-size: var(--imp-skeleton-inline-size, 2.5rem);
  }

  .shape-circle .bone {
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .shape-block .bone {
    block-size: var(--imp-skeleton-block-size, 8rem);
    border-radius: ${token('radius-container')};
  }

  @keyframes imp-skeleton-pulse {
    from { opacity: 1 }
    to { opacity: 0.55 }
  }

  @media (prefers-reduced-motion: reduce) {
    .bone { animation: none }
  }

  @media (forced-colors: active) {
    .bone {
      border: ${token('border-width')} solid GrayText;
      background-color: Canvas;
    }
  }
`

const lineCount = (given) => {
  if (given === undefined || given === null) return 1
  if (Number.isInteger(given) && given >= 1 && given <= MAX_LINES) return given
  impLogger.warn(`${NAME}: 'lines' must be a whole number from 1 to ${MAX_LINES} - using 1`)
  return 1
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - it stands in for content that loads`)
    }
    const shape = oneOf(NAME, 'shape', props.shape, SHAPES, 'text')
    if (shape !== 'text' && props.lines !== undefined) {
      impLogger.warn(`${NAME}: 'lines' applies to the 'text' shape only`)
    }
    const count = shape === 'text' ? lineCount(props.lines) : 1
    return div(
      { class: ['root', `shape-${shape}`], 'aria-hidden': 'true' },
      ...Array.from({ length: count }, () => span({ class: 'bone' })),
    )
  },
}

export const skeleton = (...args) => defineComponent(NAME, () => definition)(...args)
