import { component } from 'imp'
import { a, div, span } from 'imp/html'
import { heading, text } from 'imp/std'
import { appShell, toolbar } from 'imp/std/layout'
import { commandPalette, navMenu } from 'imp/std/navigation'

const CATALOG_ELEMENT_ID = 'imp-preview-catalog'

const SEARCH_SHORTCUT = 'ctrl+p'

const BAR_STYLES = `
  .bar {
    display: flex;
    align-items: center;
    gap: var(--imp-space-3, 12px);
    flex: 1;
    flex-wrap: wrap;
    min-inline-size: 0;
  }

  .brand {
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-size: var(--imp-font-size-md, 1rem);
    font-weight: var(--imp-font-weight-bold, 700);
    text-decoration: none;
    white-space: nowrap;
    border-radius: var(--imp-radius-sm, 4px);
  }

  .brand:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 2px;
  }

  .search {
    flex: 1 1 14rem;
    min-inline-size: 10rem;
  }
`

const INDEX_STYLES = `
  .root {
    padding-block: var(--imp-space-6, 32px);
    padding-inline: var(--imp-space-5, 24px);
    font-family: var(--imp-font-family, system-ui, sans-serif);
  }

  .hero {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-2, 8px);
    margin-block-end: var(--imp-space-6, 32px);
  }

  .cards {
    column-width: 18rem;
    column-gap: var(--imp-space-4, 16px);
  }

  .card {
    box-sizing: border-box;
    break-inside: avoid;
    margin-block-end: var(--imp-space-4, 16px);
    padding: var(--imp-space-3, 12px);
    background-color: var(--imp-color-surface, #ffffff);
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-lg, 10px);
  }

  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--imp-space-2, 8px);
    padding-block-end: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-2, 8px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    margin-block-end: var(--imp-space-2, 8px);
  }

  .card-title {
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-md, 1rem);
    font-weight: var(--imp-font-weight-medium, 500);
  }

  .card-count {
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }
`

const HEAD_STYLES = `
  .head {
    display: flex;
    align-items: baseline;
    gap: var(--imp-space-3, 12px);
    flex-wrap: wrap;
    padding-block: var(--imp-space-4, 16px);
    padding-inline: var(--imp-space-5, 24px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    font-family: var(--imp-font-family, system-ui, sans-serif);
  }

  .path {
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-lg, 1.125rem);
    font-weight: var(--imp-font-weight-bold, 700);
  }

  .category {
    color: var(--imp-color-secondary, #64748b);
    font-weight: var(--imp-font-weight-normal, 400);
  }

  .file {
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  a {
    margin-inline-start: auto;
    color: var(--imp-color-link, #2563eb);
    font-size: var(--imp-font-size-sm, 0.875rem);
    text-decoration: none;
    border-radius: var(--imp-radius-sm, 4px);
  }

  a:hover {
    text-decoration: underline;
  }

  a:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 2px;
  }
`

export const readCatalog = () => {
  const script = document.getElementById(CATALOG_ELEMENT_ID)
  if (!script) return { previews: [], current: null }
  try {
    return JSON.parse(script.textContent)
  } catch (error) {
    console.error('imp preview: the catalog of previews could not be read', error)
    return { previews: [], current: null }
  }
}

const categoriesOf = (previews) => {
  const categories = new Map()
  for (const entry of previews) {
    if (!categories.has(entry.category)) categories.set(entry.category, [])
    categories.get(entry.category).push(entry)
  }
  return [...categories].map(([name, entries]) => ({ name, entries }))
}

const openInPlace = (event) => {
  const { href } = event.detail.item
  if (!href) return
  event.preventDefault()
  globalThis.location.assign(href)
}

const menuItems = (previews, grouped) =>
  previews.map((entry) => ({
    id: entry.file,
    ...(grouped ? { group: entry.category } : {}),
    label: entry.name,
    href: entry.href,
  }))

const componentMenu = (previews, current, { label, grouped = true }) =>
  navMenu({
    label,
    selected: current,
    groups: grouped
      ? categoriesOf(previews).map(({ name, entries }) => ({
        id: name,
        label: name,
        badge: entries.length,
      }))
      : [],
    items: menuItems(previews, grouped),
    events: { select: openInPlace },
  })

const searchField = (previews) =>
  commandPalette({
    label: 'Search components',
    placeholder: 'Search components…',
    shortcut: SEARCH_SHORTCUT,
    items: previews.map((entry) => ({
      id: entry.file,
      group: entry.category,
      label: entry.name,
      description: entry.file,
      href: entry.href,
    })),
    events: { select: openInPlace },
  })

const barDefinition = {
  styles: BAR_STYLES,
  onMount: (_instance, previews, controls) =>
    div(
      { class: 'bar' },
      a({ class: 'brand', href: '/' }, 'imp preview'),
      div({ class: 'search' }, searchField(previews)),
      toolbar({ label: 'Preview settings', gap: 3, wrap: true }, ...controls),
    ),
}

const indexDefinition = {
  styles: INDEX_STYLES,
  onMount: (_instance, previews) => {
    const categories = categoriesOf(previews)
    const cards = categories.map(({ name, entries }) =>
      div(
        { class: 'card' },
        div(
          { class: 'card-head' },
          span({ class: 'card-title' }, name),
          span({ class: 'card-count' }, String(entries.length)),
        ),
        componentMenu(entries, null, { label: `${name} components`, grouped: false }),
      )
    )
    return div(
      { class: 'root' },
      div(
        { class: 'hero' },
        heading({ level: 1 }, 'Components'),
        text(
          { tone: 'secondary' },
          `${previews.length} preview${
            previews.length === 1 ? '' : 's'
          } in ${categories.length} categor${
            categories.length === 1 ? 'y' : 'ies'
          } — press Ctrl P to search by name or category.`,
        ),
      ),
      div({ class: 'cards' }, ...cards),
    )
  },
}

const headDefinition = {
  styles: HEAD_STYLES,
  onMount: (_instance, entry, isolated) =>
    div(
      { class: 'head' },
      span(
        { class: 'path' },
        span({ class: 'category' }, `${entry.category}/`),
        entry.name,
      ),
      span({ class: 'file' }, entry.file),
      isolated ? a({ href: globalThis.location.pathname }, 'all scenarios') : null,
    ),
}

let createBar = null
let createIndex = null
let createHead = null

export const previewBar = (previews, controls) => {
  createBar ??= component('imp-preview-bar', barDefinition)
  return createBar(previews, controls)
}

export const previewIndex = (previews) => {
  createIndex ??= component('imp-preview-index', indexDefinition)
  return createIndex(previews)
}

export const previewHead = (entry, isolated) => {
  createHead ??= component('imp-preview-head', headDefinition)
  return createHead(entry, isolated)
}

export const previewShell = ({ catalog, controls, content }) => {
  const shell = appShell(
    {
      header: previewBar(catalog.previews, controls),
      ...(catalog.previews.length === 0 ? {} : {
        sidebar: componentMenu(catalog.previews, catalog.current, { label: 'Components' }),
        collapseBelow: 'md',
        menuLabel: 'Components',
      }),
    },
    content,
  )
  shell.setAttribute('dir', 'ltr')
  return shell
}
