import { defineComponent } from '../shared/define.js'
import { a, div, span } from '../../api/html.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { bindText } from '../shared/args.js'
import { followHref, leavesTheApp, onPlainClick } from '../shared/links.js'
import { avatarNode, avatarStyles } from '../shared/avatar.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'

const NAME = 'userCard'

const KNOWN_PROPS = ['name', 'description', 'picture', 'href', 'compact', 'events']

const styles = () => `
  .card {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    min-inline-size: 0;
    border-radius: ${token('radius-item')};
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    ${fontFamily()}
    color: ${token('color-text')};
    text-decoration: none;
  }

  a.card:hover {
    background-color: ${token('color-surface-hover')};
  }

  a.card:focus-visible {${focusRing()}}

  ${avatarStyles()}

  .words {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .name {
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .description {
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

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the person as 'name' and 'description'`)
    }
    if (props.name === undefined) {
      impLogger.warn(`${NAME}: needs a 'name' - rendering an empty card`)
    }
    const words = div(
      { class: 'words' },
      span({ class: 'name' }, bindText(self, props.name)),
      props.description === undefined
        ? null
        : span({ class: 'description' }, bindText(self, props.description)),
    )
    const classes = ['card', props.compact && 'compact']
    const { href } = props
    if (typeof href !== 'string' || href === '') {
      return div({ class: classes, events: props.events }, avatarNode(self, props), words)
    }
    const card = a(
      { class: classes, href: url(href), events: props.events },
      avatarNode(self, props),
      words,
    )
    return leavesTheApp(href) ? card : onPlainClick(card, () => followHref(href))
  },
}

export const userCard = (...args) => defineComponent(NAME, () => definition)(...args)
