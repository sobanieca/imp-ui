// Navigation components: tabs, menuList, breadcrumbs, pagination.

import { button, css, div, li, link, match, nav, ol, signal, span, t } from '../imp/imp.js'
import { cx, isSignal, read } from './util.js'

const tabBarCss = css`
  display: flex;
  gap: var(--imp-space-4);
  border-block-end: 1px solid var(--imp-color-border);
  & > button {
    border: none;
    background: none;
    font: inherit;
    font-size: var(--imp-font-size-sm);
    color: var(--imp-color-text-muted);
    padding: var(--imp-space-8) var(--imp-space-12);
    cursor: pointer;
    border-block-end: 2px solid transparent;
    margin-block-end: -1px;
  }
  & > button:hover {
    color: var(--imp-color-text);
  }
  & > button[aria-selected="true"] {
    color: var(--imp-color-primary);
    border-color: var(--imp-color-primary);
    font-weight: var(--imp-font-weight-medium);
  }
`
const tabPanelCss = css`
  padding-block-start: var(--imp-space-16);
`

// tabs({ tabs: [{ id, label, content }], active? })
// content: () => Node, built lazily per activation; active: optional signal.
export function tabs({ tabs: items = [], active, class: extra, ...rest } = {}) {
  const current = isSignal(active) ? active : signal(active ?? items[0]?.id)
  return div({ ...rest, class: extra }, [
    div(
      { class: tabBarCss, role: 'tablist' },
      items.map((item) =>
        button({
          role: 'tab',
          'aria-selected': () => String(current() === item.id),
          events: { click: () => current.set(item.id) },
        }, typeof item.label === 'function' ? item.label : String(item.label))
      ),
    ),
    div({ class: tabPanelCss, role: 'tabpanel' }, [
      match(current, Object.fromEntries(items.map((item) => [item.id, item.content]))),
    ]),
  ])
}

const menuCss = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--imp-space-4);
  & > button {
    display: flex;
    align-items: center;
    gap: var(--imp-space-8);
    border: none;
    background: none;
    font: inherit;
    font-size: var(--imp-font-size-sm);
    color: var(--imp-color-text);
    text-align: start;
    padding: var(--imp-space-8) var(--imp-space-12);
    border-radius: var(--imp-radius-sm);
    cursor: pointer;
  }
  & > button:hover {
    background: var(--imp-color-surface-alt);
  }
  & > button[aria-current="true"] {
    background: var(--imp-color-primary);
    color: var(--imp-color-on-primary);
  }
`

// menuList({ items: [{ id, label, onSelect }], active? }) — active: signal of id
export function menuList({ items = [], active, class: extra, ...rest } = {}) {
  return div(
    { ...rest, class: cx(menuCss, extra), role: 'menu' },
    items.map((item) =>
      button({
        role: 'menuitem',
        'aria-current': active ? () => String(read(active) === item.id) : 'false',
        events: {
          click: () => {
            if (isSignal(active)) active.set(item.id)
            item.onSelect?.(item)
          },
        },
      }, typeof item.label === 'function' ? item.label : String(item.label))
    ),
  )
}

const crumbsCss = css`
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--imp-space-8);
  font-size: var(--imp-font-size-sm);
  & a {
    color: var(--imp-color-primary);
    text-decoration: none;
  }
  & a:hover {
    text-decoration: underline;
  }
  & li:not(:first-child)::before {
    content: "/";
    color: var(--imp-color-text-muted);
    margin-inline-end: var(--imp-space-8);
  }
  & [aria-current] {
    color: var(--imp-color-text-muted);
  }
`

// breadcrumbs({ items: [{ label, href? }] }) — last item is the current page.
export function breadcrumbs({ items = [], class: extra, ...rest } = {}) {
  return nav(
    { ...rest, class: extra, 'aria-label': 'breadcrumbs' },
    ol(
      { class: crumbsCss },
      items.map((item, i) =>
        li(
          item.href && i < items.length - 1
            ? link({ href: item.href }, item.label)
            : span({ 'aria-current': 'page' }, item.label),
        )
      ),
    ),
  )
}

const pagerCss = css`
  display: flex;
  align-items: center;
  gap: var(--imp-space-12);
  font-size: var(--imp-font-size-sm);
  color: var(--imp-color-text-muted);
  & > button {
    border: 1px solid var(--imp-color-border);
    background: var(--imp-color-surface);
    color: var(--imp-color-text);
    font: inherit;
    font-size: var(--imp-font-size-sm);
    padding: var(--imp-space-4) var(--imp-space-12);
    border-radius: var(--imp-radius-sm);
    cursor: pointer;
  }
  & > button:hover:not(:disabled) {
    background: var(--imp-color-surface-alt);
  }
  & > button:disabled {
    opacity: 0.45;
    cursor: default;
  }
`

// pagination({ page, pages }) — page: signal (1-based), pages: number or fn.
export function pagination({ page, pages = 1, class: extra, ...rest } = {}) {
  const total = () => Math.max(1, read(pages))
  return div({ ...rest, class: cx(pagerCss, extra) }, [
    button({
      disabled: () => page() <= 1,
      events: { click: () => page.update((p) => Math.max(1, p - 1)) },
    }, () => t('imp.prev')),
    span(() => t('imp.page', { page: page(), pages: total() })),
    button({
      disabled: () => page() >= total(),
      events: { click: () => page.update((p) => Math.min(total(), p + 1)) },
    }, () => t('imp.next')),
  ])
}
