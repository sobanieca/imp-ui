import { defineComponent } from '../shared/define.js'
import { dialog as dialogElement, div, el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { isStateShaped } from '../../render.js'
import { impLogger } from '../../logger.js'
import { bindText } from '../shared/args.js'
import { closeIcon } from '../shared/icons.js'
import { focusRing, fontFamily, forcedColors, token } from '../shared/css.js'
import {
  draggable,
  modalOverlay,
  overlayMotion,
  overlayScrim,
  panelOverlay,
} from '../shared/overlay.js'

const NAME = 'dialog'

const KNOWN_PROPS = ['title', 'modal', 'open', 'events']

const TITLE_ID = 'title'

const OPEN_TOGGLE_EVENT = 'openToggle'

const CLOSE_KEY = 'imp.dialog.close'

const MOVE_KEY = 'imp.dialog.move'

const messages = {
  [CLOSE_KEY]: 'Close',
  [MOVE_KEY]: 'Move this window with the arrow keys',
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
      var(--imp-dialog-inline-size, 32rem),
      calc(100dvi - ${token('space-6')} - ${token('space-6')})
    );
    max-block-size: calc(100dvb - ${token('space-6')} - ${token('space-6')});
    margin: auto;
    padding: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-lg')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-lg')};
    color: ${token('color-text')};
    transform: translate(var(--drag-x, 0px), var(--drag-y, 0px));
    ${fontFamily()}
    --overlay-offset: 0 0.5rem;
  }

  .panel:not([open]):not(:popover-open) {
    display: none;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    flex: none;
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-4')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .panel[data-movable] .bar {
    cursor: move;
    touch-action: none;
    user-select: none;
  }

  .bar:focus-visible {${focusRing()}}

  .title {
    flex: 1;
    min-inline-size: 0;
    margin: 0;
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-medium')};
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
    border-radius: ${token('radius-md')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .close:hover {
    background-color: ${token('color-surface-hover')};
  }

  .close:focus-visible {${focusRing()}}

  .icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  .body {
    overflow: auto;
    padding: ${token('space-4')};
  }

  ${overlayMotion('.panel')}

  ${overlayScrim('.panel[data-modal]')}

  ${forcedColors}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (instance, props, children) => {
    const modal = props.modal !== false
    if (props.title === undefined) {
      impLogger.warn(`${NAME}: pass a 'title' - it is what names the dialog for a screen reader`)
    }

    const title = el('h2', { class: 'title', id: TITLE_ID }, bindText(props.title ?? ''))
    const closeButton = el('button', {
      class: 'close',
      type: 'button',
      events: { click: () => changeOpen(false, { notify: true }) },
    }, closeIcon())
    const bar = el('header', { class: 'bar' }, title, closeButton)
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
    else {
      panel.setAttribute('popover', 'manual')
      panel.setAttribute('data-movable', '')
      bar.setAttribute('tabindex', '0')
    }

    lang.watch(() => {
      closeButton.setAttribute('aria-label', t(CLOSE_KEY))
      if (!modal) bar.setAttribute('aria-label', t(MOVE_KEY))
    })

    const overlay = modal
      ? modalOverlay(panel, { signal: instance.abortSignal })
      : panelOverlay(panel, { signal: instance.abortSignal })
    const drag = modal ? null : draggable(panel, bar, { signal: instance.abortSignal })

    const openState = isStateShaped(props.open) ? props.open : null
    let open = false

    let pendingOpen = false

    const show = () => {
      drag?.reset()
      overlay.open()
    }

    const paint = () => {
      if (!open) {
        overlay.close()
        return
      }
      if (panel.isConnected) show()
      else if (!pendingOpen) {
        pendingOpen = true
        instance.afterMount(() => {
          pendingOpen = false
          if (open) show()
        })
      }
    }

    function changeOpen(next, { notify }) {
      const wanted = Boolean(next)
      if (wanted === open) return
      open = wanted
      paint()
      if (!notify) return
      if (openState) {
        if (typeof openState.set === 'function') openState.set(open)
        else {
          impLogger.warn(
            `${NAME}: 'open' is a read-only state - pass a writable state so the dialog can close itself`,
          )
        }
      }
      panel.dispatchEvent(
        new CustomEvent(OPEN_TOGGLE_EVENT, {
          bubbles: true,
          composed: true,
          detail: { open },
        }),
      )
    }

    if (modal) panel.addEventListener('close', () => changeOpen(false, { notify: true }))

    if (openState) openState.watch((value) => changeOpen(value, { notify: false }))
    else if (props.open !== undefined) changeOpen(props.open, { notify: false })

    return panel
  },
}

export const dialog = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
