import { component } from 'imp'
import { div, el, pre, span } from 'imp/html'
import { heading, link, text } from 'imp/std'
import { tag } from 'imp/std/display'
import { flex, shell, stack } from 'imp/std/layout'
import { appLogo } from 'imp/std/shell'
import { luFolder } from 'imp/icons'
import { copyButton } from './preview-copy.js'

const INDEX_STYLES = `
  .hero {
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
    padding-block-end: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-2, 8px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    margin-block-end: var(--imp-space-2, 8px);
  }

  .card-list {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-2, 8px);
    margin: 0;
    padding-block: var(--imp-space-1, 4px);
    padding-inline: var(--imp-space-2, 8px);
    list-style: none;
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
    font-weight: var(--imp-font-weight-normal, 400);
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
    background-color: var(--imp-color-surface-sunken, #f8fafc);
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

  .file {
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .title imp-link {
    margin-inline-start: auto;
  }
`

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
      ...entries.map((entry) => el('li', link({ href: entry.href, size: 'sm' }, entry.name))),
    ),
  )

const BACKDROP_STYLES = `
  :host {
    display: block;
    position: relative;
  }

  .wash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--imp-background-app, #ffffff);
  }
`

const CANVAS_STYLES = `
  :host {
    display: block;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-block-size: 0;
    margin-inline: calc(-1 * var(--imp-space-4, 16px));
    margin-block-end: calc(-1 * var(--imp-space-4, 16px));
    padding: var(--imp-space-2, 8px);
    overflow: hidden;
    border-radius: var(--imp-shell-frame-radius, 0);
    background: var(--imp-color-surface, #ffffff);
  }

  .scroll {
    box-sizing: border-box;
    block-size: 100%;
    overflow: auto;
    padding: var(--imp-space-2, 8px);
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklch, var(--imp-color-text, #0f172a) 28%, transparent) transparent;
  }
`

const canvasDefinition = {
  styles: CANVAS_STYLES,
  setup: (_instance, content) => div({ class: 'scroll' }, content),
}

const backdropDefinition = {
  styles: BACKDROP_STYLES,
  setup: () => div({ class: 'wash' }),
}

const settingsDefinition = {
  setup: (_instance, controls) =>
    stack(
      { gap: 3 },
      text({ tone: 'secondary', size: 'sm', weight: 'bold' }, 'Preview'),
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
          flex(
            { horizontalAlign: 'justify', verticalAlign: 'center', gap: 2 },
            heading({ level: 2 }, name),
            tag({ size: 'sm' }, String(entries.length)),
          ),
        ),
        componentList(entries, `${name} components`),
      )
    )
    return div(
      div(
        { class: 'hero' },
        stack(
          { gap: 2 },
          heading({ level: 1 }, 'Components'),
          text(
            { tone: 'secondary' },
            `${previews.length} preview${
              previews.length === 1 ? '' : 's'
            } in ${listed.length} group${listed.length === 1 ? '' : 's'}.`,
          ),
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
        heading({ level: 1 }, entry.name),
        span({ class: 'file' }, entry.file),
        isolated ? link({ href: entry.href, size: 'sm' }, 'all scenarios') : null,
      ),
      agentStrip(instruction),
    ),
}

let createCanvas = null
let createBackdrop = null
let createSettings = null
let createIndex = null
let createHead = null
let createFailure = null

export const buildFailure = (entry) => {
  createFailure ??= component('imp-preview-failure', failureDefinition)
  return createFailure(entry)
}

export const previewCanvas = (content) => {
  createCanvas ??= component('imp-preview-canvas', canvasDefinition)
  return createCanvas(content)
}

export const previewBackdrop = () => {
  createBackdrop ??= component('imp-preview-backdrop', backdropDefinition)
  return createBackdrop()
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

export const previewShell = ({ mark, navbar, controls, editor, content }) => {
  const host = shell(
    {
      logo: appLogo({ label: 'imp preview', src: mark, href: '/' }),
      navbar,
      sidebar: { label: 'Components', background: previewBackdrop() },
      extras: previewSettings(controls),
      gap: 3,
    },
    previewCanvas(stack({ gap: 4 }, content)),
    editor,
  )
  host.setAttribute('dir', 'ltr')
  host.style.setProperty('--imp-shell-sidebar-inline-size', '15rem')
  return host
}
