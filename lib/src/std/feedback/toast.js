import { defineComponent } from '../shared/define.js'
import { div, li, ol, p, section } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { useHttpClient } from '../../http.js'
import { impLogger } from '../../logger.js'
import { computed } from '../../state.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'
import { stopOnRemove } from '../shared/args.js'
import { token, visuallyHidden } from '../shared/css.js'
import { overlayMotion, slideOut } from '../shared/overlay.js'
import { DISMISS_KEY, notificationRow, ROW_MESSAGES, rowStyles } from './notification-row.js'
import {
  configureStore,
  leaveCorner,
  notificationStore,
  notify,
  STORE_DEFAULTS,
} from './notification-store.js'

export { dismiss, notify } from './notification-store.js'

const NAME = 'toast'

const KNOWN_PROPS = ['duration', 'ttl', 'visible', 'limit', 'client']

const LABEL_KEY = 'imp.notifications.label'

const messages = { ...ROW_MESSAGES, [LABEL_KEY]: 'Notifications' }

const DEFAULT_DURATION = 5000

const DEFAULT_VISIBLE = 3

const INLINE_SIZE = '24rem'

const ALERT_KINDS = ['warning', 'error']

const mounted = { host: null }

const styles = () => `
  :host {
    display: contents;
  }

  .region {
    position: fixed;
    inset: auto;
    inset-block-start: 0;
    inset-inline-end: 0;
    box-sizing: border-box;
    inline-size: min(${INLINE_SIZE}, 100dvi);
    margin: 0;
    padding: ${token('space-4')};
    border: none;
    background-color: transparent;
    overflow: visible;
    pointer-events: none;
  }

  .region:not(:popover-open) {
    display: none;
  }

  @media (width < ${DESKTOP_MIN_WIDTH}) {
    .region { inline-size: 100dvi }
  }

  .popups {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .popup {
    border-radius: ${token('radius-container')};
    box-shadow: ${token('shadow-lg')};
    pointer-events: auto;
    --overlay-offset: 100% 0;
  }

  .popup:dir(rtl) { --overlay-offset: -100% 0 }

  ${rowStyles()}

  ${overlayMotion('.popup')}

  @starting-style {
    .popup {
      opacity: 0;
      translate: var(--overlay-offset);
    }
  }

  .live {${visuallyHidden}}
`

const count = (prop, value, fallback, least) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number' && Number.isFinite(value) && value >= least) return value
  impLogger.warn(`${NAME}: '${prop}' must be a number of ${least} or more - using ${fallback}`)
  return fallback
}

const clientNames = (client) => {
  if (client === undefined || client === null) return []
  const names = Array.isArray(client) ? client : [client]
  if (names.every((name) => typeof name === 'string')) return names
  impLogger.warn(`${NAME}: 'client' must be the name of an HTTP client, or an array of names`)
  return []
}

const failureOf = (name, error) => ({
  id: `imp.http.${name}.${error.method} ${error.url}`,
  kind: 'error',
  title: error.message,
})

const sameContent = (left, right) =>
  JSON.stringify({ ...left, read: false }) === JSON.stringify({ ...right, read: false })

