import { component } from '../../component.js'
import { div } from '../../api/html.js'
import { splitArgs, warnUnknownProps } from '../shared/args.js'
import { toAlign, toDirection, toJustify, toSpace, toWrap } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const KNOWN_PROPS = ['direction', 'gap', 'justify', 'align', 'wrap', ...VISIBILITY_PROPS]

const declarations = (defaultDirection) => [
  displayDeclaration('flex'),
  { property: 'flex-direction', variable: 'direction', fallback: defaultDirection },
  { property: 'gap', variable: 'gap', fallback: 'var(--imp-space-3, 12px)' },
  { property: 'justify-content', variable: 'justify', fallback: 'flex-start' },
  { property: 'align-items', variable: 'align', fallback: 'stretch' },
  { property: 'flex-wrap', variable: 'wrap', fallback: 'nowrap' },
]

const stylesFor = (defaultDirection) => `
  .root {
    min-inline-size: 0;
  }

  ${responsiveStyles('.root', declarations(defaultDirection))}
`

const definitionFor = (name, defaultDirection) => ({
  styles: stylesFor(defaultDirection),
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(name, args)
    warnUnknownProps(name, props, KNOWN_PROPS)
    const root = div({ class: 'root' }, ...children)
    const responsive = [
      ['display', resolveVisibility(name, props)],
      ['direction', resolveResponsive(name, 'direction', props.direction, toDirection(name))],
      ['gap', resolveResponsive(name, 'gap', props.gap, toSpace(name, 'gap', 3))],
      ['justify', resolveResponsive(name, 'justify', props.justify, toJustify(name))],
      ['align', resolveResponsive(name, 'align', props.align, toAlign(name))],
      ['wrap', resolveResponsive(name, 'wrap', props.wrap, toWrap())],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)
    return root
  },
})

export const createFlexComponent = (elementName, name, defaultDirection) => {
  let create = null
  return (...args) => {
    create ??= component(elementName, definitionFor(name, defaultDirection))
    return create(...args)
  }
}
