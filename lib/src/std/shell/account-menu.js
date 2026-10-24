import { defineComponent } from '../shared/define.js'
import { div, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { translatedLabel } from '../shared/translated-label.js'
import { token } from '../shared/css.js'
import { button } from '../general/button.js'
import { avatar } from '../display/avatar.js'
import { userCard } from './user-card.js'

const NAME = 'accountMenu'

const KNOWN_PROPS = ['name', 'description', 'picture', 'color', 'label', 'onSignOut']

const OPEN_KEY = 'imp.account.open'

const PANEL_KEY = 'imp.account.panel'

const SIGN_OUT_KEY = 'imp.account.signOut'

const messages = {
  [OPEN_KEY]: 'Account and settings',
  [PANEL_KEY]: 'Account',
  [SIGN_OUT_KEY]: 'Sign out',
}

const styles = () => `
  .anchor {
    display: inline-flex;
    anchor-name: --imp-account;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
    position: fixed;
    position-anchor: --imp-account;
    position-area: block-end span-inline-start;
    position-try-fallbacks: flip-block, flip-inline;
    inset: auto;
    margin: ${token('space-2')} 0 0;
    inline-size: min(20rem, calc(100dvi - 2rem));
    box-sizing: border-box;
    padding: ${token('space-4')};
    background: ${token('color-surface')};
    color: ${token('color-text')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    box-shadow: ${token('shadow-lg')};
  }

  .panel:not(:popover-open) {
    display: none;
  }

  @media (max-width: 47.99rem) {
    .anchor {
      display: none;
    }

    .panel,
    .panel:not(:popover-open) {
      display: flex;
      position: static;
      inline-size: auto;
      margin: 0;
      padding: 0;
      background: none;
      border: none;
      box-shadow: none;
    }
  }

  @media (forced-colors: active) {
    .panel { border-color: CanvasText }
  }
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (props.name === undefined) {
      impLogger.warn(`${NAME}: needs a 'name' - it is the person on the trigger and in the panel`)
    }
    const signOut =
      props.onSignOut === undefined
        ? null
        : typeof props.onSignOut === 'function'
          ? props.onSignOut
          : (impLogger.warn(`${NAME}: 'onSignOut' must be a function - showing no sign-out`), null)
    const panel = div(
      { class: 'panel', popover: 'auto', role: 'group' },
      userCard({ name: props.name, description: props.description, picture: props.picture }),
      ...children,
      signOut === null
        ? null
        : button(
            { variant: 'ghost', block: true, events: { click: signOut } },
            translatedLabel(self, SIGN_OUT_KEY).text(),
          ),
    )
    lang.watch(self, () => panel.setAttribute('aria-label', t(PANEL_KEY)))
    panel.addEventListener('focusout', (event) => {
      const leaving = event.relatedTarget !== null && !panel.contains(event.relatedTarget)
      if (leaving && panel.matches(':popover-open')) panel.hidePopover()
    })
    const label = props.label ?? translatedLabel(self, OPEN_KEY)
    const trigger = button(
      { variant: 'ghost', square: true, label, popoverTarget: panel },
      avatar({
        name: props.name ?? '',
        picture: props.picture,
        color: props.color ?? 'primary',
        size: 'sm',
        decorative: true,
      }),
    )
    return div(span({ class: 'anchor' }, trigger), panel)
  },
}

export const accountMenu = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
