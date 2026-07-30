import { component } from '../../component.js'
import { div, el, span } from '../../api/html.js'
import { oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { toSpace } from '../shared/layout.js'
import { fontFamily } from '../shared/css.js'
import { createLogger } from '../../logger.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const log = createLogger('imp')

const NAME = 'divider'

const ORIENTATIONS = ['horizontal', 'vertical']

const KNOWN_PROPS = ['orientation', 'spacing', ...VISIBILITY_PROPS]

const RULE = 'var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1)'

const SPACING_FALLBACK = 'var(--imp-space-4, 16px)'

const alongBlock = (naturalDisplay) => [
  displayDeclaration(naturalDisplay),
  { property: 'margin-block', variable: 'spacing', fallback: SPACING_FALLBACK },
]

const alongInline = [
  displayDeclaration('block'),
  { property: 'margin-inline', variable: 'spacing', fallback: SPACING_FALLBACK },
]

const styles = `
  hr {
    margin: 0;
    border: 0;
  }

  .horizontal {
    inline-size: 100%;
    border-block-start: ${RULE};
  }

  .vertical {
    align-self: stretch;
    inline-size: 0;
    min-block-size: 1em;
    border-inline-start: ${RULE};
  }

  .labelled {
    align-items: center;
    gap: var(--imp-space-3, 12px);
    ${fontFamily}
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-tight, 1.25);
  }

  .labelled::before,
  .labelled::after {
    content: '';
    flex: 1 1 0;
    border-block-start: ${RULE};
  }

  ${responsiveStyles('hr.horizontal', alongBlock('block'))}

  ${responsiveStyles('hr.vertical', alongInline)}

  ${responsiveStyles('.labelled', alongBlock('flex'))}
`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    const orientation = oneOf(NAME, 'orientation', props.orientation, ORIENTATIONS, 'horizontal')
    if (orientation === 'vertical' && children.length > 0) {
      log.warn(`${NAME}: a vertical divider carries no label — its content is ignored`)
    }
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      ['spacing', resolveResponsive(NAME, 'spacing', props.spacing, toSpace(NAME, 'spacing', 4))],
    ]
    const rendered = orientation === 'vertical' || children.length === 0
      ? el('hr', { class: orientation, 'aria-orientation': orientation })
      : div(
        { class: 'labelled', role: 'separator', 'aria-orientation': 'horizontal' },
        span({ class: 'label' }, ...children),
      )
    for (const [variable, resolved] of responsive) applyResponsive(rendered, variable, resolved)
    return rendered
  },
}

let create = null

export const divider = (...args) => {
  create ??= component('imp-divider', definition)
  return create(...args)
}
