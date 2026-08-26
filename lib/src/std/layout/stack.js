import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { toAlign, toDirection, toJustify, toSpace, toWrap } from '../shared/layout.js'
import { applyBox, BOX_PROPS, boxClass, boxStyles } from '../shared/box.js'
import { resolveResponsive } from '../shared/responsive.js'
import { token } from '../shared/css.js'

const NAME = 'stack'

const KNOWN_PROPS = ['direction', 'gap', 'align', 'justify', 'wrap', ...BOX_PROPS]

const declarations = [
  { property: 'flex-direction', variable: 'direction', fallback: 'column' },
  { property: 'gap', variable: 'gap', fallback: token('space-4') },
  { property: 'align-items', variable: 'align', fallback: 'stretch' },
  { property: 'justify-content', variable: 'justify', fallback: 'flex-start' },
  { property: 'flex-wrap', variable: 'wrap', fallback: 'wrap' },
]

const definition = {
  styles: () =>
    boxStyles(
      'flex',
      declarations,
      `
  .root {
    min-inline-size: 0;
  }
`,
    ),
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) =>
    applyBox(NAME, div({ class: boxClass(props) }, ...children), props, [
      ['direction', resolveResponsive(NAME, 'direction', props.direction, toDirection(NAME))],
      ['gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 4))],
      ['align', resolveResponsive(NAME, 'align', props.align, toAlign(NAME))],
      ['justify', resolveResponsive(NAME, 'justify', props.justify, toJustify(NAME))],
      ['wrap', resolveResponsive(NAME, 'wrap', props.wrap, toWrap())],
    ]),
}

export const stack = (...args) => defineComponent(NAME, () => definition)(...args)
