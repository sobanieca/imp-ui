import { defineComponent } from '../shared/define.js'
import { a, div, section } from '../../api/html.js'
import { navigate } from '../../router.js'
import { url } from '../../location.js'
import { bindContent, oneOf } from '../shared/args.js'
import { leavesTheApp, onPlainClick, safeHref } from '../shared/links.js'
import { focusRing, fontFamily, token } from '../shared/css.js'

const NAME = 'card'

const KNOWN_PROPS = ['header', 'footer', 'href', 'label', 'padding', 'events']

const PADDINGS = ['sm', 'md', 'lg']

const PADDING_TOKENS = [
  ['sm', 'space-3'],
  ['md', 'space-4'],
  ['lg', 'space-6'],
]

const paddingRules = () =>
  PADDING_TOKENS.map(
    ([padding, name]) => `  .padding-${padding} { --card-padding: ${token(name)} }`,
  ).join('\n')

const styles = () => `
  :host {
    display: block;
  }

  .card {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    block-size: 100%;
    padding: var(--card-padding);
    background-color: ${token('color-surface')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    box-shadow: ${token('shadow-sm')};
    ${fontFamily()}
    color: ${token('color-text')};
    text-decoration: none;
    transition: border-color ${token('duration-fast')} ease-out;
  }

  a.card:hover {
    border-color: ${token('color-primary')};
  }

  a.card:focus-visible {${focusRing()}}

  .header {
    padding-block-end: ${token('space-2')};
    margin-block-end: ${token('space-3')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .body {
    flex: 1 1 auto;
    min-block-size: 0;
  }

  .footer {
    padding-block-start: ${token('space-2')};
    margin-block-start: ${token('space-3')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

${paddingRules()}

  @media (forced-colors: active) {
    .card, .header, .footer { border-color: CanvasText }
    a.card { color: LinkText }
  }

  @media (prefers-reduced-motion: reduce) {
    .card { transition: none }
  }
`

const part = (self, name, content) =>
  content === undefined || content === null
    ? null
    : div({ class: name }, bindContent(self, content))

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const padding = oneOf(NAME, 'padding', props.padding, PADDINGS, 'md')
    const { label } = props
    const href = safeHref(NAME, props.href)
    const linkable = href !== null
    const rootProps = { class: ['card', `padding-${padding}`], events: props.events }
    if (typeof label === 'string' && label !== '') rootProps['aria-label'] = label
    const parts = [
      part(self, 'header', props.header),
      div({ class: 'body' }, ...children),
      part(self, 'footer', props.footer),
    ]
    if (!linkable) return (label === undefined ? div : section)(rootProps, ...parts)
    rootProps.href = url(href)
    const anchor = a(rootProps, ...parts)
    if (!leavesTheApp(href)) onPlainClick(anchor, () => navigate(href))
    return anchor
  },
}

export const card = (...args) => defineComponent(NAME, () => definition)(...args)
