import { defineComponent } from '../shared/define.js'
import { dialog as dialogElement, div, el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText } from '../shared/args.js'
import { createToggle } from '../shared/toggle.js'
import { closeIcon } from '../shared/icons.js'
import { focusRing, fontFamily, forcedColors, seamReset, token } from '../shared/css.js'
import {
  draggable,
  modalOverlay,
  overlayMotion,
  overlayScrim,
  panelOverlay,
} from '../shared/overlay.js'

const NAME = 'dialog'

const KNOWN_PROPS = ['title', 'modal', 'open', 'anchor', 'events']

const TITLE_ID = 'title'

const OPEN_TOGGLE_EVENT = 'openToggle'

const CLOSE_KEY = 'imp.dialog.close'

const MOVE_KEY = 'imp.dialog.move'

const messages = {
  [CLOSE_KEY]: 'Close',
  [MOVE_KEY]: 'Move this window with the arrow keys',
}

let dialogCount = 0

const ANCHOR_NAME = 'anchor-name'

const anchorWithin = (root, anchor) => {
  let candidate = anchor
  while (candidate && !root.contains(candidate)) candidate = candidate.getRootNode().host ?? null
  return candidate
}

const anchoring = (host, panel, anchor) => {
  const id = ++dialogCount
  const name = `--imp-dialog-${id}`
  const reference = new CSSStyleSheet()
  reference.replaceSync(`[data-imp-dialog="${id}"]::part(panel) { position-anchor: ${name} }`)
  host.setAttribute('data-imp-dialog', id)
  panel.setAttribute('data-anchored', '')
  let named = null
  let resting = ''
  let adoptedBy = null

  const release = () => {
    if (named) named.style.setProperty(ANCHOR_NAME, resting)
    named = null
  }
  const withdraw = () => {
    if (!adoptedBy) return
    adoptedBy.adoptedStyleSheets = adoptedBy.adoptedStyleSheets.filter((sheet) =>
      sheet !== reference
    )
    adoptedBy = null
  }
  const attach = () => {
    release()
    const root = host.getRootNode()
    named = anchorWithin(root, anchor)
    if (!named) {
      impLogger.warn(`${NAME}: 'anchor' is not in the page - the window opens centred`)
      return
    }
    if (getComputedStyle(named).display === 'contents') {
      impLogger.warn(
        `${NAME}: 'anchor' <${named.localName}> has no box - wrap it in a span, or pass an element that has one`,
      )
    }
    if (adoptedBy !== root) {
      withdraw()
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, reference]
      adoptedBy = root
    }
    resting = named.style.getPropertyValue(ANCHOR_NAME)
    const declared = getComputedStyle(named).getPropertyValue(ANCHOR_NAME)
    named.style.setProperty(
      ANCHOR_NAME,
      !declared || declared === 'none' ? name : `${declared}, ${name}`,
    )
  }
  const dispose = () => {
    release()
    withdraw()
  }
  return { attach, release, dispose }
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
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-lg')};
    color: ${token('color-text')};
    transform: translate(var(--drag-x, 0px), var(--drag-y, 0px));
    ${fontFamily()}
    ${seamReset()}
    --overlay-offset: 0 0.5rem;
  }

  .panel:not([open]):not(:popover-open) {
    display: none;
  }

  .panel[data-anchored] {
    inset: auto;
    margin: ${token('space-2')};
    max-block-size: calc(100% - ${token('space-2')} - ${token('space-2')});
    position-area: block-end span-all;
    position-try-fallbacks: flip-block;
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
  onMount: (self) => self.showIfOpen(),
  setup: (self, props, children) => {
    const modal = props.modal !== false
    if (props.title === undefined) {
      impLogger.warn(`${NAME}: pass a 'title' - it is what names the dialog for a screen reader`)
    }

    const title = el('h2', { class: 'title', id: TITLE_ID }, bindText(self, props.title ?? ''))
    const closeButton = el('button', {
      class: 'close',
      type: 'button',
      events: { click: () => opened.change(false, { notify: true }) },
    }, closeIcon())
    const bar = el('header', { class: 'bar' }, title, closeButton)
    const body = div({ class: 'body' }, ...children)
    const panel = dialogElement(
      {
        class: 'panel',
        part: 'panel',
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

    lang.watch(self, () => {
      closeButton.setAttribute('aria-label', t(CLOSE_KEY))
      if (!modal) bar.setAttribute('aria-label', t(MOVE_KEY))
    })

    const overlay = modal
      ? modalOverlay(panel, { signal: self.abortSignal })
      : panelOverlay(panel, { signal: self.abortSignal })
    const drag = modal ? null : draggable(panel, bar, { signal: self.abortSignal })
    if (props.anchor !== undefined && !(props.anchor instanceof Element)) {
      impLogger.warn(`${NAME}: 'anchor' must be an element - the window opens centred`)
    }
    const anchor = !modal && props.anchor instanceof Element
      ? anchoring(self.host, panel, props.anchor)
      : null
    self.abortSignal.addEventListener('abort', () => anchor?.dispose())

    const show = () => {
      drag?.reset()
      anchor?.attach()
      overlay.open()
    }

    const opened = createToggle(NAME, {
      prop: 'open',
      source: props.open,
      node: panel,
      event: OPEN_TOGGLE_EVENT,
      detail: 'open',
      paint: (open) => {
        if (!open) overlay.close().then(() => anchor?.release())
        else if (panel.isConnected) show()
      },
    })

    self.showIfOpen = () => {
      if (opened.get()) show()
    }

    if (modal) panel.addEventListener('close', () => opened.change(false, { notify: true }))
    opened.follow(self)

    return panel
  },
}

export const dialog = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
