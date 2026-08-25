import { component, init, mount } from 'imp'
import { a, code as codeTag, div, el, h2, pre, span } from 'imp/html'
import { initState } from 'imp/state'
import { applyTheme } from 'imp/theme'
import { lang, setLang } from 'imp/i18n'
import { button, text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { emptyState } from 'imp/std/display'
import { select, textArea } from 'imp/std/inputs'
import { tabs } from 'imp/std/navigation'
import { previewHead, previewIndex, previewShell, readCatalog } from './preview_shell.js'
import { applyStoredDraft, snapshotBaseTokens, themeEditor } from './preview_theme_editor.js'
import { copyButton } from './preview_copy.js'
import { tokenizeJs } from './preview_highlight.js'
import { PREVIEW_METADATA_EXPORTS } from './preview_metadata.js'
import { asNodes } from '../../lib/src/nodes.js'
import { runInMountScope } from '../../lib/src/component.js'
import { findStateFrom } from '../../lib/src/state.js'

const THEME_STORAGE_KEY = 'imp.preview.theme'
const LANGUAGE_STORAGE_KEY = 'imp.preview.lang'
const DIRECTION_STORAGE_KEY = 'imp.preview.dir'

const EDITOR_STATE = 'imp.preview.editor'
const THEME_STATE = 'imp.preview.theme'
const LANGUAGE_STATE = 'imp.preview.lang'
const DIRECTION_STATE = 'imp.preview.dir'
const DRAFT_STATE = 'imp.preview.draft'

const BUILT_IN_THEMES = [
  'imp-light',
  'imp-dark',
  'imp-high-contrast-light',
  'imp-high-contrast-dark',
]
const BASE_THEME_FOR = { light: 'imp-light', dark: 'imp-dark' }
const DIRECTIONS = ['auto', 'ltr', 'rtl']

const themes = new Map()

const languages = []

const stages = []

const PRESETS = [
  { label: 'phone', width: 375, height: 667 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1280, height: 800 },
]

const MIN_STAGE_SIZE = 80
const STATE_LOOKUP_ATTEMPTS = 30
const STATE_LOOKUP_INTERVAL = 100
const MAX_SCANNED_ELEMENTS = 500

const DOCUMENT_STYLES = `
body {
  margin: 0;
  background: var(--imp-color-surface-hover, #f1f5f9);
  font-family: var(--imp-font-family, system-ui, sans-serif);
}
`

const surface = `
  background: var(--imp-color-surface, #ffffff);
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  border-radius: var(--imp-radius-lg, 10px);
`

const SCENARIO_STYLES = `
  .scenario {
    display: block;
    padding-block-end: var(--imp-space-5, 24px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    font-family: var(--imp-font-family, system-ui, sans-serif);
  }

  .scenario-head {
    display: flex;
    align-items: baseline;
    gap: var(--imp-space-3, 12px);
    margin-block-end: var(--imp-space-2, 8px);
  }

  .scenario-head h2 {
    margin: 0;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-md, 1rem);
  }

  a {
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

  .failure {
    margin: 0;
    padding: var(--imp-space-3, 12px);
    border-radius: var(--imp-radius-md, 6px);
    background: var(--imp-color-surface, #ffffff);
    border: var(--imp-border-width, 1px) solid var(--imp-color-danger, #dc2626);
    color: var(--imp-color-danger, #dc2626);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
    white-space: pre-wrap;
  }
`

const STAGE_STYLES = `
  :host {
    display: block;
    flex: 1 1 480px;
    min-inline-size: 280px;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--imp-space-2, 8px);
    margin-block-end: var(--imp-space-2, 8px);
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .readout {
    flex: none;
    margin-inline-start: auto;
    inline-size: 11ch;
    text-align: end;
    font-variant-numeric: tabular-nums;
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
  }

  .frame {
    position: relative;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
  }

  .stage {
    box-sizing: border-box;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 80px;
    overflow: auto;
    padding: var(--imp-space-4, 16px);
    ${surface}
    color: var(--imp-color-text, #0f172a);
  }

  .handle {
    position: absolute;
    touch-action: none;
    border-radius: var(--imp-radius-sm, 4px);
  }

  .handle--right {
    inset-block-start: 0;
    inset-inline-end: -5px;
    inline-size: 10px;
    block-size: 100%;
    cursor: ew-resize;
  }

  .handle--bottom {
    inset-inline-start: 0;
    inset-block-end: -5px;
    block-size: 10px;
    inline-size: 100%;
    cursor: ns-resize;
  }

  .handle--corner {
    inset-inline-end: -5px;
    inset-block-end: -5px;
    inline-size: 14px;
    block-size: 14px;
    cursor: nwse-resize;
    border-inline-end: 3px solid var(--imp-color-border, #cbd5e1);
    border-block-end: 3px solid var(--imp-color-border, #cbd5e1);
  }

  .handle:hover {
    background: var(--imp-color-primary, #2563eb);
    opacity: 0.25;
  }
`

const EDITOR_STYLES = `
  :host {
    display: block;
    flex: 0 1 320px;
    min-inline-size: 260px;
  }

  .editor {
    box-sizing: border-box;
    padding: var(--imp-space-3, 12px);
    ${surface}
  }

  h3 {
    margin: 0;
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-size: var(--imp-font-size-sm, 0.875rem);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .row {
    margin-block-start: var(--imp-space-3, 12px);
  }

  .row-head {
    display: flex;
    align-items: center;
    gap: var(--imp-space-2, 8px);
    margin-block-end: var(--imp-space-1, 4px);
  }

  .name {
    flex: 1;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .message {
    display: block;
    margin-block-start: var(--imp-space-1, 4px);
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-normal, 1.6);
  }

  .message--error {
    color: var(--imp-color-danger, #dc2626);
  }
`

const CODE_STYLES = `
  :host {
    display: block;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-block-end: var(--imp-space-2, 8px);
  }

  pre {
    margin: 0;
    box-sizing: border-box;
    overflow: auto;
    padding: var(--imp-space-3, 12px);
    ${surface}
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-normal, 1.6);
    tab-size: 2;
  }

  .token--keyword {
    color: var(--imp-color-primary, #2563eb);
    font-weight: var(--imp-font-weight-bold, 700);
  }

  .token--string,
  .token--number,
  .token--regexp {
    color: var(--imp-color-danger, #dc2626);
  }

  .token--comment {
    color: var(--imp-color-secondary, #64748b);
    font-style: italic;
  }

  .token--punctuation {
    color: var(--imp-color-secondary, #64748b);
  }
`

const isThemeDefinition = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  !!value.tokens && typeof value.tokens === 'object'

const customThemeLabel = (source, definition) => {
  const declared = typeof definition.name === 'string' ? definition.name.trim() : ''
  if (declared && !themes.has(declared)) return declared
  return declared ? `${declared} (${source})` : source
}

const registerThemes = (customThemes) => {
  themes.clear()
  for (const { source, module } of customThemes) {
    const definition = module?.default
    if (!isThemeDefinition(definition)) {
      console.error(
        `imp preview: '${source}' is listed in preview.themes but does not default-export a theme ` +
          'object like { name, colorScheme, tokens } - skipping it',
      )
      continue
    }
    themes.set(customThemeLabel(source, definition), definition)
  }
  for (const name of BUILT_IN_THEMES) themes.set(name, name)
}

const colorSchemeOf = (definition) =>
  typeof definition === 'string'
    ? (definition.includes('dark') ? 'dark' : 'light')
    : (definition?.colorScheme ?? 'light')

const applySelectedTheme = (name) => {
  const definition = themes.get(name)
  if (typeof definition === 'string') applyTheme(definition)
  else {
    applyTheme(BASE_THEME_FOR[definition?.colorScheme] ?? 'imp-light')
    applyTheme(definition)
  }
  snapshotBaseTokens()
  applyStoredDraft(name)
}

const defaultThemeName = () => themes.keys().next().value

const readStored = (key, isKnown, fallback) => {
  try {
    const stored = localStorage.getItem(key)
    return isKnown(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

const remember = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch { /* storage is unavailable - the choice just does not survive a reload */ }
}

const readStoredTheme = () =>
  readStored(THEME_STORAGE_KEY, (name) => themes.has(name), defaultThemeName())

const readStoredLanguage = () =>
  readStored(LANGUAGE_STORAGE_KEY, (code) => languages.includes(code), languages[0])

const readStoredDirection = () =>
  readStored(DIRECTION_STORAGE_KEY, (value) => DIRECTIONS.includes(value), 'auto')

const registerLanguages = (previewTranslations) => {
  languages.length = 0
  for (const { code } of previewTranslations) {
    if (!languages.includes(code)) languages.push(code)
  }
}

const applyStageDirection = () => {
  const choice = readStoredDirection()
  if (choice !== 'auto') document.documentElement.dir = choice
  const direction = document.documentElement.dir || 'ltr'
  for (const stage of stages) stage.dir = direction
}

const applyLanguage = async (code) => {
  await setLang(code ?? lang.get())
  applyStageDirection()
}

const switchTo = (code) => {
  applyLanguage(code).catch((error) => {
    console.error(`imp preview: could not switch to '${code}'`, error)
  })
}

const picker = (kind, ariaLabel, values, choice) =>
  flex(
    { gap: 2, align: 'center' },
    text({ tone: 'secondary', size: 'sm' }, kind),
    select({ ariaLabel, value: choice, options: values }),
  )

const elementsInTree = (nodes) => {
  const elements = []
  const visit = (node) => {
    if (elements.length >= MAX_SCANNED_ELEMENTS || !(node instanceof Element)) return
    elements.push(node)
    for (const child of node.children) visit(child)
    if (node.shadowRoot) { for (const child of node.shadowRoot.children) visit(child) }
  }
  for (const node of nodes) visit(node)
  return elements
}

const findStateInTree = (nodes, name) => {
  for (const element of elementsInTree(nodes)) {
    const found = findStateFrom(element, name)
    if (found) return found.state
  }
  return null
}

const describeValue = (value) => {
  let text
  try {
    text = JSON.stringify(value, null, 2)
  } catch (error) {
    return { text: String(value), editable: false, note: `not editable here - ${error.message}` }
  }
  if (text === undefined) {
    return {
      text: String(value),
      editable: false,
      note: 'this value is not JSON data, so it cannot be edited here',
    }
  }
  return { text, editable: true, note: '' }
}

const stageDefinition = {
  styles: STAGE_STYLES,
  onMount: (_instance, nodes) => {
    const stage = div({ class: 'stage' }, nodes)
    stages.push(stage)
    const frame = div({ class: 'frame' }, stage)
    const dragHandle = (kind) => {
      const handle = div({ class: `handle handle--${kind}` })
      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        const rect = frame.getBoundingClientRect()
        const startX = event.clientX
        const startY = event.clientY
        try {
          handle.setPointerCapture(event.pointerId)
        } catch { /* the pointer is already gone */ }
        const resize = (moveEvent) => {
          if (kind !== 'bottom') {
            const width = rect.width + moveEvent.clientX - startX
            frame.style.width = `${Math.round(Math.max(MIN_STAGE_SIZE, width))}px`
          }
          if (kind !== 'right') {
            const height = rect.height + moveEvent.clientY - startY
            frame.style.height = `${Math.round(Math.max(MIN_STAGE_SIZE, height))}px`
          }
        }
        const stop = () => handle.removeEventListener('pointermove', resize)
        handle.addEventListener('pointermove', resize)
        handle.addEventListener('pointerup', stop, { once: true })
        handle.addEventListener('pointercancel', stop, { once: true })
      })
      return handle
    }
    frame.append(...['right', 'bottom', 'corner'].map(dragHandle))
    const readout = span({ class: 'readout' })
    const updateReadout = () => {
      const rect = frame.getBoundingClientRect()
      readout.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`
    }
    new ResizeObserver(updateReadout).observe(frame)
    const setSize = (width, height) => {
      frame.style.width = width === null ? '' : `${width}px`
      frame.style.height = height === null ? '' : `${height}px`
    }
    const sizeButton = (label, width, height) =>
      button(
        { size: 'sm', variant: 'ghost', events: { click: () => setSize(width, height) } },
        label,
      )
    const bar = div(
      { class: 'bar' },
      span('size'),
      ...PRESETS.map(({ label, width, height }) => sizeButton(label, width, height)),
      sizeButton('fit', null, null),
      readout,
    )
    return div(bar, frame)
  },
}

let createStage = null

const stagePanel = (nodes) => {
  createStage ??= component('imp-preview-stage', stageDefinition)
  return createStage(nodes)
}

const negated = (source) => ({
  name: source.name,
  get: () => !source.get(),
  watch: (subscriber) => source.watch((value) => subscriber(!value)),
})

const stateRow = (nodes, declaration, index) => {
  const draft = initState(`${DRAFT_STATE}.${index}`, declaration.initial ?? '')
  const editable = initState(`${DRAFT_STATE}.${index}.editable`, false)
  const messageText = document.createTextNode('looking for this state…')
  const message = span({ class: 'message' }, messageText)
  const field = textArea({
    ariaLabel: `${declaration.name} value as JSON`,
    value: draft,
    rows: 2,
    disabled: negated(editable),
  })
  let state = null

  const setMessage = (content, isError = false) => {
    messageText.data = content
    message.classList.toggle('message--error', isError)
  }

  const apply = () => {
    if (!state) return
    let parsed
    try {
      parsed = JSON.parse(draft.get())
    } catch (error) {
      setMessage(error.message, true)
      return
    }
    state.set(parsed)
    setMessage('')
  }

  const applyButton = button(
    { size: 'sm', disabled: negated(editable), events: { click: apply } },
    'apply',
  )

  const show = (value) => {
    const described = describeValue(value)
    if (!field.matches(':focus-within')) draft.set(described.text)
    editable.set(described.editable)
    setMessage(described.note)
  }

  const lookForState = (attemptsLeft) => {
    const found = findStateInTree(nodes, declaration.name)
    if (found) {
      state = found
      runInMountScope({ addCleanup: () => {} }, () => found.watch(show))
      return
    }
    if (attemptsLeft <= 0) {
      setMessage('not initialized in this scenario')
      return
    }
    setTimeout(() => lookForState(attemptsLeft - 1), STATE_LOOKUP_INTERVAL)
  }
  lookForState(STATE_LOOKUP_ATTEMPTS)

  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) apply()
  })

  return div(
    { class: 'row' },
    div({ class: 'row-head' }, span({ class: 'name' }, declaration.name), applyButton),
    field,
    message,
  )
}

const editorDefinition = {
  styles: EDITOR_STYLES,
  onMount: (_instance, nodes, declarations) =>
    div(
      { class: 'editor' },
      el('h3', 'state'),
      declarations.length
        ? [
          text(
            { tone: 'secondary', size: 'sm' },
            'Values are JSON. Edit one and apply it (or press Ctrl+Enter) to drive the component.',
          ),
          ...declarations.map((declaration, index) => stateRow(nodes, declaration, index)),
        ]
        : text(
          { tone: 'secondary', size: 'sm' },
          'No state declarations were found in the sources this preview imports.',
        ),
    ),
}

let createEditor = null

const stateEditor = (nodes, declarations) => {
  createEditor ??= component('imp-preview-state', editorDefinition)
  return createEditor(nodes, declarations)
}

const highlighted = (snippet) =>
  tokenizeJs(snippet).map(({ kind, text }) =>
    kind === 'plain' ? text : span({ class: `token token--${kind}` }, text)
  )

const codeDefinition = {
  styles: CODE_STYLES,
  onMount: (_instance, snippet) =>
    div(
      div({ class: 'head' }, copyButton(snippet)),
      pre(codeTag(highlighted(snippet))),
    ),
}

let createCode = null

const codePanel = (snippet) => {
  createCode ??= component('imp-preview-code', codeDefinition)
  return createCode(snippet)
}

const snippetFor = (name, meta) => {
  const source = meta.sources?.[name]
  if (!source) return null
  const imports = (meta.imports ?? []).join('\n')
  return imports ? `${imports}\n\n${source}\n` : `${source}\n`
}

const scenarioDefinition = {
  styles: SCENARIO_STYLES,
  onMount: (_instance, name, scenario, meta) => scenarioSection(name, scenario, meta),
}

let createScenario = null

const scenarioPanel = (name, scenario, meta) => {
  createScenario ??= component('imp-preview-scenario', scenarioDefinition)
  return createScenario(name, scenario, meta)
}

const scenarioSection = (name, scenario, meta) => {
  let nodes
  try {
    nodes = asNodes(typeof scenario === 'function' ? scenario() : scenario)
  } catch (error) {
    nodes = null
    console.error(`imp preview: scenario '${name}' failed to build`, error)
  }
  const head = div(
    { class: 'scenario-head' },
    h2(name),
    a({ href: `?scenario=${encodeURIComponent(name)}` }, 'isolate'),
  )
  if (!nodes) {
    return el(
      'section',
      { class: 'scenario' },
      head,
      pre({ class: 'failure' }, `${name} failed to build - see the terminal`),
    )
  }
  const snippet = snippetFor(name, meta)
  return el(
    'section',
    { class: 'scenario' },
    head,
    tabs({
      label: `${name} views`,
      items: [
        {
          id: 'preview',
          label: 'Preview',
          content: flex(
            { gap: 4, align: 'start', wrap: true },
            stagePanel(nodes),
            stateEditor(nodes, meta.states),
          ),
        },
        {
          id: 'code',
          label: 'Code',
          content: snippet === null
            ? text(
              { tone: 'secondary', size: 'sm' },
              `imp could not read the code behind '${name}' - only exports written as ` +
                `'export const ${name} = …' in the preview file are shown here.`,
            )
            : codePanel(snippet),
        },
      ],
    }),
  )
}

const scenarioOrder = (scenarios, order) => {
  const exported = Object.keys(scenarios).filter((name) => !PREVIEW_METADATA_EXPORTS.includes(name))
  const written = order.filter((name) => exported.includes(name))
  return [...written, ...exported.filter((name) => !written.includes(name))]
}

const catalogEntryFor = (catalog, meta) =>
  catalog.previews.find((entry) => entry.file === meta.file) ??
    { file: meta.file, category: meta.category, name: meta.name, href: null }

const scenarioList = (scenarios, meta, catalog) => {
  const names = scenarioOrder(scenarios, meta.order)
  const requested = new URLSearchParams(location.search).get('scenario')
  const isolated = requested !== null && names.includes(requested)
  const shown = isolated ? [requested] : names
  return [
    previewHead(catalogEntryFor(catalog, meta), isolated, meta.description),
    ...(names.length ? shown.map((name) => scenarioPanel(name, scenarios[name], meta)) : [
      emptyState({
        title: 'No scenarios in this file',
        description: `${meta.file} has no named exports - export one instance per scenario, ` +
          'like export const empty = myComponent()',
      }),
    ]),
  ]
}

const mainContent = (scenarios, meta, catalog) => {
  if (scenarios !== null) return scenarioList(scenarios, meta, catalog)
  if (catalog.previews.length) return previewIndex(catalog.previews)
  return emptyState({
    title: 'No previews found',
    description: "Write a '*.preview.js' file next to a component and export one instance per " +
      'scenario, like export const empty = myComponent()',
  })
}

const pageDefinition = {
  onMount: (_instance, scenarios, meta, catalog) => {
    const themeChoice = initState(THEME_STATE, readStoredTheme())
    const directionChoice = initState(DIRECTION_STATE, readStoredDirection())
    const languageChoice = languages.length ? initState(LANGUAGE_STATE, readStoredLanguage()) : null

    themeChoice.watch((name) => {
      if (!themes.has(name)) return
      remember(THEME_STORAGE_KEY, name)
      applySelectedTheme(name)
    })
    languageChoice?.watch((codeName) => {
      remember(LANGUAGE_STORAGE_KEY, codeName)
      switchTo(codeName)
    })
    directionChoice.watch((value) => {
      remember(DIRECTION_STORAGE_KEY, value)
      switchTo(readStoredLanguage())
    })

    const editorOpen = initState(EDITOR_STATE, false)
    const controls = [
      languageChoice ? picker('language', 'Language', languages, languageChoice) : null,
      picker('direction', 'Text direction', DIRECTIONS, directionChoice),
      picker('theme', 'Theme', [...themes.keys()], themeChoice),
      button(
        { size: 'sm', events: { click: () => editorOpen.set(!editorOpen.get()) } },
        editorOpen.text((open) => (open ? 'close theme editor' : 'edit theme')),
      ),
    ].filter(Boolean)

    const editor = editorOpen.view((open) =>
      open ? themeChoice.view((name) => themeEditor(name, colorSchemeOf(themes.get(name)))) : null
    )

    return previewShell({
      catalog,
      controls,
      editor,
      content: mainContent(scenarios, meta, catalog),
    })
  },
}

let createPage = null

const previewPage = (scenarios, meta, catalog) => {
  createPage ??= component('imp-preview-page', pageDefinition)
  return createPage(scenarios, meta, catalog)
}

export async function startPreview(scenarios, meta, customThemes = [], previewTranslations = []) {
  const catalog = readCatalog()
  const styles = document.createElement('style')
  styles.textContent = DOCUMENT_STYLES
  document.head.append(styles)
  registerThemes(customThemes)
  applySelectedTheme(readStoredTheme())
  registerLanguages(previewTranslations)

  await init(
    previewTranslations.length
      ? {
        translations: Object.fromEntries(
          previewTranslations.map(({ code, module }) => [code, () => module]),
        ),
      }
      : {},
  )
  await applyLanguage(readStoredLanguage())

  mount(document.body, previewPage(scenarios, meta, catalog))
  applyStageDirection()
}
