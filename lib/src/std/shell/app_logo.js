import { defineComponent } from '../shared/define.js'
import { a, div, img, span } from '../../api/html.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText } from '../shared/args.js'
import { followHref, leavesTheApp, opensElsewhere } from '../shared/links.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'

const NAME = 'appLogo'

const KNOWN_PROPS = ['label', 'tagline', 'href', 'src', 'alt', 'icon', 'compact', 'events']

const styles = () => `
  .root {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    border-radius: ${token('radius-item')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-2')};
    ${fontFamily()}
    color: ${token('color-text')};
    text-decoration: none;
  }

  a.root:hover {
    background-color: ${token('color-surface-hover')};
  }

  a.root:focus-visible {${focusRing()}}

  .mark {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    color: ${token('color-primary')};
  }

  .mark img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
  }

  .words {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .label {
    color: ${token('color-text')};
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tagline {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact .words {${visuallyHidden}}

  ${forcedColors}
`

const markNode = (self, props) => {
  if (props.src !== undefined) {
    return span({ class: 'mark' }, img({ src: props.src, alt: props.alt ?? '' }))
  }
  if (props.icon !== undefined && props.icon !== null) {
    return span({ class: 'mark' }, bindContent(self, props.icon))
  }
  return null
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the app name as 'label'`)
    }
    const mark = markNode(self, props)
    if (mark === null && props.label === undefined) {
      impLogger.warn(`${NAME}: needs a 'label', an 'src' or an 'icon' - rendering an empty brand`)
    }
    const words = props.label === undefined && props.tagline === undefined ? null : div(
      { class: 'words' },
      props.label === undefined ? null : span({ class: 'label' }, bindText(self, props.label)),
      props.tagline === undefined
        ? null
        : span({ class: 'tagline' }, bindText(self, props.tagline)),
    )
    const href = props.href === undefined ? '/' : props.href
    const rootProps = {
      class: ['root', props.compact && 'compact'],
      events: props.events,
    }
    if (href === null) return div(rootProps, mark, words)
    const root = a({ ...rootProps, href: url(href) }, mark, words)
    if (!leavesTheApp(href)) {
      root.addEventListener('click', (event) => {
        if (opensElsewhere(event)) return
        event.preventDefault()
        followHref(href)
      })
    }
    return root
  },
}

export const appLogo = (...args) => defineComponent(NAME, () => definition)(...args)
