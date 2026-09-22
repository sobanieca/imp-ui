import { defineComponent } from '../shared/define.js'
import { div, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { luBell } from '../../icons/lucide-icons.js'
import { impLogger } from '../../logger.js'
import { computed, createState } from '../../state.js'
import { tag } from '../display/tag.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { drawer } from '../layout/drawer.js'
import { oneOf, stopOnRemove } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { ROW_MESSAGES } from '../feedback/notification-row.js'
import {
  isListed,
  listClosed,
  listOpened,
  notificationStore,
} from '../feedback/notification-store.js'
import { LIST_MESSAGES, notificationList } from './notification-list.js'

const NAME = 'notifications'

const KNOWN_PROPS = ['label', 'variant', 'size', 'events']

const VARIANTS = ['default', 'primary', 'ghost', 'danger', 'link']

const LABEL_KEY = 'imp.notifications.label'

const LABEL_UNREAD_KEY = 'imp.notifications.labelUnread'

const LARGEST_COUNT = 99

const messages = {
  ...ROW_MESSAGES,
  ...LIST_MESSAGES,
  [LABEL_KEY]: 'Notifications',
  [LABEL_UNREAD_KEY]: 'Notifications, {count} unread',
}

const styles = () => `
  .root {
    position: relative;
    display: inline-flex;
    inline-size: fit-content;
  }

  .count {
    position: absolute;
    inset-block-start: -0.375rem;
    inset-inline-end: -0.375rem;
    display: flex;
    pointer-events: none;
  }
`

const unreadIn = (entries) => entries.filter((entry) => isListed(entry) && !entry.read).length

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - raise an entry with notify({ title })`)
    }
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const open = createState('imp.notifications.open', false)
    const unread = computed([notificationStore()], unreadIn)
    const title = computed([lang], () => t(LABEL_KEY))
    const name = props.label ?? computed(
      [lang, unread],
      (_language, count) => (count === 0 ? t(LABEL_KEY) : t(LABEL_UNREAD_KEY, { count })),
    )

    const countText = document.createTextNode('')
    const countTag = tag({ color: 'red', size: 'sm' }, countText)
    const count = span({ class: 'count', 'aria-hidden': 'true' })

    unread.watch(self, (value) => {
      countText.data = value > LARGEST_COUNT ? `${LARGEST_COUNT}+` : String(value)
      if (value === 0) countTag.remove()
      else if (countTag.parentNode !== count) count.append(countTag)
    })

    let listing = false
    const follow = (isOpen) => {
      if (isOpen === listing) return
      listing = isOpen
      if (isOpen) listOpened()
      else listClosed()
    }
    open.watch(self, follow)
    stopOnRemove(self, () => follow(false))

    return div(
      { class: 'root', events: props.events },
      button(
        {
          variant,
          size,
          square: true,
          label: name,
          expanded: open,
          events: { click: () => open.set(true) },
        },
        icon({ icon: luBell }),
      ),
      count,
      drawer({ title, open }, notificationList({ open, onFollow: () => open.set(false) })),
    )
  },
}

export const notifications = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
