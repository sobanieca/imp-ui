import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { applyBox, BOX_PROPS, boxClass, boxStyles } from '../shared/box.js'

const NAME = 'box'

const definition = {
  styles: () => boxStyles('block'),
  props: BOX_PROPS,
  onMount: (_instance, props, children) =>
    applyBox(NAME, div({ class: boxClass(props) }, ...children), props),
}

export const box = (...args) => defineComponent(NAME, () => definition)(...args)
