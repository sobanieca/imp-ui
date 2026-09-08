import { component } from 'imp'
import { a, div, el, pre, span } from 'imp/html'
import { navigate } from 'imp/router'
import { heading, text } from 'imp/std'
import { shell, stack } from 'imp/std/layout'
import { luFolder } from 'imp/icons'
import { copyButton } from './preview-copy.js'

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
    font-weight: var(--imp-font-weight-bold, 600);
    text-decoration: none;
    white-space: nowrap;
    border-radius: var(--imp-radius-item, 6px);
  }

  .brand:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 2px;
  }

`

const SETTINGS_STYLES = `
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-3, 12px);
    font-family: var(--imp-font-family, system-ui, sans-serif);
  }

  .picker {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--imp-space-2, 8px);
  }

  h2 {
    margin: 0;
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
`

const INDEX_STYLES = `
  .root {
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
    border-radius: var(--imp-radius-container, 10px);
    box-shadow: var(--imp-shadow-sm, 0 1px 2px rgb(15 23 42 / 10%));
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
    font-weight: var(--imp-font-weight-bold, 600);
  }

  .card-count {
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .card-list {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-1, 4px);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card-link {
    display: block;
    border-radius: var(--imp-radius-item, 6px);
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-3, 12px);
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-tight, 1.25);
    text-decoration: none;
  }

  .card-link:hover {
    background-color: var(--imp-color-surface-hover, #f1f5f9);
  }

  .card-link:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 2px;
  }
`

const HEAD_STYLES = `
  .head {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-3, 12px);
    padding-block-end: var(--imp-space-4, 16px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    font-family: var(--imp-font-family, system-ui, sans-serif);
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: var(--imp-space-3, 12px);
    flex-wrap: wrap;
  }

  .agent {
    display: flex;
    align-items: center;
    gap: var(--imp-space-3, 12px);
    flex-wrap: wrap;
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-3, 12px);
    background-color: var(--imp-color-surface, #ffffff);
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-md, 6px);
  }

  .agent-label {
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
    font-weight: var(--imp-font-weight-bold, 600);
    white-space: nowrap;
  }

  .instruction {
    flex: 1 1 16rem;
    min-inline-size: 0;
    margin: 0;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-normal, 1.6);
    white-space: pre-wrap;
  }

  .missing {
    flex: 1 1 16rem;
    min-inline-size: 0;
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-normal, 1.6);
  }

  .path {
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-lg, 1.125rem);
    font-weight: var(--imp-font-weight-bold, 600);
  }

  .group {
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
    border-radius: var(--imp-radius-item, 6px);
  }

  a:hover {
    text-decoration: underline;
  }

  a:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 2px;
  }
