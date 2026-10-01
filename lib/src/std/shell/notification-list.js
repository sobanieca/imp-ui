import { defineComponent } from '../shared/define.js'
import { div, li, ol } from '../../api/html.js'
import { lang, t } from '../../api/i18n.js'
import { computed } from '../../state.js'
import { button } from '../general/button.js'
import { emptyState } from '../display/empty-state.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { hiddenRule, token } from '../shared/css.js'
import { DISMISS_KEY, notificationRow, rowStyles } from '../feedback/notification-row.js'
import { clearList, dismiss, isListed, notificationStore } from '../feedback/notification-store.js'

const NAME = 'notificationList'

const KNOWN_PROPS = ['open', 'onFollow']

const EMPTY_KEY = 'imp.notifications.empty'

const CLEAR_ALL_KEY = 'imp.notifications.clearAll'

export const LIST_MESSAGES = {
  [EMPTY_KEY]: 'No notifications',
  [CLEAR_ALL_KEY]: 'Clear all',
}

const TIME_REFRESH_MS = 30_000

const TIME_STEPS = [
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
]

const styles = () => `
  ${hiddenRule}

  .root {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ${rowStyles()}

  .foot {
    position: sticky;
    inset-block-end: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: ${token('space-2')};
    padding-block: ${token('space-2')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface')};
  }
`

const relativeTime = (time, language) => {
  const seconds = Math.round((new Date(time).getTime() - Date.now()) / 1000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  for (const [unit, size] of TIME_STEPS) {
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit)
  }
  return format.format(0, 'second')
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props) => {
    const dismissLabel = computed([lang], () => t(DISMISS_KEY))
    const list = ol({ class: 'list' })
    const empty = emptyState({ title: computed([lang], () => t(EMPTY_KEY)) })
    const clearAllText = document.createTextNode('')
    const foot = div(
      { class: 'foot' },
      button({ variant: 'ghost', size: 'sm', events: { click: clearList } }, clearAllText),
    )
    const records = new Map()
    let focusedId = null
    let refreshing = null

    const paintTimes = () => {
      for (const { entry, time } of records.values()) {
        time.data = relativeTime(entry.time, lang.get())
      }
    }

    const dismissButtonOf = (record) => record.node.querySelector('.dismiss > *')

    const rowOf = (entry, time) =>
      notificationRow(entry, {
        dismissLabel,
        time,
        unread: !entry.read,
        onDismiss: () => dismiss(entry.id),
        onFollow: props.onFollow,
      })

    const place = (entry) => {
      const known = records.get(entry.id)
      if (known?.entry === entry) return known
      const time = known?.time ?? document.createTextNode('')
      const node = known?.node ?? li({ class: 'item' })
      node.replaceChildren(rowOf(entry, time))
      const record = { entry, node, time, redrawn: true }
      records.set(entry.id, record)
      return record
    }

    const refocus = (order) => {
      if (focusedId === null) return
      const record = records.get(focusedId)
      if (record && !record.redrawn) return
      const position = Math.min(order.indexOf(focusedId), records.size - 1)
      const target = record ?? [...records.values()][Math.max(0, position)]
      if (target) dismissButtonOf(target)?.focus()
      else focusedId = null
    }

    const sync = (entries) => {
      const order = [...records.keys()]
      const listed = entries.filter(isListed)
      const kept = new Set(listed.map(({ id }) => id))
      for (const [id, record] of records) {
        if (kept.has(id)) continue
        record.node.remove()
        records.delete(id)
      }
      const placed = listed.map(place)
      records.clear()
      for (const record of placed) records.set(record.entry.id, record)
      for (const [index, record] of placed.entries()) {
        if (list.children[index] !== record.node) {
          list.insertBefore(record.node, list.children[index])
        }
      }
      empty.hidden = placed.length > 0
      list.hidden = placed.length === 0
      foot.hidden = placed.length === 0
      paintTimes()
      refocus(order)
      for (const record of placed) record.redrawn = false
    }

    list.addEventListener('focusin', (event) => {
      const path = event.composedPath()
      focusedId = [...records.values()].find(({ node }) => path.includes(node))?.entry.id ?? null
    })

    list.addEventListener('focusout', (event) => {
      if (event.relatedTarget !== null) focusedId = null
    })

    const stopRefreshing = () => {
      clearInterval(refreshing)
      refreshing = null
    }

    bindValue(self, props.open, (open) => {
      stopRefreshing()
      if (!open) return
      paintTimes()
      refreshing = setInterval(paintTimes, TIME_REFRESH_MS)
    })

    stopOnRemove(self, stopRefreshing)
    notificationStore().watch(self, sync)
    lang.watch(self, () => {
      clearAllText.data = t(CLEAR_ALL_KEY)
      paintTimes()
    })

    return div({ class: 'root' }, empty, list, foot)
  },
}

export const notificationList = (...args) => defineComponent(NAME, () => definition)(...args)
