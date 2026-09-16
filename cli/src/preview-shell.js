import { component } from 'imp'
import { div, el, pre, span } from 'imp/html'
import { heading, link, text } from 'imp/std'
import { card, codeBlock, emptyState, tag } from 'imp/std/display'
import { flex, shell, stack } from 'imp/std/layout'
import { appLogo } from 'imp/std/shell'
import { luFolder } from 'imp/icons'
import { copyButton } from '../../lib/src/std/shared/copy-button.js'

const INDEX_STYLES = `
  .hero {
    margin-block-end: var(--imp-space-6, 32px);
  }

  .cards {
    column-width: 18rem;
    column-gap: var(--imp-space-4, 16px);
  }

  imp-card {
    break-inside: avoid;
    margin-block-end: var(--imp-space-4, 16px);
  }

`

const COMPONENT_LIST_STYLES = `
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

const MARKDOWN_STYLES = `
  .md {
    max-inline-size: 80ch;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-weight: var(--imp-font-weight-normal, 400);
    font-size: var(--imp-font-size-md, 1rem);
    line-height: var(--imp-line-height-normal, 1.6);
  }

  .md > :first-child {
    margin-block-start: 0;
  }

  .md > :last-child {
    margin-block-end: 0;
  }

  .md h1,
  .md h2,
  .md h3,
  .md h4 {
    margin-block: var(--imp-space-5, 24px) var(--imp-space-3, 12px);
    font-weight: var(--imp-font-weight-bold, 600);
    line-height: var(--imp-line-height-tight, 1.25);
  }

  .md h1 {
    font-size: var(--imp-font-size-xl, 1.5rem);
  }

  .md h2 {
    font-size: var(--imp-font-size-lg, 1.25rem);
  }

  .md h3,
  .md h4 {
    font-size: var(--imp-font-size-md, 1rem);
  }

  .md p,
  .md ul,
  .md ol,
  .md table,
  .md pre,
  .md blockquote {
    margin-block: 0 var(--imp-space-3, 12px);
  }

  .md ul,
  .md ol {
    padding-inline-start: var(--imp-space-5, 24px);
  }

  .md li {
    margin-block-end: var(--imp-space-1, 4px);
  }

  .md a {
    color: var(--imp-color-primary, #2563eb);
  }

  .md code {
    padding-inline: 0.3em;
    border-radius: var(--imp-radius-item, 6px);
    background: var(--imp-color-surface-sunken, #f8fafc);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: 0.9em;
  }

  .md imp-code-block {
    margin-block: var(--imp-space-3, 12px);
  }

  .md table {
    display: block;
    overflow: auto;
    border-collapse: collapse;
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .md th,
  .md td {
    padding-block: var(--imp-space-1, 4px);
    padding-inline: var(--imp-space-2, 8px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    text-align: start;
    vertical-align: top;
  }

  .md th {
    font-weight: var(--imp-font-weight-bold, 600);
  }

  .md blockquote {
    padding-inline-start: var(--imp-space-3, 12px);
    border-inline-start: 3px solid var(--imp-color-border, #cbd5e1);
    color: var(--imp-color-secondary, #64748b);
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

  .file {
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  ${MARKDOWN_STYLES}

  .md.description {
    color: var(--imp-color-secondary, #64748b);
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

const componentListDefinition = {
  styles: COMPONENT_LIST_STYLES,
  setup: (_self, entries, label) =>
    el(
      'nav',
      { 'aria-label': label },
      el(
        'ul',
        { class: 'card-list' },
        ...entries.map((entry) => el('li', link({ href: entry.href, size: 'sm' }, entry.name))),
      ),
    ),
}

let createComponentList = null

const componentList = (entries, label) => {
  createComponentList ??= component('imp-preview-component-list', componentListDefinition)
  return createComponentList(entries, label)
}

const primaryAt = (strength) =>
  `color-mix(in oklch, var(--imp-color-primary, #2563eb) ${strength}%, transparent)`

const accentAt = (strength, hueShift) =>
  `color-mix(in oklch, oklch(from var(--imp-color-primary, #2563eb) l c calc(h + ${hueShift})) ` +
  `${strength}%, transparent)`

const CELL = '2rem'

const GRID_CELLS = [
  { column: 2, row: 0 },
  { column: 7, row: 1 },
  { column: 11, row: 0 },
  { column: 16, row: 1 },
  { column: 22, row: 0 },
  { column: 27, row: 1 },
  { column: 33, row: 0 },
  { column: 38, row: 1 },
  { column: 44, row: 0 },
  { column: 49, row: 1 },
  { column: 0, row: 6 },
  { column: 0, row: 13 },
  { column: 0, row: 21 },
  { column: 0, row: 27 },
]

const CELL_HUES = [0, 80, 160, -50, 240]

const CELL_PULSE_SECONDS = 48

const gridLine = (angle) =>
  `repeating-linear-gradient(${angle}, black 0 1px, transparent 1px ${CELL})`

const PAGE_BACKDROP_STYLES = `
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    pointer-events: none;
  }

  .grid {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      115deg,
      ${primaryAt(30)},
      ${accentAt(30, 80)} 25%,
      ${accentAt(30, 160)} 50%,
      ${accentAt(30, -50)} 75%,
      ${primaryAt(30)}
    );
    background-size: 160% 160%;
    mask-image: ${gridLine('90deg')}, ${gridLine('180deg')};
    animation: imp-preview-grid-drift 240s linear infinite alternate;
  }

  .cell {
    position: absolute;
    inline-size: ${CELL};
    block-size: ${CELL};
    inset-block-start: calc(var(--row) * ${CELL});
    inset-inline-start: calc(var(--column) * ${CELL});
    opacity: 0;
    animation: imp-preview-cell-pulse ${CELL_PULSE_SECONDS}s ease-in-out infinite;
    animation-delay: calc(var(--delay) * -1s);
  }

  @keyframes imp-preview-grid-drift {
    from { background-position: 0% 0% }
    to { background-position: 100% 100% }
  }

  @keyframes imp-preview-cell-pulse {
    0%, 100% { opacity: 0 }
    50% { opacity: 1 }
  }

  @media (prefers-reduced-motion: reduce) {
    .grid { animation: none }

    .cell {
      opacity: 0.6;
      animation: none;
    }
  }
`

const PANEL_TONE = 'color-mix(in oklch, var(--imp-color-primary, #2563eb) 5%, ' +
  'color-mix(in oklch, black 5%, var(--imp-color-surface, #ffffff)))'

const PANEL_BACKDROP_STYLES = `
  :host {
    display: block;
    position: relative;
    pointer-events: none;
  }

  .tone {
    position: absolute;
    inset: 0;
    background: ${PANEL_TONE};
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
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
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

const pick = (list) => list[Math.floor(Math.random() * list.length)]

const cellGradient = () => {
  const from = pick(CELL_HUES)
  const to = pick(CELL_HUES.filter((hue) => hue !== from))
  const angle = Math.floor(Math.random() * 360)
  return `linear-gradient(${angle}deg, ${accentAt(34, from)}, ${accentAt(34, to)})`
}

const gridCell = ({ column, row }) =>
  div({
    class: 'cell',
    style: `--column: ${column}; --row: ${row}; --delay: ${
      (Math.random() * CELL_PULSE_SECONDS).toFixed(1)
    }; background: ${cellGradient()}`,
  })

const pageBackdropDefinition = {
  styles: PAGE_BACKDROP_STYLES,
  setup: () => [div({ class: 'grid' }), ...GRID_CELLS.map(gridCell)],
}

const panelBackdropDefinition = {
  styles: PANEL_BACKDROP_STYLES,
  setup: () => div({ class: 'tone' }),
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
    const cards = listed.map(({ name, href, entries }) =>
      card(
        {
          padding: 'sm',
          header: flex(
            { horizontalAlign: 'justify', verticalAlign: 'center', gap: 2 },
            heading({ level: 2 }, link({ href }, name)),
            tag({ size: 'sm' }, String(entries.length)),
          ),
        },
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

const PREVIEW_SUFFIX = /\.preview\.(js|mjs)$/

export const sidecarNameOf = (entry) =>
  entry.file.split('/').pop().replace(PREVIEW_SUFFIX, '.skill.md')

const agentStrip = (self, entry) =>
  el(
    'section',
    { class: 'agent', 'aria-label': 'Agent instruction' },
    span({ class: 'agent-label' }, 'For an agent'),
    entry.skill === null
      ? span(
        { class: 'missing' },
        `no skill - write ${sidecarNameOf(entry)} next to the component. imp shows it here, ` +
          "and 'imp skill' prints it for an agent.",
      )
      : [pre({ class: 'instruction' }, entry.skill), copyButton(self, 'skill', entry.skill)],
  )

const SKILL_STYLES = `
  .agent {
    margin-block-end: var(--imp-space-4, 16px);
    display: flex;
    align-items: center;
    gap: var(--imp-space-3, 12px);
    flex-wrap: wrap;
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-3, 12px);
    background-color: var(--imp-color-surface-sunken, #f8fafc);
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-item, 6px);
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

  ${MARKDOWN_STYLES}
`

const markdownBody = (html, extraClass = null) => {
  const body = div({ class: extraClass === null ? 'md' : `md ${extraClass}` })
  body.innerHTML = html
  for (const block of body.querySelectorAll('pre > code')) {
    const language = block.className.match(/language-(\S+)/)?.[1]
    block.parentElement.replaceWith(codeBlock({ language, code: block.textContent }))
  }
  return body
}

const skillBody = (html, entry) => {
  if (html === null) {
    return emptyState({
      title: 'No skill for this component',
      description: `Write ${
        sidecarNameOf(entry)
      } next to the component. imp shows it here, and 'imp skill' prints it for an agent.`,
    })
  }
  return markdownBody(html)
}

const skillDefinition = {
  styles: SKILL_STYLES,
  setup: (self, html, entry) => div(agentStrip(self, entry), skillBody(html, entry)),
}

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
  setup: (_instance, entry) =>
    div(
      { class: 'head' },
      div(
        { class: 'title' },
        heading({ level: 1 }, entry.name),
        span({ class: 'file' }, entry.file),
      ),
      entry.description === null ? null : markdownBody(entry.description, 'description'),
    ),
}

let createCanvas = null
let createPageBackdrop = null
let createPanelBackdrop = null
let createSettings = null
let createIndex = null
let createHead = null
let createFailure = null
let createSkill = null

export const buildFailure = (entry) => {
  createFailure ??= component('imp-preview-failure', failureDefinition)
  return createFailure(entry)
}

export const previewCanvas = (content) => {
  createCanvas ??= component('imp-preview-canvas', canvasDefinition)
  return createCanvas(content)
}

const pageBackdrop = () => {
  createPageBackdrop ??= component('imp-preview-page-backdrop', pageBackdropDefinition)
  return createPageBackdrop()
}

const panelBackdrop = () => {
  createPanelBackdrop ??= component('imp-preview-panel-backdrop', panelBackdropDefinition)
  return createPanelBackdrop()
}

export const previewSettings = (controls) => {
  createSettings ??= component('imp-preview-settings', settingsDefinition)
  return createSettings(controls)
}

export const previewIndex = (listed) => {
  createIndex ??= component('imp-preview-index', indexDefinition)
  return createIndex(listed)
}

export const previewHead = (entry) => {
  createHead ??= component('imp-preview-head', headDefinition)
  return createHead(entry)
}

export const previewSkill = (html, entry) => {
  createSkill ??= component('imp-preview-skill', skillDefinition)
  return createSkill(html, entry)
}

export const previewShell = ({ mark, navbar, navOpen, controls, editor, content }) => {
  const host = shell(
    {
      logo: appLogo({ label: 'imp preview', src: mark, href: '/' }),
      navbar: { ...navbar, background: panelBackdrop() },
      navOpen,
      sidebar: { label: 'Components', background: panelBackdrop() },
      extras: previewSettings(controls),
      background: pageBackdrop(),
      gap: 3,
    },
    previewCanvas(stack({ gap: 4 }, content)),
    editor,
  )
  host.setAttribute('dir', 'ltr')
  host.style.setProperty('--imp-shell-sidebar-inline-size', '15rem')
  return host
}
