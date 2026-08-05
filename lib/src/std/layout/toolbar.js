import { defineComponent } from '../shared/define.js'
import { div } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { fontFamily, token } from '../shared/css.js'
import { toAlign, toJustify, toSpace, toWrap } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const NAME = 'toolbar'

const ORIENTATIONS = ['horizontal', 'vertical']

const VARIANTS = ['plain', 'surface']

const KNOWN_PROPS = [
  'label',
  'orientation',
  'variant',
  'gap',
  'justify',
  'align',
  'wrap',
  'events',
  ...VISIBILITY_PROPS,
]

const declarations = [
  displayDeclaration('flex'),
  { property: 'gap', variable: 'gap', fallback: token('space-2') },
  { property: 'justify-content', variable: 'justify', fallback: 'flex-start' },
  { property: 'align-items', variable: 'align', fallback: 'center' },
  { property: 'flex-wrap', variable: 'wrap', fallback: 'nowrap' },
]

const styles = () => `
  .root {
    ${fontFamily()}
    min-inline-size: 0;
    box-sizing: border-box;
  }

  .horizontal {
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .vertical {
    flex-direction: column;
  }

  .surface {
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    background-color: ${token('color-surface')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-lg')};
  }

  ${responsiveStyles('.root', declarations)}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const orientation = oneOf(NAME, 'orientation', props.orientation, ORIENTATIONS, 'horizontal')
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'plain')
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: needs a 'label' - a toolbar is a landmark and has to be named`)
    }
    const root = div(
      {
        class: ['root', orientation, variant],
        role: 'toolbar',
        'aria-orientation': orientation,
        events: props.events,
      },
      ...children,
    )
    bindValue(props.label, (value) => {
      if (value !== undefined) root.setAttribute('aria-label', String(value))
    })
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      ['gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 2))],
      ['justify', resolveResponsive(NAME, 'justify', props.justify, toJustify(NAME))],
      ['align', resolveResponsive(NAME, 'align', props.align, toAlign(NAME))],
      ['wrap', resolveResponsive(NAME, 'wrap', props.wrap, toWrap())],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
    return root
  },
}

export const toolbar = (...args) => defineComponent(NAME, () => definition)(...args)