const liveLine = (entry) => [
  p(entry.title),
  entry.description === undefined ? null : p(entry.description),
]

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (self) => self.follow?.(),
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - raise a popup with notify({ title })`)
    }
    if (mounted.host?.isConnected && mounted.host !== self.host) {
      impLogger.warn(
        `${NAME}: a region is already mounted - mount ${NAME}() once, the second one renders nothing`,
      )
      return null
    }
    mounted.host = self.host

    const duration = count('duration', props.duration, DEFAULT_DURATION, 0)
    const visible = Math.floor(count('visible', props.visible, DEFAULT_VISIBLE, 1))
    configureStore({
      ttl: count('ttl', props.ttl, STORE_DEFAULTS.ttl, 0),
      limit: Math.floor(count('limit', props.limit, STORE_DEFAULTS.limit, 1)),
    })

    const dismissLabel = computed([lang], () => t(DISMISS_KEY))
    const list = ol({ class: 'popups' })
    const region = section({ class: 'region' }, list)
    region.setAttribute('popover', 'manual')
    const status = div({ class: 'live', role: 'status', 'aria-atomic': 'false' })
    const alert = div({ class: 'live', role: 'alert', 'aria-atomic': 'false' })
    lang.watch(self, () => region.setAttribute('aria-label', t(LABEL_KEY)))

    const records = new Map()
    const lines = new Map()
    let shown = false
    let cameFrom = null

    const holdsFocus = () => region.contains(self.host.shadowRoot.activeElement)

    const raise = () => {
      if (shown && holdsFocus()) return
      if (shown) region.hidePopover()
      region.showPopover()
      shown = true
    }

    const lower = () => {
      if (!shown || list.children.length > 0) return
      region.hidePopover()
      shown = false
    }

    const run = (record) => {
      if (record.sticky || record.hovered || record.focused || record.timer !== null) return
      record.startedAt = Date.now()
      record.timer = setTimeout(() => leaveCorner(record.entry.id), record.remaining)
    }

    const pause = (record) => {
      if (record.timer === null) return
      clearTimeout(record.timer)
      record.timer = null
      record.remaining = Math.max(1, record.remaining - (Date.now() - record.startedAt))
    }

    const restart = (record) => {
      pause(record)
      record.remaining = record.entry.duration ?? duration
      record.sticky = record.remaining === 0
      run(record)
    }

    const rowOf = (entry) =>
      notificationRow(entry, {
        dismissLabel,
        onDismiss: () => leaveCorner(entry.id, { read: true }),
      })

    const hold = (record, key, held) => {
      record[key] = held
      if (held) pause(record)
      else run(record)
    }

    const open = (entry) => {
      const record = {
        entry,
        node: null,
        timer: null,
        remaining: 0,
        startedAt: 0,
        sticky: false,
        hovered: false,
        focused: false,
      }
      record.node = li({
        class: 'popup',
        events: {
          pointerenter: () => hold(record, 'hovered', true),
          pointerleave: () => hold(record, 'hovered', false),
          focusin: () => hold(record, 'focused', true),
          focusout: () => hold(record, 'focused', false),
        },
      }, rowOf(entry))
      records.set(entry.id, record)
      list.prepend(record.node)
      restart(record)
    }

    const refresh = (record, entry) => {
      const changed = !sameContent(record.entry, entry)
      record.entry = entry
      if (!changed) return
      record.node.replaceChildren(rowOf(entry))
      restart(record)
    }

    const close = (record) => {
      records.delete(record.entry.id)
      pause(record)
      const heldFocus = record.focused
      slideOut(record.node, () => {
        record.node.remove()
        if (heldFocus && cameFrom?.isConnected) cameFrom.focus()
        lower()
      })
    }

    const announce = (entries) => {
      const waiting = new Map(
        entries.filter(({ popup }) => popup).map((entry) => [entry.id, entry]),
      )
      for (const [id, line] of lines) {
        if (waiting.has(id)) continue
        line.node.remove()
        lines.delete(id)
      }
      for (const entry of waiting.values()) {
        const line = lines.get(entry.id) ?? { entry: null, node: div() }
        if (line.entry !== null && sameContent(line.entry, entry)) continue
        line.entry = entry
        line.node.replaceChildren(...liveLine(entry).filter(Boolean))
        lines.set(entry.id, line)
        const live = ALERT_KINDS.includes(entry.kind) ? alert : status
        if (line.node.parentNode !== live) live.append(line.node)
      }
    }

    const sync = (entries) => {
      announce(entries)
      const wanted = entries.filter(({ popup }) => popup).slice(-visible)
      const wantedIds = new Set(wanted.map(({ id }) => id))
      for (const record of [...records.values()]) {
        if (!wantedIds.has(record.entry.id)) close(record)
      }
      const arrived = wanted.toReversed().filter(({ id }) => !records.has(id))
      for (const entry of wanted) {
        const record = records.get(entry.id)
        if (record) refresh(record, entry)
      }
      for (const entry of arrived) open(entry)
      if (arrived.length > 0) raise()
    }

    region.addEventListener('focusin', (event) => {
      if (!region.contains(event.relatedTarget)) cameFrom = event.relatedTarget
    })

    region.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      const path = event.composedPath()
      const record = [...records.values()].find(({ node }) => path.includes(node))
      if (record) leaveCorner(record.entry.id, { read: true })
    })

    for (const name of clientNames(props.client)) {
      useHttpClient(self, name).lastError.watch(self, (error) => {
        if (error !== null) notify(failureOf(name, error))
      })
    }

    self.follow = () => notificationStore().watch(self, sync)

    stopOnRemove(self, () => {
      for (const record of records.values()) pause(record)
      if (mounted.host !== self.host) return
      mounted.host = null
      configureStore(STORE_DEFAULTS)
    })

    return [region, status, alert]
  },
}

export const toast = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
