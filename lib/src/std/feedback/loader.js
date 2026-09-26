import { defineComponent } from '../shared/define.js'
import { div, span } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue, oneOf } from '../shared/args.js'
import { SIZES, token, visuallyHidden } from '../shared/css.js'
import { spinnerNode, spinnerStyles } from '../shared/spinner.js'
import { resolveClient } from './client.js'
import { colorNames } from './progress-css.js'

const NAME = 'loader'

const KNOWN_PROPS = ['label', 'size', 'color', 'client']

const colorRules = () =>
  colorNames()
    .map((name) => `  .color-${name} { color: ${token(`color-${name}`)} }`)
    .join('\n')

const styles = () => `
  .root {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
  }

  .root[hidden] {
    display: none;
  }

${colorRules()}

  .size-sm { --spinner-size: 1rem; --spinner-stroke: 2px }
  .size-md { --spinner-size: 2rem; --spinner-stroke: 3px }
  .size-lg { --spinner-size: 3rem; --spinner-stroke: 4px }

  ${spinnerStyles()}

  .words {${visuallyHidden}}

  @media (forced-colors: active) {
    .root {
      color: CanvasText;
      forced-color-adjust: none;
    }
  }
`

const followClient = (self, root, given) => {
  root.hidden = true
  const client = resolveClient(NAME, self, given)
  if (client === null) return
  bindValue(self, client.pending, (count) => {
    root.hidden = !(count > 0)
  })
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the words as 'label'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it is what a screen reader announces`)
    }
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const color = oneOf(NAME, 'color', props.color, colorNames(), 'primary')
    const root = div(
      { class: ['root', `size-${size}`, `color-${color}`], role: 'status' },
      spinnerNode(),
      span({ class: 'words' }, bindText(self, props.label ?? '')),
    )
    if (props.client !== undefined) followClient(self, root, props.client)
    return root
  },
}

export const loader = (...args) => defineComponent(NAME, () => definition)(...args)
