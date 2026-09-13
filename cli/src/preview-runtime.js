import { appMap, component, init, mount } from 'imp'
import { div, el, h2, pre, span } from 'imp/html'
import { applyTheme, colorSchemeOf } from 'imp/theme'
import { lang, setLang } from 'imp/i18n'
import { area, navigate, router, useRoute } from 'imp/router'
import { button, heading, icon, text } from 'imp/std'
import {
  luCode,
  luContrast,
  luEclipse,
  luMoon,
  luPalette,
  luSlidersHorizontal,
  luSun,
} from 'imp/icons'
import { card, codeBlock, emptyState } from 'imp/std/display'
import { select, textArea } from 'imp/std/inputs'
import { dialog, drawer, stack } from 'imp/std/layout'
import { tabs } from 'imp/std/navigation'
import {
  buildFailure,
  groupsOf,
  previewHead,
  previewIndex,
  previewShell,
  previewSkill,
} from './preview-shell.js'
import { themeEditor } from '../../lib/src/theme-editor.js'
import { followAppliedTheme } from '../../lib/src/theme-draft.js'
import { PREVIEW_METADATA_EXPORTS, PREVIEW_SKILL_EXPORT } from './preview-metadata.js'
import { previewSlugs } from './preview-map.js'
import { asNodes } from '../../lib/src/nodes.js'
import { statesProvidedBy } from '../../lib/src/state.js'
import { computed, initState } from 'imp/state'

const THEME_STORAGE_KEY = 'imp.preview.theme'
const LANGUAGE_STORAGE_KEY = 'imp.preview.lang'
const DIRECTION_STORAGE_KEY = 'imp.preview.dir'
const CODE_STORAGE_KEY = 'imp.preview.code'

const EDITOR_STATE = 'imp.preview.editor'
const THEME_STATE = 'imp.preview.theme'
const LANGUAGE_STATE = 'imp.preview.lang'
const DIRECTION_STATE = 'imp.preview.dir'
const DRAFT_STATE = 'imp.preview.draft'
const STATE_EDITOR_STATE = 'imp.preview.state-editor'
const STATES_FOUND_STATE = 'imp.preview.states-found'
const CODE_STATE = 'imp.preview.code'

const BUILT_IN_THEMES = [
  'imp-light',
  'imp-dark',
  'imp-high-contrast-light',
  'imp-high-contrast-dark',
]
const BASE_THEME_FOR = { light: 'imp-light', dark: 'imp-dark' }
const BUILT_IN_THEME_ICONS = {
  'imp-light': luSun,
  'imp-dark': luMoon,
  'imp-high-contrast-light': luContrast,
  'imp-high-contrast-dark': luEclipse,
}
const DIRECTIONS = ['auto', 'ltr', 'rtl']

const themes = new Map()

const languages = []

let stages = []

const MIN_STAGE_SIZE = 80
const TABS_STORAGE_KEY = 'imp.preview.tabs'
const NARROW_SCREEN = '(width < 40rem)'
const STATE_SCAN_ATTEMPTS = 30
const STATE_SCAN_INTERVAL = 100
const MAX_SCANNED_ELEMENTS = 500

const DOCUMENT_STYLES = `
body {
  margin: 0;
  background: var(--imp-color-surface-hover, #f1f5f9);
  font-family: var(--imp-font-family, system-ui, sans-serif);
  font-weight: var(--imp-font-weight-normal, 400);
}
`

const surface = `
  background: var(--imp-color-surface-sunken, #f8fafc);
  border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  border-radius: var(--imp-radius-container, 10px);
`

const SCENARIO_STYLES = `
  .scenario {
    display: block;
    --imp-dialog-inline-size: 26rem;
    padding-block-end: var(--imp-space-5, 24px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-weight: var(--imp-font-weight-normal, 400);
  }

  .scenario-head {
    display: flex;
    align-items: center;
    gap: var(--imp-space-3, 12px);
    margin-block-end: var(--imp-space-2, 8px);
  }

  .state-toggle {
    display: inline-flex;
  }

  .scenario-head h2 {
    margin: 0;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-weight: var(--imp-font-weight-bold, 600);
    font-size: var(--imp-font-size-md, 1rem);
  }

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

  .code {
    margin-block-start: var(--imp-space-3, 12px);
  }

  .code-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--imp-space-2, 8px);
    margin-block-end: var(--imp-space-1, 4px);
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

`

