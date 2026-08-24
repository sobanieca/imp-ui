import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { toAlign, toDirection, toJustify, toSpace, toWrap } from '../shared/layout.js'
import { applyBox, BOX_PROPS, boxClass, boxStyles } from '../shared/box.js'
import { resolveResponsive } from '../shared/responsive.js'
import { token } from '../shared/css.js'

const NAME = 'flex'

const KNOWN_PROPS = ['direction', 'gap', 'justify', 'align', 'wrap', ...BOX_PROPS]

const declarations = [
  { property: 'flex-direction', variable: 'direction', fallback: 'row' },
  { property: 'gap', variable: 'gap', fallback: token('space-3') },
  { property: 'justify-content', variable: 'justify', fallback: 'flex-start' },
  { property: 'align-items', variable: 'align', fallback: 'stretch' },
  { property: 'flex-wrap', variable: 'wrap', fallback: 'nowrap' },
]

const definition = {
  styles: () => boxStyles('flex', declarations),
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) =>
    applyBox(NAME, div({ class: boxClass(props) }, ...children), props, [
      ['direction', resolveResponsive(NAME, 'direction', props.direction, toDirection(NAME))],
      ['gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 3))],
      ['justify', resolveResponsive(NAME, 'justify', props.justify, toJustify(NAME))],
      ['align', resolveResponsive(NAME, 'align', props.align, toAlign(NAME))],
      ['wrap', resolveResponsive(NAME, 'wrap', props.wrap, toWrap())],
    ]),
}

export const flex = (...args) => defineComponent(NAME, () => definition)(...args)
