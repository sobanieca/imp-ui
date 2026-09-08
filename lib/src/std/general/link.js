import { defineComponent } from '../shared/define.js'
import { a } from '../../api/html.js'
import { navigate } from '../../router.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { oneOf } from '../shared/args.js'
import { leavesTheApp, onPlainClick } from '../shared/links.js'
import {
  focusRing,
  fontFamily,
  sizeRules,
  SIZES,
  token,
  TONES,
  weightRules,
  WEIGHTS,
} from '../shared/css.js'

const KNOWN_PROPS = ['href', 'external', 'tone', 'size', 'weight', 'events']

const styles = () => `
  a {
    ${fontFamily()}
    color: ${token('color-link')};
    line-height: ${token('line-height-normal')};
    text-decoration: underline;
    text-underline-offset: 2px;
    border-radius: ${token('radius-item')};
    transition: color ${token('duration-fast')} ease-out;
  }

  a:hover { color: ${token('color-link-hover')} }

  a:focus-visible {${focusRing()}}

  a.tone-secondary { color: ${token('color-secondary')} }

  ${sizeRules()}
  ${weightRules()}

  @media (prefers-reduced-motion: reduce) {
    a { transition: none }
  }
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    const tone = oneOf('link', 'tone', props.tone, TONES, 'default')
    const size = oneOf('link', 'size', props.size, SIZES, 'md')
    const weight = oneOf('link', 'weight', props.weight, WEIGHTS, 'normal')
    const { href, external } = props
    const linkable = typeof href === 'string' && href !== ''
    if (!linkable) {
      impLogger.warn(`link: needs an 'href' - without one it renders text that cannot be followed`)
    }
    const linkProps = {
      class: [`tone-${tone}`, `size-${size}`, `weight-${weight}`],
      events: props.events,
    }
    if (linkable) linkProps.href = url(href)
    if (external) {
      linkProps.target = '_blank'
      linkProps.rel = 'noreferrer noopener'
    }
    const anchor = a(linkProps, ...children)
    if (linkable && !external && !leavesTheApp(href)) onPlainClick(anchor, () => navigate(href))
    return anchor
  },
}

export const link = (...args) => defineComponent('link', () => definition)(...args)
