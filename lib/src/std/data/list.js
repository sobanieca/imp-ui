import { defineComponent } from '../shared/define.js'
import { a, div, el, li, p, span, ul } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { bindValue } from '../shared/args.js'
import { avatarNode, avatarStyles } from '../shared/avatar.js'
import { focusRing, fontFamily, hiddenRule, token } from '../shared/css.js'
import { createKeyedRows } from '../shared/keyed-rows.js'
import { followHref, onPlainClick } from '../shared/links.js'
import {
  createLoadMore,
  LOAD_MORE_PROPS,
  loadMoreMessages,
  loadMoreStyles,
} from '../shared/load-more.js'
import { navTagNode, normalizeNavTag } from '../shared/nav-items.js'
import { ownEvents } from '../shared/own-events.js'
import { emptyState } from '../display/empty-state.js'
import { icon } from '../general/icon.js'

const NAME = 'list'

const KNOWN_PROPS = ['label', 'items', 'actions', ...LOAD_MORE_PROPS, 'events']

const SELECT_EVENT = 'select'

const NARROW = '28rem'

const styles = () => `
  ${hiddenRule}

  :host {
    display: block;
    min-inline-size: 0;
  }

  .root {
    container-type: inline-size;
    ${fontFamily()}
    color: ${token('color-text')};
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    padding-block: ${token('space-3')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .row:last-child {
    border-block-end: none;
  }

  ${avatarStyles()}

  .avatar {
    --avatar-size: 2.5rem;
  }

  .visual {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    min-inline-size: 2.5rem;
    color: ${token('color-secondary')};
  }

  .words {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: ${token('space-1')};
    min-inline-size: 0;
  }

  .title {
    max-inline-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background: none;
    color: ${token('color-text')};
    font: inherit;
    font-size: ${token('font-size-md')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    text-align: start;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  a.title,
  button.title {
    cursor: pointer;
  }

  a.title:hover,
  button.title:hover {
    color: ${token('color-primary')};
    text-decoration: underline;
  }

  .title:focus-visible {${focusRing()}}

  .description {
    margin: 0;
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
    overflow-wrap: anywhere;
  }

  .tag {
    display: inline-flex;
    flex: none;
  }

  .actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: ${token('space-2')};
  }

  ${loadMoreStyles()}

  @container (inline-size <= ${NARROW}) {
    .row {
      flex-wrap: wrap;
    }

    .actions {
      flex-basis: 100%;
      justify-content: flex-end;
    }
  }

  @media (forced-colors: active) {
    a.title:hover,
    button.title:hover {
      color: LinkText;
    }
  }
`

const iconNode = (value) => (typeof value.nodeType === 'number' ? value : icon(value))

const hasValue = (value) => value !== undefined && value !== null

const hasHref = (item) => typeof item.href === 'string' && item.href !== ''

const visualNode = (self, item) => {
  if (hasValue(item.picture) || hasValue(item.name)) {
    return span({ class: 'visual' }, avatarNode(self, { name: item.name, picture: item.picture }))
  }
  return hasValue(item.icon) ? span({ class: 'visual' }, iconNode(item.icon)) : null
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every row in 'items'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it names the list for a screen reader`)
    }
    if (props.actions !== undefined && typeof props.actions !== 'function') {
      impLogger.warn(`${NAME}: 'actions' must be a function (item) => content - ignoring it`)
    }
    const actionsOf = typeof props.actions === 'function' ? props.actions : null
    const selectable = typeof props.events?.[SELECT_EVENT] === 'function' ||
      Array.isArray(props.events?.[SELECT_EVENT])
    const keyed = createKeyedRows(NAME, 'id')
    let moreItemsExist = false
    let shownCount = 0

    const activate = (item) => {
      const followed = root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { id: item.id, item },
        }),
      )
      if (followed && hasHref(item)) followHref(item.href)
    }

    const titleNode = (item) => {
      const text = String(item.title ?? '')
      if (hasHref(item)) {
        return onPlainClick(a({ class: 'title', href: url(item.href) }, text), () => activate(item))
      }
      if (!selectable) return span({ class: 'title' }, text)
      return el(
        'button',
        { class: 'title', type: 'button', events: { click: () => activate(item) } },
        text,
      )
    }

    const renderRow = (_key, item) =>
      li(
        { class: 'row' },
        visualNode(self, item),
        div(
          { class: 'words' },
          titleNode(item),
          hasValue(item.description) ? p({ class: 'description' }, String(item.description)) : null,
        ),
        navTagNode(self, normalizeNavTag(NAME, item.tag)),
        actionsOf === null ? null : div({ class: 'actions' }, actionsOf(item)),
      )

    const rows = ul({ class: 'rows', role: 'list' }, keyed.region(renderRow))
    const empty = div({ class: 'empty', hidden: true })
    const root = div(
      { class: 'root', events: ownEvents(props.events, [SELECT_EVENT]) },
      rows,
      empty,
    )

    const paintEmpty = () => {
      const isEmpty = shownCount === 0 && !moreItemsExist
      empty.hidden = !isEmpty
      if (isEmpty && empty.childNodes.length === 0) empty.append(emptyState())
    }

    if (props.label !== undefined) {
      bindValue(self, props.label, (value) => rows.setAttribute('aria-label', String(value)))
    }
    const loadMore = createLoadMore(self, NAME, props, rows)
    if (loadMore !== null) {
      rows.after(loadMore)
      bindValue(self, props.hasMore, (value) => {
        moreItemsExist = Boolean(value)
        paintEmpty()
      })
    }
    bindValue(self, props.items, (value) => {
      const items = keyed.take(value)
      shownCount = items.length
      keyed.show(items)
      paintEmpty()
    })
    return root
  },
}

export const list = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(loadMoreMessages))(...args)
