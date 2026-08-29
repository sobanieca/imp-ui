import { defineComponent } from '../shared/define.js'
import { a, div, img, span } from '../../api/html.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue } from '../shared/args.js'
import { followHref, leavesTheApp, opensElsewhere } from '../shared/links.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'

const NAME = 'userCard'

const KNOWN_PROPS = ['name', 'description', 'picture', 'href', 'compact', 'events']

const styles = () => `
  .root {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    min-inline-size: 0;
    border-radius: ${token('radius-md')};
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    ${fontFamily()}
    color: ${token('color-text')};
    text-decoration: none;
  }

  a.root:hover {
    background-color: ${token('color-surface-hover')};
  }

  a.root:focus-visible {${focusRing()}}

  .avatar {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: 50%;
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-medium')};
    line-height: 1;
  }

  .avatar img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .words {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .name {
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-medium')};
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

const initialsOf = (value) => {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words.at(-1)[0]]
  return letters.join('').toUpperCase()
}

const avatarNode = (props) => {
  const avatar = span({ class: 'avatar', 'aria-hidden': 'true' })
  if (props.picture === undefined) {
    bindValue(props.name, (value) => {
      avatar.textContent = initialsOf(value)
    })
    return avatar
  }
  const picture = img({ alt: '' })
  bindValue(props.picture, (value) => picture.setAttribute('src', String(value)))
  avatar.append(picture)
  return avatar
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the person as 'name' and 'description'`)
    }
    if (props.name === undefined) {
      impLogger.warn(`${NAME}: needs a 'name' - rendering an empty card`)
    }
    const words = div(
      { class: 'words' },
      span({ class: 'name' }, bindText(props.name)),
      props.description === undefined
        ? null
        : span({ class: 'description' }, bindText(props.description)),
    )
    const rootProps = {
      class: ['root', props.compact && 'compact'],
      events: props.events,
    }
    const { href } = props
    if (typeof href !== 'string' || href === '') {
      return div(rootProps, avatarNode(props), words)
    }
    const root = a({ ...rootProps, href: url(href) }, avatarNode(props), words)
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

export const userCard = (...args) => defineComponent(NAME, () => definition)(...args)
