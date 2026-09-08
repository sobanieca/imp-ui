import { defineComponent } from '../shared/define.js'
import { dialog as dialogElement, div, el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText } from '../shared/args.js'
import { createToggle } from '../shared/toggle.js'
import { closeIcon, pinIcon } from '../shared/icons.js'
import { focusRing, fontFamily, forcedColors, token } from '../shared/css.js'
import { modalOverlay, overlayMotion, overlayScrim, panelOverlay } from '../shared/overlay.js'

const NAME = 'drawer'

const KNOWN_PROPS = ['title', 'modal', 'open', 'pin', 'events']

const TITLE_ID = 'title'

const OPEN_TOGGLE_EVENT = 'openToggle'

const PIN_TOGGLE_EVENT = 'pinToggle'

const CLOSE_KEY = 'imp.drawer.close'

const PIN_KEY = 'imp.drawer.pin'

const UNPIN_KEY = 'imp.drawer.unpin'

const messages = {
  [CLOSE_KEY]: 'Close',
  [PIN_KEY]: 'Keep this open',
  [UNPIN_KEY]: 'Let this close',
}

const styles = () => `
  :host {
    display: contents;
  }

  .panel {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    inline-size: min(
      var(--imp-drawer-inline-size, 24rem),
      calc(85dvi - var(--imp-shell-frame-gap, 0px))
    );
    block-size: calc(100dvb - var(--imp-shell-frame-gap, 0px) * 2);
    max-block-size: calc(100dvb - var(--imp-shell-frame-gap, 0px) * 2);
    margin: var(--imp-shell-frame-gap, 0px);
    margin-inline-start: auto;
    padding: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: var(--imp-shell-frame-radius, 0);
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-lg')};
    color: ${token('color-text')};
    ${fontFamily()}
    --overlay-offset: 100% 0;
  }

  .panel:dir(rtl) { --overlay-offset: -100% 0 }

  .panel:not([open]):not(:popover-open) {
    display: none;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    flex: none;
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-4')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .title {
    flex: 1;
    min-inline-size: 0;
    margin: 0;
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-bold')};
  }

  .pin,
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .pin:hover,
  .close:hover {
    background-color: ${token('color-surface-hover')};
  }

  .pin[aria-pressed='true'] {
    color: ${token('color-primary')};
  }

  .pin:focus-visible,
  .close:focus-visible {${focusRing()}}

  .icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  .body {
    flex: 1;
    min-block-size: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: ${token('space-4')};
  }

  ${overlayMotion('.panel')}

  ${overlayScrim('.panel[data-modal]')}

  ${forcedColors}

  @media (forced-colors: active) {
    .pin[aria-pressed='true'] { color: Highlight }
  }
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (self) => self.showIfOpen(),
  setup: (self, props, children) => {
    const modal = props.modal !== false
    if (props.title === undefined) {
      impLogger.warn(`${NAME}: pass a 'title' - it is what names the drawer for a screen reader`)
    }
    if (!modal && props.pin !== undefined) {
      impLogger.warn(
        `${NAME}: 'pin' only applies to a modal drawer - a non-modal one never closes on a click outside it`,
      )
    }

    const title = el('h2', { class: 'title', id: TITLE_ID }, bindText(self, props.title ?? ''))
    const pinButton = modal
      ? el('button', {
        class: 'pin',
        type: 'button',
        'aria-pressed': 'false',
        events: { click: () => pinned.change(!pinned.get(), { notify: true }) },
      }, pinIcon())
      : null
    const closeButton = el('button', {
      class: 'close',
      type: 'button',
      events: { click: () => opened.change(false, { notify: true }) },
    }, closeIcon())
    const bar = el('header', { class: 'bar' }, title, pinButton, closeButton)
    const body = div({ class: 'body' }, ...children)
    const panel = dialogElement(
      {
        class: 'panel',
        'aria-labelledby': TITLE_ID,
        events: props.events,
      },
      bar,
      body,
    )

    if (modal) panel.setAttribute('data-modal', '')
    else panel.setAttribute('popover', 'manual')

    const paintPin = () => {
      pinButton.setAttribute('aria-pressed', String(pinned.get()))
      pinButton.setAttribute('aria-label', t(pinned.get() ? UNPIN_KEY : PIN_KEY))
    }

    const pinned = createToggle(NAME, {
      prop: 'pin',
      source: props.pin,
      node: panel,
      event: PIN_TOGGLE_EVENT,
      detail: 'pinned',
      paint: paintPin,
    })

    lang.watch(self, () => {
      closeButton.setAttribute('aria-label', t(CLOSE_KEY))
      if (modal) paintPin()
    })

    const overlay = modal
      ? modalOverlay(panel, { signal: self.abortSignal, backdropDismisses: () => !pinned.get() })
      : panelOverlay(panel, { signal: self.abortSignal })

    const opened = createToggle(NAME, {
      prop: 'open',
      source: props.open,
      node: panel,
      event: OPEN_TOGGLE_EVENT,
      detail: 'open',
      paint: (open) => {
        if (!open) overlay.close()
        else if (panel.isConnected) overlay.open()
      },
    })

    self.showIfOpen = () => {
      if (opened.get()) overlay.open()
    }

    if (modal) {
      panel.addEventListener('close', () => opened.change(false, { notify: true }))
      pinned.follow(self)
    }
    opened.follow(self)

    return panel
  },
}

export const drawer = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
