import { defineComponent } from '../shared/define.js'
import { button } from '../general/button.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { createState } from '../../state.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'

const NAME = 'authButton'

const KNOWN_PROPS = ['signedIn', 'onSignIn', 'onSignOut', 'variant', 'size', 'block', 'events']

const VARIANTS = ['default', 'primary', 'ghost', 'danger', 'link']

const SIGN_IN_KEY = 'imp.auth.signIn'

const SIGN_OUT_KEY = 'imp.auth.signOut'

const messages = {
  [SIGN_IN_KEY]: 'Sign in',
  [SIGN_OUT_KEY]: 'Sign out',
}

const definition = {
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(
        `${NAME}: takes no content - its wording comes from '${SIGN_IN_KEY}' and '${SIGN_OUT_KEY}'`,
      )
    }
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const running = createState('imp.authButton.running', false)
    const label = document.createTextNode('')
    let signedIn = false

    const paint = () => {
      label.data = t(signedIn ? SIGN_OUT_KEY : SIGN_IN_KEY)
    }

    const run = async () => {
      const handler = signedIn ? props.onSignOut : props.onSignIn
      if (typeof handler !== 'function') {
        impLogger.warn(
          `${NAME}: no '${signedIn ? 'onSignOut' : 'onSignIn'}' function - the button did nothing`,
        )
        return
      }
      const finished = handler()
      if (!finished || typeof finished.then !== 'function') return
      running.set(true)
      try {
        await finished
      } catch (failure) {
        impLogger.error(`${NAME}: '${signedIn ? 'onSignOut' : 'onSignIn'}' failed`, failure)
      } finally {
        running.set(false)
      }
    }

    const given = props.events ?? {}
    const control = button(
      {
        variant,
        size,
        block: props.block,
        loading: running,
        events: {
          ...given,
          click: (event) => {
            given.click?.(event)
            run()
          },
        },
      },
      label,
    )
    lang.watch(paint)
    bindValue(props.signedIn, (value) => {
      signedIn = Boolean(value)
      paint()
    })
    return control
  },
}

export const authButton = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
