import { defineComponent } from '../shared/define.js'
import { span } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { paletteNames } from '../../theme-colors.js'
import { fontFamily, SIZES, token } from '../shared/css.js'

const NAME = 'tag'

const KNOWN_PROPS = ['color', 'size', 'dot', 'label']

const NEUTRAL = 'neutral'

let names = null

const colorNames = () => (names ??= [NEUTRAL, ...paletteNames()])

const colorToken = (name) => token(name === NEUTRAL ? 'color-secondary' : `color-${name}`)

const colorRules = () =>
  colorNames()
    .map((name) => `  .color-${name} { --tag-color: ${colorToken(name)} }`)
    .join('\n')

const styles = () => `
  .tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-1')};
    box-sizing: border-box;
    min-inline-size: var(--tag-size);
    block-size: var(--tag-size);
    padding-inline: var(--tag-padding);
    border: ${token('border-width')} solid color-mix(in oklab, var(--tag-color) 30%, transparent);
    border-radius: ${token('radius-item')};
    background-color: color-mix(in oklab, var(--tag-color) 14%, transparent);
    ${fontFamily()}
    color: color-mix(in oklab, var(--tag-color) 62%, ${token('color-text')});
    font-weight: ${token('font-weight-bold')};
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    line-height: 1;
    white-space: nowrap;
    max-inline-size: 100%;
  }

  .text {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dot {
    flex: none;
    inline-size: var(--tag-dot-size);
    block-size: var(--tag-dot-size);
    border-radius: 50%;
    background-color: var(--tag-color);
  }

  .bare {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
  }

  .bare .dot {
    inline-size: calc(var(--tag-dot-size) * 1.25);
    block-size: calc(var(--tag-dot-size) * 1.25);
  }

  .size-sm {
    --tag-size: 1.25rem;
    --tag-dot-size: 0.375rem;
    --tag-padding: ${token('space-1')};
    font-size: 0.75rem;
  }

  .size-md {
    --tag-size: 1.5rem;
    --tag-dot-size: 0.5rem;
    --tag-padding: ${token('space-2')};
    font-size: ${token('font-size-sm')};
  }

  .size-lg {
    --tag-size: 1.75rem;
    --tag-dot-size: 0.625rem;
    --tag-padding: ${token('space-3')};
    font-size: ${token('font-size-md')};
  }

${colorRules()}

  @media (forced-colors: active) {
    .tag {
      border-color: CanvasText;
      color: CanvasText;
    }

    .dot {
      background-color: CanvasText;
    }
  }
`

const bareDot = (self, label, classes) => {
  const bare = span({ class: ['bare', ...classes], role: 'img' }, span({ class: 'dot' }))
  if (label === undefined) {
    impLogger.warn(`${NAME}: a dot with no text needs a 'label' - it is the accessible name`)
    return bare
  }
  bindValue(self, label, (value) => bare.setAttribute('aria-label', String(value)))
  return bare
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const color = oneOf(NAME, 'color', props.color, colorNames(), NEUTRAL)
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const classes = [`color-${color}`, `size-${size}`]
    const dot = Boolean(props.dot)
    if (dot && children.length === 0) return bareDot(self, props.label, classes)
    if (props.label !== undefined) {
      impLogger.warn(`${NAME}: 'label' names a dot with no text only - ignoring it`)
    }
    return span(
      { class: ['tag', ...classes] },
      dot ? span({ class: 'dot', 'aria-hidden': 'true' }) : null,
      span({ class: 'text' }, ...children),
    )
  },
}

export const tag = (...args) => defineComponent(NAME, () => definition)(...args)
