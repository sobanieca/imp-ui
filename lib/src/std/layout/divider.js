import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { toSpace } from '../shared/layout.js'
import { fontFamily, token } from '../shared/css.js'
import { impLogger } from '../../logger.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const NAME = 'divider'

const ORIENTATIONS = ['horizontal', 'vertical']

const KNOWN_PROPS = ['orientation', 'spacing', ...VISIBILITY_PROPS]

const rule = () => `${token('border-width')} solid ${token('color-border')}`

const alongBlock = (naturalDisplay) => [
  displayDeclaration(naturalDisplay),
  { property: 'margin-block', variable: 'spacing', fallback: token('space-4') },
]

const alongInline = [
  displayDeclaration('block'),
  { property: 'margin-inline', variable: 'spacing', fallback: token('space-4') },
]

const styles = () => `
  hr {
    margin: 0;
    border: 0;
  }

  .horizontal {
    inline-size: 100%;
    border-block-start: ${rule()};
  }

  .vertical {
    align-self: stretch;
    inline-size: 0;
    min-block-size: 1em;
    border-inline-start: ${rule()};
  }

  .labelled {
    align-items: center;
    gap: ${token('space-3')};
    ${fontFamily()}
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .labelled::before,
  .labelled::after {
    content: '';
    flex: 1 1 0;
    border-block-start: ${rule()};
  }

  ${responsiveStyles('hr.horizontal', alongBlock('block'))}

  ${responsiveStyles('hr.vertical', alongInline)}

  ${responsiveStyles('.labelled', alongBlock('flex'))}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const orientation = oneOf(NAME, 'orientation', props.orientation, ORIENTATIONS, 'horizontal')
    if (orientation === 'vertical' && children.length > 0) {
      impLogger.warn(`${NAME}: a vertical divider carries no label - its content is ignored`)
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

export const divider = (...args) => defineComponent(NAME, () => definition)(...args)