const STAGE_STYLES = `
  :host {
    display: block;
  }

  .bar {
    display: flex;
    justify-content: flex-end;
    margin-block-end: var(--imp-space-1, 4px);
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .readout {
    flex: none;
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
    border-radius: var(--imp-radius-item, 6px);
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

  .provider {
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-xs, 0.75rem);
  }

  .message {
    display: block;
    margin-block-start: var(--imp-space-1, 4px);
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-weight: var(--imp-font-weight-normal, 400);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-normal, 1.6);
  }

  .message--error {
    color: var(--imp-color-danger, #dc2626);
  }
`

const GROUP_STYLES = `
  .hero {
    margin-block-end: var(--imp-space-6, 32px);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: var(--imp-space-4, 16px);
  }

  .card-head {
    display: flex;
    align-items: baseline;
    gap: var(--imp-space-2, 8px);
    min-inline-size: 0;
  }

  .card-name {
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-weight: var(--imp-font-weight-bold, 600);
    font-size: var(--imp-font-size-md, 1rem);
  }

  .card-scenario {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .specimen {
    flex: 1;
    box-sizing: border-box;
    min-block-size: 8rem;
    max-block-size: 16rem;
    overflow: hidden;
    padding: var(--imp-space-4, 16px);
    ${surface}
  }

  .specimen--failed {
    color: var(--imp-color-danger, #dc2626);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
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
          'object like { name, tokens } - skipping it',
      )
      continue
    }
    themes.set(customThemeLabel(source, definition), definition)
  }
  for (const name of BUILT_IN_THEMES) {
    if (!themes.has(name)) themes.set(name, name)
  }
}

const applySelectedTheme = (name) => {
  const definition = themes.get(name)
  if (typeof definition === 'string') applyTheme(definition)
  else {
    applyTheme({
      ...definition,
      name,
      base: definition.base ?? BASE_THEME_FOR[colorSchemeOf(definition.tokens)] ?? 'imp-light',
    })
  }
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

const CODE_CHOICES = ['shown', 'hidden']

const TABS_CHOICES = ['folded', 'unfolded']

const readStoredTabs = () =>
  readStored(
    TABS_STORAGE_KEY,
    (value) => TABS_CHOICES.includes(value),
    matchMedia(NARROW_SCREEN).matches ? 'folded' : 'unfolded',
  ) === 'folded'

const readStoredCode = () =>
  readStored(CODE_STORAGE_KEY, (value) => CODE_CHOICES.includes(value), 'hidden') === 'shown'

const registerLanguages = (previewTranslations) => {
  languages.length = 0
  for (const { code } of previewTranslations) {
    if (!languages.includes(code)) languages.push(code)
  }
}

const stageDirection = () => document.documentElement.dir || 'ltr'

const applyStageDirection = () => {
  const choice = readStoredDirection()
  if (choice !== 'auto') document.documentElement.dir = choice
  stages = stages.filter((stage) => stage.isConnected)
  const direction = stageDirection()
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

const picker = (label, values, choice) => select({ label, value: choice, options: values })

const themeIcon = (name) => icon(BUILT_IN_THEME_ICONS[name] ?? luPalette, { size: 'sm' })

const nextThemeName = (current) => {
  const names = [...themes.keys()]
  return names[(names.indexOf(current) + 1) % names.length]
}

const themeSwitcher = (choice) =>
  stack(
    { gap: 1, horizontalAlign: 'start' },
    text({ tone: 'secondary', size: 'sm' }, 'Theme'),
    button(
      {
        size: 'sm',
        menuTrigger: 'hover',
        label: choice.text((name) => `Theme: ${name} - next theme`),
        events: { click: () => choice.set(nextThemeName(choice.get())) },
        items: [...themes.keys()].map((name) => ({
          id: name,
          label: name,
          icon: themeIcon(name),
          onClick: () => choice.set(name),
        })),
      },
      span(
        { style: 'display: inline-flex; align-items: center; gap: var(--imp-space-2, 8px)' },
        choice.view((name) => themeIcon(name)),
        choice.text((name) => name),
      ),
    ),
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

const statesInTree = (nodes) =>
  elementsInTree(nodes).flatMap((provider) =>
    statesProvidedBy(provider).map(({ name, state }) => ({ name, state, provider }))
  )

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
  setup: (_self, nodes) => {
    const stage = div({ class: 'stage', dir: stageDirection() }, nodes)
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
      readout.textContent = `${Math.round(rect.width)} x ${Math.round(rect.height)}`
    }
    new ResizeObserver(updateReadout).observe(frame)
    return div(div({ class: 'bar' }, readout), frame)
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
  watch: (...args) => {
    const subscriber = args.pop()
    return source.watch(...args, (value) => subscriber(!value))
  },
})

const stateRow = (self, { name, state, provider }, index) => {
  const draft = initState(self, `${DRAFT_STATE}.${index}`, '')
  const editable = initState(self, `${DRAFT_STATE}.${index}.editable`, false)
  const messageText = document.createTextNode('')
  const message = span({ class: 'message' }, messageText)
  const field = textArea({
    ariaLabel: `${name} value as JSON`,
    value: draft,
    rows: 2,
    disabled: negated(editable),
  })

  const setMessage = (content, isError = false) => {
    messageText.data = content
    message.classList.toggle('message--error', isError)
  }

  const apply = () => {
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

  state.watch(self, (value) => {
    const described = describeValue(value)
    if (!field.matches(':focus-within')) draft.set(described.text)
    editable.set(described.editable)
    setMessage(described.note)
  })

  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) apply()
  })

  return div(
    { class: 'row' },
    div(
      { class: 'row-head' },
      span({ class: 'name' }, name),
      span({ class: 'provider' }, `<${provider.localName}>`),
      applyButton,
    ),
    field,
    message,
  )
}

const editorDefinition = {
  styles: EDITOR_STYLES,
  setup: (self, entries) =>
    div(
      { class: 'editor' },
      text(
        { tone: 'secondary', size: 'sm' },
        'Values are JSON. Edit one and apply it (or press Ctrl+Enter) to drive the component.',
      ),
      ...entries.map((entry, index) => stateRow(self, entry, index)),
    ),
}

let createEditor = null

const stateEditor = (entries) => {
  createEditor ??= component('imp-preview-state', editorDefinition)
  return createEditor(entries)
}

const statePanel = (self, label, nodes) => {
  const editing = initState(self, STATE_EDITOR_STATE, false)
  const found = initState(self, STATES_FOUND_STATE, false)
  const editorSlot = div()
  const scan = () => {
    const entries = statesInTree(nodes)
    found.set(entries.length > 0)
    editorSlot.replaceChildren(stateEditor(entries))
    return entries.length
  }
  const scanUntilFound = (attemptsLeft) => {
    if (scan() > 0 || attemptsLeft <= 0) return
    setTimeout(() => scanUntilFound(attemptsLeft - 1), STATE_SCAN_INTERVAL)
  }
  queueMicrotask(() => scanUntilFound(STATE_SCAN_ATTEMPTS))
  editing.watch(self, (open) => {
    if (open) scan()
  })
  const toggle = button(
    { size: 'sm', variant: 'ghost', label: 'Edit state', pressed: editing },
    icon(luSlidersHorizontal),
  )
  const anchor = span({ class: 'state-toggle' }, toggle)
  found.watch(self, (present) => {
    anchor.hidden = !present
  })
  const editor = dialog(
    { title: `${label} state`, modal: false, open: editing, anchor },
    editorSlot,
  )
  return { toggle: anchor, editor }
}

const scenarioDefinition = {
  styles: SCENARIO_STYLES,
  setup: (self, name, scenario, entry) => scenarioSection(self, name, scenario, entry),
}

let createScenario = null

const scenarioPanel = (name, scenario, entry) => {
  createScenario ??= component('imp-preview-scenario', scenarioDefinition)
  return createScenario(name, scenario, entry)
}

const isLabelledScenario = (exported) =>
  exported !== null && typeof exported === 'object' && !(exported instanceof Node) &&
  !Array.isArray(exported) && typeof exported.scenario === 'string' && 'component' in exported

const scenarioOf = (name, exported) =>
  isLabelledScenario(exported)
    ? { label: exported.scenario, component: exported.component }
    : { label: name, component: exported }

const buildScenario = (component) =>
  asNodes(typeof component === 'function' ? component() : component)

const scenarioSection = (self, name, exported, entry) => {
  const { label, component } = scenarioOf(name, exported)
  let nodes
  try {
    nodes = buildScenario(component)
  } catch (error) {
    nodes = null
    console.error(`imp preview: scenario '${name}' failed to build`, error)
  }
  if (!nodes) {
    return el(
      'section',
      { class: 'scenario' },
      div({ class: 'scenario-head' }, h2(label)),
      pre({ class: 'failure' }, `${name} failed to build - see the terminal`),
    )
  }
  const { toggle: stateToggle, editor } = statePanel(self, label, nodes)
  const source = entry.code?.[name] ?? null
  const showingCode = initState(self, CODE_STATE, source !== null && readStoredCode())
  showingCode.watch((open) => remember(CODE_STORAGE_KEY, open ? 'shown' : 'hidden'))
  const codeToggle = source === null ? null : button(
    { size: 'sm', variant: 'ghost', label: 'Show code', pressed: showingCode },
    icon(luCode),
  )
  return el(
    'section',
    { class: 'scenario' },
    div({ class: 'scenario-head' }, h2(label), stateToggle, codeToggle),
    stagePanel(nodes),
    source === null ? null : codePanel(source, showingCode),
    editor,
  )
}

const codePanel = (source, showing) => {
  const panel = div(
    { class: 'code' },
    div({ class: 'code-head' }, span('Call site')),
    codeBlock({ language: 'js', code: source }),
  )
  showing.watch((open) => {
    panel.hidden = !open
  })
  return panel
}

const groupCard = (entry, load) => {
  const scenarioName = span({ class: 'card-scenario' })
  const specimen = div({ class: 'specimen', inert: true, dir: stageDirection() })
  stages.push(specimen)
  const fail = (message) => {
    specimen.classList.add('specimen--failed')
    specimen.replaceChildren(message)
  }
  if (entry.error !== undefined) fail('failed to build - open the card for the error')
  else {
    load().then((scenarios) => {
      const name = scenarioOrder(scenarios, entry.order)[0]
      if (name === undefined) {
        fail('no scenarios in this file')
        return
      }
      const { label, component } = scenarioOf(name, scenarios[name])
      scenarioName.textContent = label
      try {
        specimen.replaceChildren(...buildScenario(component))
      } catch (error) {
        console.error(`imp preview: scenario '${name}' failed to build`, error)
        fail(`${name} failed to build - see the terminal`)
      }
    }, (error) => fail(error.message))
  }
  return card(
    {
      padding: 'sm',
      href: entry.href,
      label: entry.name,
      header: div({ class: 'card-head' }, span({ class: 'card-name' }, entry.name), scenarioName),
    },
    specimen,
  )
}

const groupDefinition = {
  styles: GROUP_STYLES,
  setup: (_self, group, load) =>
    div(
      div(
        { class: 'hero' },
        stack(
          { gap: 2 },
          heading({ level: 1 }, group.name),
          text(
            { tone: 'secondary' },
            `${group.entries.length} component${group.entries.length === 1 ? '' : 's'}. ` +
              'Each card shows the first scenario. Open a card for every scenario.',
          ),
        ),
      ),
      div({ class: 'cards' }, ...group.entries.map((entry) => groupCard(entry, load[entry.file]))),
    ),
}

let createGroup = null

const groupScreen = (group, load) => {
  createGroup ??= component('imp-preview-group', groupDefinition)
  return createGroup(group, load)
}

const isScenarioExport = (name) =>
  !PREVIEW_METADATA_EXPORTS.includes(name) && name !== PREVIEW_SKILL_EXPORT

const scenarioOrder = (scenarios, order) => {
  const exported = Object.keys(scenarios).filter(isScenarioExport)
  const written = order.filter((name) => exported.includes(name))
  return [...written, ...exported.filter((name) => !written.includes(name))]
}

const scenarioTabs = (scenarios, entry) => {
  const names = scenarioOrder(scenarios, entry.order)
  if (!names.length) {
    return emptyState({
      title: 'No scenarios in this file',
      description: `${entry.file} has no named exports - export one instance per scenario, ` +
        'like export const empty = myComponent()',
    })
  }
  const selected = computed(
    [useRoute()],
    ({ query }) => names.includes(query.scenario) ? query.scenario : names[0],
  )
  return tabs({
    orientation: 'vertical',
    foldable: true,
    folded: readStoredTabs(),
    label: `${entry.name} scenarios`,
    selected,
    items: names.map((name) => ({
      id: name,
      label: scenarioOf(name, scenarios[name]).label,
      content: scenarioPanel(name, scenarios[name], entry),
    })),
    events: {
      select: (event) =>
        navigate(`${entry.href}?scenario=${encodeURIComponent(event.detail.id)}`, {
          replace: true,
        }),
      fold: (event) => remember(TABS_STORAGE_KEY, event.detail.folded ? 'folded' : 'unfolded'),
    },
  })
}

const scenarioScreen = (scenarios, entry) =>
  div(
    previewHead(entry),
    tabs({
      label: `${entry.name} views`,
      items: [
        { id: 'scenarios', label: 'Scenarios', content: scenarioTabs(scenarios, entry) },
        {
          id: 'skill',
          label: 'Skill',
          content: previewSkill(scenarios[PREVIEW_SKILL_EXPORT] ?? null, entry),
        },
      ],
    }),
  )

const noPreviews = () =>
  emptyState({
    title: 'No previews found',
    description: "Write a '*.preview.js' file next to a component and export one instance per " +
      'scenario, like export const empty = myComponent()',
  })

const previewArea = (entry, handle, load) =>
  area(() =>
    load().then((scenarios) => ({
      default: area({ screens: { [handle]: () => scenarioScreen(scenarios, entry) } }),
    }))
  )

const bindCatalog = (catalog, load, listed) => {
  const slugs = previewSlugs(catalog)
  const nodes = {}
  for (const group of listed) {
    const children = {}
    for (const entry of group.entries) {
      const slug = slugs.get(entry.file)
      children[slug.key] = { path: slug.segment, label: entry.name }
    }
    const slug = slugs.get(group.entries[0].file)
    nodes[slug.groupKey] = { path: slug.groupSegment, label: group.name, ...children }
  }
  const app = appMap({ components: { path: '/', label: 'Components', ...nodes } })
  const icons = {}
  const tags = {}
  const screens = { [app.components]: () => listed.length ? previewIndex(listed) : noPreviews() }
  const entries = new Map()
  const groups = new Map()
  for (const group of listed) {
    const groupHandle = app.components[slugs.get(group.entries[0].file).groupKey]
    icons[groupHandle] = group.icon
    tags[groupHandle] = { text: group.entries.length }
    group.href = groupHandle.href()
    groups.set(String(groupHandle), group)
    screens[groupHandle] = () => groupScreen(group, load)
    for (const entry of group.entries) {
      const handle = groupHandle[slugs.get(entry.file).key]
      entry.href = handle.href()
      entries.set(String(handle), entry)
      screens[handle] = entry.error === undefined
        ? previewArea(entry, handle, load[entry.file])
        : () => buildFailure(entry)
    }
  }
  const title = ({ node }) => {
    const entry = entries.get(String(node))
    if (entry !== undefined) return `imp preview - ${entry.group} / ${entry.name}`
    const group = groups.get(String(node))
    return group === undefined ? 'imp preview' : `imp preview - ${group.name}`
  }
  return { app, icons, tags, screens, title }
}

const pageDefinition = {
  setup: (self, bound) => {
    const themeChoice = initState(self, THEME_STATE, readStoredTheme())
    const directionChoice = initState(self, DIRECTION_STATE, readStoredDirection())
    const languageChoice = languages.length
      ? initState(self, LANGUAGE_STATE, readStoredLanguage())
      : null

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

    const editorOpen = initState(self, EDITOR_STATE, false)
    const controls = [
      languageChoice ? picker('Language', languages, languageChoice) : null,
      picker('Text direction', DIRECTIONS, directionChoice),
      themeSwitcher(themeChoice),
      button(
        { size: 'sm', events: { click: () => editorOpen.set(!editorOpen.get()) } },
        editorOpen.text((open) => (open ? 'close theme editor' : 'edit theme')),
      ),
    ].filter(Boolean)

    const editor = drawer(
      { title: 'Theme editor', modal: false, open: editorOpen },
      editorOpen.view((open) => open ? themeChoice.view((name) => themeEditor(name)) : null),
    )

    return previewShell({
      mark: bound.mark,
      navbar: { map: bound.app, icons: bound.icons, tags: bound.tags },
      controls,
      editor,
      content: router({
        map: bound.app,
        screens: bound.screens,
        title: bound.title,
        loading: () => text({ tone: 'secondary' }, 'Loading...'),
        notFound: () =>
          emptyState({
            title: 'No such preview',
            description: 'Pick a component from the catalog.',
          }),
      }),
    })
  },
}

let createPage = null

const previewPage = (bound) => {
  createPage ??= component('imp-preview-page', pageDefinition)
  return createPage(bound)
}

const GROUPS_SHAPE =
  "export const groups = { widgets: { name: 'Widgets', icon: luBox } } - a key per group, with a name and an icon from 'imp/icons'"

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const readGroups = (declared) => {
  if (declared === null) return []
  const { source, module } = declared
  if (!isPlainObject(module.groups)) {
    console.error(
      `imp preview: ${source} (preview.groups) must export an object named groups, like ${GROUPS_SHAPE}`,
    )
    return []
  }
  const groups = []
  for (const [key, entry] of Object.entries(module.groups)) {
    if (typeof entry?.name !== 'string' || !entry.name.trim()) {
      console.error(
        `imp preview: ${source} (preview.groups) group '${key}' has no name - each entry is ${GROUPS_SHAPE}`,
      )
      continue
    }
    if (entry.icon !== undefined && !Array.isArray(entry.icon)) {
      console.error(
        `imp preview: ${source} (preview.groups) group '${key}' has an icon that is not one from 'imp/icons' - it is drawn with the folder icon`,
      )
    }
    if (entry.priority !== undefined && !Number.isFinite(entry.priority)) {
      console.error(
        `imp preview: ${source} (preview.groups) group '${key}' has a priority that is not a number - it is ignored`,
      )
    }
    groups.push({
      name: entry.name,
      icon: Array.isArray(entry.icon) ? entry.icon : null,
      priority: Number.isFinite(entry.priority) ? entry.priority : null,
    })
  }
  return groups.map((group, index) => ({ ...group, index })).sort(byPriorityThenOrder)
}

const byPriorityThenOrder = (left, right) => {
  if (left.priority !== null && right.priority !== null) {
    return left.priority - right.priority || left.index - right.index
  }
  if (left.priority !== null) return -1
  if (right.priority !== null) return 1
  return left.index - right.index
}

const ensureFavicon = (favicon) => {
  if (document.head.querySelector('link[rel~="icon"]')) return
  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.href = favicon
  document.head.append(icon)
}

export async function startPreview(
  {
    mark,
    favicon,
    catalog,
    load,
    themes: customThemes = [],
    translations = [],
    groups: declaredGroups = null,
  },
) {
  ensureFavicon(favicon)
  const listed = groupsOf(catalog, readGroups(declaredGroups))
  const styles = document.createElement('style')
  styles.textContent = DOCUMENT_STYLES
  document.head.append(styles)
  registerThemes(customThemes)
  followAppliedTheme()
  applySelectedTheme(readStoredTheme())
  registerLanguages(translations)

  await init(
    translations.length
      ? {
        translations: Object.fromEntries(
          translations.map(({ code, module }) => [code, () => module]),
        ),
      }
      : {},
  )
  await applyLanguage(readStoredLanguage())

  mount(document.body, previewPage({ ...bindCatalog(catalog, load, listed), mark }))
  applyStageDirection()
}
