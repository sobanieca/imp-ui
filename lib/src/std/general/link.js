import { component } from '../../component.js'
import { a } from '../../api/html.js'
import { navigate, url } from '../../router.js'
import { createLogger } from '../../logger.js'
import { oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import {
  focusRing,
  fontFamily,
  sizeRules,
  SIZES,
  TONES,
  weightRules,
  WEIGHTS,
} from '../shared/css.js'

const log = createLogger('imp')

const KNOWN_PROPS = ['href', 'external', 'tone', 'size', 'weight', 'events']

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i

const leavesTheApp = (href) => ABSOLUTE_URL.test(href) || href.startsWith('//')

const opensElsewhere = (event) =>
  event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
  event.shiftKey || event.altKey

const styles = `
  a {
    ${fontFamily}
    color: var(--imp-color-link, #2563eb);
    line-height: var(--imp-line-height-normal, 1.6);
    text-decoration: underline;
    text-underline-offset: 2px;
    border-radius: var(--imp-radius-sm, 4px);
    transition: color var(--imp-duration-fast, 120ms) ease-out;
  }

  a:hover { color: var(--imp-color-link-hover, #1d4ed8) }

  a:focus-visible {${focusRing}}

  a.tone-secondary { color: var(--imp-color-secondary, #64748b) }

  ${sizeRules}
  ${weightRules}

  @media (prefers-reduced-motion: reduce) {
    a { transition: none }
  }
`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs('link', args)
    warnUnknownProps('link', props, KNOWN_PROPS)
    const tone = oneOf('link', 'tone', props.tone, TONES, 'default')
    const size = oneOf('link', 'size', props.size, SIZES, 'md')
    const weight = oneOf('link', 'weight', props.weight, WEIGHTS, 'normal')
    const { href, external } = props
    const linkable = typeof href === 'string' && href !== ''
    if (!linkable) {
      log.warn(`link: needs an 'href' — without one it renders text that cannot be followed`)
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
    if (linkable && !external && !leavesTheApp(href)) {
      anchor.addEventListener('click', (event) => {
        if (opensElsewhere(event)) return
        event.preventDefault()
        navigate(href)
      })
    }
    return anchor
  },
}

let create = null

export const link = (...args) => {
  create ??= component('imp-link', definition)
  return create(...args)
}
