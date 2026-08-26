import { defineComponent } from '../shared/define.js'
import { el } from '../../api/html.js'
import { bindValue } from '../shared/args.js'
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

export const BAR_PROPS = ['label', 'gap', 'justify', 'align', 'wrap', 'events', ...VISIBILITY_PROPS]

const declarations = [
  displayDeclaration('flex'),
  { property: 'gap', variable: 'gap', fallback: token('space-4') },
  { property: 'justify-content', variable: 'justify', fallback: 'flex-start' },
  { property: 'align-items', variable: 'align', fallback: 'center' },
  { property: 'flex-wrap', variable: 'wrap', fallback: 'nowrap' },
]

const stylesFor = (edge, shadow) => () => `
  .root {
    box-shadow: ${shadow === null ? 'none' : token(shadow)};
    ${fontFamily()}
    box-sizing: border-box;
    flex: none;
    position: relative;
    z-index: 20;
    min-inline-size: 0;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    border-block-${edge}: ${token('border-width')} solid ${token('color-border')};
  }

  ${responsiveStyles('.root', declarations)}
`

export const createBarComponent = (name, tag, edge, shadow) => {
  const definition = {
    styles: stylesFor(edge, shadow),
    props: BAR_PROPS,
    onMount: (_instance, props, children) => {
      const root = el(tag, { class: 'root', events: props.events }, ...children)
      bindValue(props.label, (value) => {
        if (value !== undefined) root.setAttribute('aria-label', String(value))
      })
      const responsive = [
        ['display', resolveVisibility(name, props)],
        ['gap', resolveResponsive(name, 'gap', props.gap, toSpace(name, 'gap', 4))],
        ['justify', resolveResponsive(name, 'justify', props.justify, toJustify(name))],
        ['align', resolveResponsive(name, 'align', props.align, toAlign(name))],
        ['wrap', resolveResponsive(name, 'wrap', props.wrap, toWrap())],
      ]
      for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
      return root
    },
  }
  return (...args) => defineComponent(name, () => definition)(...args)
}
