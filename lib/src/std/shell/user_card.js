import { defineComponent } from '../shared/define.js'
import { a, div, img, span } from '../../api/html.js'
import { button } from '../general/button.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { createState } from '../../state.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue, oneOf } from '../shared/args.js'
import { followHref, leavesTheApp, opensElsewhere } from '../shared/links.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  hiddenRule,
  SIZES,
  token,
  visuallyHidden,
} from '../shared/css.js'

const NAME = 'userCard'

const KNOWN_PROPS = [
  'signedIn',
  'name',
  'description',
  'picture',
  'href',
  'compact',
  'onSignIn',
  'onSignOut',
  'variant',
  'size',
  'block',
  'events',
]

const VARIANTS = ['default', 'primary', 'ghost', 'danger', 'link']

const SIGN_IN_KEY = 'imp.auth.signIn'

const SIGN_OUT_KEY = 'imp.auth.signOut'

const messages = {
  [SIGN_IN_KEY]: 'Sign in',
  [SIGN_OUT_KEY]: 'Sign out',
}

const styles = () => `
  ${hiddenRule}

  .root {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    min-inline-size: 0;
  }

  .root.block {
    inline-size: 100%;
  }

  .account {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .block .account {
    inline-size: 100%;
    justify-content: space-between;
  }

  .card {
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

  a.card:hover {
    background-color: ${token('color-surface-hover')};
  }

  a.card:focus-visible {${focusRing()}}

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

const cardNode = (props) => {
  const words = div(
    { class: 'words' },
    span({ class: 'name' }, bindText(props.name)),
    props.description === undefined
      ? null
      : span({ class: 'description' }, bindText(props.description)),
  )
  const { href } = props
  if (typeof href !== 'string' || href === '') {
    return div({ class: 'card' }, avatarNode(props), words)
  }
  const card = a({ class: 'card', href: url(href) }, avatarNode(props), words)
  if (!leavesTheApp(href)) {
    card.addEventListener('click', (event) => {
      if (opensElsewhere(event)) return
      event.preventDefault()
      followHref(href)
    })
  }
  return card
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the person as 'name' and 'description'`)
    }
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const running = createState('imp.userCard.running', false)

    const run = async (key, handler) => {
      if (typeof handler !== 'function') {
        impLogger.warn(`${NAME}: no '${key}' function - the button did nothing`)
        return
      }
      const finished = handler()
      if (!finished || typeof finished.then !== 'function') return
      running.set(true)
      try {
        await finished
      } catch (failure) {
        impLogger.error(`${NAME}: '${key}' failed`, failure)
      } finally {
        running.set(false)
      }
    }

    const authControl = (label, key, handler, block) =>
      button(
        {
          variant,
          size,
          block,
          loading: running,
          events: { click: () => run(key, handler) },
        },
        label,
      )

    const signInLabel = document.createTextNode('')
    const signOutLabel = document.createTextNode('')
    const signIn = authControl(signInLabel, 'onSignIn', props.onSignIn, props.block)
    const signOut = typeof props.onSignOut === 'function'
      ? authControl(signOutLabel, 'onSignOut', props.onSignOut, false)
      : null
    const account = div({ class: 'account' }, cardNode(props), signOut)
    const root = div(
      {
        class: ['root', props.compact && 'compact', props.block && 'block'],
        events: props.events,
      },
      signIn,
      account,
    )

    lang.watch(() => {
      signInLabel.data = t(SIGN_IN_KEY)
      signOutLabel.data = t(SIGN_OUT_KEY)
    })

    let told = false
    bindValue(props.signedIn, (value) => {
      const signedIn = Boolean(value)
      signIn.hidden = signedIn
      account.hidden = !signedIn
      if (signedIn && props.name === undefined && !told) {
        told = true
        impLogger.warn(`${NAME}: needs a 'name' - rendering an empty card`)
      }
    })
    return root
  },
}

export const userCard = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