`

const opensElsewhere = (event) =>
  event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
  event.shiftKey || event.altKey

export const pageLink = (attributes, ...children) =>
  a(
    {
      ...attributes,
      events: {
        click: (event) => {
          if (opensElsewhere(event)) return
          event.preventDefault()
          navigate(attributes.href)
        },
      },
    },
    ...children,
  )

export const groupsOf = (previews, groups = []) => {
  const byName = new Map()
  for (const entry of previews) {
    if (!byName.has(entry.group)) byName.set(entry.group, [])
    byName.get(entry.group).push(entry)
  }
  const declared = groups.filter(({ name }) => byName.has(name))
  const undeclared = [...byName.keys()]
    .filter((name) => !groups.some((group) => group.name === name))
    .map((name) => ({ name, icon: null }))
  return [...declared, ...undeclared].map(({ name, icon }) => ({
    name,
    icon: icon ?? luFolder,
    entries: byName.get(name),
  }))
}

const componentList = (entries, label) =>
  el(
    'nav',
    { 'aria-label': label },
    el(
      'ul',
      { class: 'card-list' },
      ...entries.map((entry) =>
        el('li', pageLink({ class: 'card-link', href: entry.href }, entry.name))
      ),
    ),
  )

const barDefinition = {
  styles: BAR_STYLES,
  setup: () =>
    div(
      { class: 'bar' },
      a({ class: 'brand', href: '/' }, 'imp preview'),
    ),
}

const settingsDefinition = {
  styles: SETTINGS_STYLES,
  setup: (_instance, controls) =>
    div(
      { class: 'settings' },
      el('h2', 'Preview'),
      ...controls,
    ),
}

const indexDefinition = {
  styles: INDEX_STYLES,
  setup: (_instance, listed) => {
    const previews = listed.flatMap(({ entries }) => entries)
    const cards = listed.map(({ name, entries }) =>
      div(
        { class: 'card' },
        div(
          { class: 'card-head' },
          span({ class: 'card-title' }, name),
          span({ class: 'card-count' }, String(entries.length)),
        ),
        componentList(entries, `${name} components`),
      )
    )
    return div(
      { class: 'root' },
      div(
        { class: 'hero' },
        heading({ level: 1 }, 'Components'),
        text(
          { tone: 'secondary' },
          `${previews.length} preview${previews.length === 1 ? '' : 's'} in ${listed.length} group${
            listed.length === 1 ? '' : 's'
          }.`,
        ),
      ),
      div({ class: 'cards' }, ...cards),
    )
  },
}

const agentStrip = (instruction) =>
  el(
    'section',
    { class: 'agent', 'aria-label': 'Agent instruction' },
    span({ class: 'agent-label' }, 'For an agent'),
    instruction === null
      ? span(
        { class: 'missing' },
        "no description - add 'export const description = ...' to this file with the command " +
          'an agent should run to learn this component.',
      )
      : [pre({ class: 'instruction' }, instruction), copyButton(instruction)],
  )

const FAILURE_STYLES = `
  .failure {
    margin: 0;
    padding: var(--imp-space-3, 12px);
    border-radius: var(--imp-radius-container, 10px);
    background: var(--imp-color-surface, #ffffff);
    border: var(--imp-border-width, 1px) solid var(--imp-color-danger, #dc2626);
    color: var(--imp-color-danger, #dc2626);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
    white-space: pre-wrap;
  }
`

const failureDefinition = {
  styles: FAILURE_STYLES,
  setup: (_instance, entry) =>
    pre({ class: 'failure' }, `${entry.file} failed to build\n\n${entry.error}`),
}

const headDefinition = {
  styles: HEAD_STYLES,
  setup: (_instance, entry, isolated, instruction) =>
    div(
      { class: 'head' },
      div(
        { class: 'title' },
        span(
          { class: 'path' },
          span({ class: 'group' }, `${entry.group} / `),
          entry.name,
        ),
        span({ class: 'file' }, entry.file),
        isolated ? pageLink({ href: entry.href }, 'all scenarios') : null,
      ),
      agentStrip(instruction),
    ),
}

let createBar = null
let createSettings = null
let createIndex = null
let createHead = null
let createFailure = null

export const buildFailure = (entry) => {
  createFailure ??= component('imp-preview-failure', failureDefinition)
  return createFailure(entry)
}

export const previewBar = () => {
  createBar ??= component('imp-preview-bar', barDefinition)
  return createBar()
}

export const previewSettings = (controls) => {
  createSettings ??= component('imp-preview-settings', settingsDefinition)
  return createSettings(controls)
}

export const previewIndex = (listed) => {
  createIndex ??= component('imp-preview-index', indexDefinition)
  return createIndex(listed)
}

export const previewHead = (entry, isolated, instruction) => {
  createHead ??= component('imp-preview-head', headDefinition)
  return createHead(entry, isolated, instruction)
}

export const previewShell = ({ navbar, controls, editor, content }) => {
  const host = shell(
    {
      logo: previewBar(),
      navbar,
      sidebar: { label: 'Components' },
      breadcrumbs: false,
      extras: previewSettings(controls),
      gap: 3,
    },
    stack({ gap: 4 }, content),
    editor,
  )
  host.setAttribute('dir', 'ltr')
  host.style.setProperty('--imp-shell-sidebar-inline-size', '15rem')
  return host
}
