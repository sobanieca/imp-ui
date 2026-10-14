import { defineComponent } from '../shared/define.js'
import { dialog as dialogElement, div, el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText } from '../shared/args.js'
import { createToggle } from '../shared/toggle.js'
import { closeIcon } from '../shared/icons.js'
import { focusRing, fontFamily, forcedColors, seamReset, token } from '../shared/css.js'
import {
  dismissal,
  modalOverlay,
  overlayMotion,
  overlayScrim,
  panelOverlay,
} from '../shared/overlay.js'
import { backdropNode, backdropStyles } from '../shared/backdrop.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'

const NAME = 'drawer'

const KNOWN_PROPS = ['title', 'modal', 'open', 'beforeClose', 'background', 'events']

const TITLE_ID = 'title'

const OPEN_TOGGLE_EVENT = 'openToggle'

const CLOSE_KEY = 'imp.drawer.close'

const messages = {
  [CLOSE_KEY]: 'Close',
}

const styles = () => `
  :host {
    display: contents;
  }

  .panel {
    isolation: isolate;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    inline-size: min(
      var(--imp-drawer-inline-size, 24rem),
      calc(85dvi - var(--imp-shell-frame-inset, 0px))
    );
    block-size: calc(100dvb - var(--imp-shell-frame-gap, 0px) * 2);
    max-block-size: calc(100dvb - var(--imp-shell-frame-gap, 0px) * 2);
    margin: var(--imp-shell-frame-gap, 0px);
    margin-inline-start: auto;
    margin-inline-end: var(--imp-shell-frame-inset, 0px);
    padding: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: var(--imp-shell-frame-radius, 0);
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-lg')};
    color: ${token('color-text')};
    ${fontFamily()}
    ${seamReset()}
    --overlay-offset: 100% 0;
  }

  .panel:dir(rtl) { --overlay-offset: -100% 0 }

  .panel:not([open]):not(:popover-open) {
    display: none;
  }

  ${backdropStyles()}

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

  .close:hover {
    background-color: ${token('color-surface-hover')};
  }

  .close:focus-visible {${focusRing()}}

  .icon {
    inline-size: 1.5rem;
    block-size: 1.5rem;
  }

  .body {
    flex: 1;
    min-block-size: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: ${token('space-4')};
  }

  @media (width < ${DESKTOP_MIN_WIDTH}) {
    .panel { block-size: fit-content }
    .body { flex: 0 1 auto }
  }

  ${overlayMotion('.panel')}

  ${overlayScrim('.panel[data-modal]')}

  ${forcedColors}
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
    const dismiss = dismissal(NAME, props.beforeClose)
    const title = el('h2', { class: 'title', id: TITLE_ID }, bindText(self, props.title ?? ''))
    const closeButton = el('button', {
      class: 'close',
      type: 'button',
      events: { click: () => dismiss(() => opened.change(false, { notify: true })) },
    }, closeIcon())
    const bar = el('header', { class: 'bar' }, title, closeButton)
    const body = div({ class: 'body' }, ...children)
    const panel = dialogElement(
      {
        class: 'panel',
        'aria-labelledby': TITLE_ID,
        events: props.events,
      },
      backdropNode(props.background),
      bar,
      body,
    )

    if (modal) panel.setAttribute('data-modal', '')
    else {
      panel.setAttribute('popover', 'manual')
      panel.setAttribute('tabindex', '-1')
    }

    lang.watch(self, () => closeButton.setAttribute('aria-label', t(CLOSE_KEY)))

    const overlay = modal
      ? modalOverlay(panel, {
        signal: self.abortSignal,
        dismiss,
        onClose: () => opened.change(false, { notify: true }),
      })
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

    opened.follow(self)

    return panel
  },
}

export const drawer = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
