import {
  a,
  aside,
  button,
  code,
  div,
  h2,
  h3,
  header,
  label,
  option,
  p,
  section,
  select,
  span,
  textarea,
} from 'imp/html'
import { applyTheme } from 'imp/theme'
import { asNodes } from '../../lib/src/nodes.js'
import { runInMountScope } from '../../lib/src/component.js'
import { findStateFrom } from '../../lib/src/state.js'

const THEME_STORAGE_KEY = 'imp.preview.theme'
const BUILT_IN_THEMES = ['imp-light', 'imp-dark']

const themes = new Map()

const PRESETS = [
  { label: 'phone', width: 375, height: 667 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1280, height: 800 },
]

const MIN_STAGE_SIZE = 80
const STATE_LOOKUP_ATTEMPTS = 30
const STATE_LOOKUP_INTERVAL = 100
const MAX_SCANNED_ELEMENTS = 500

const CHROME_STYLES = `
body { margin: 0; background: #0f1115; color: #e6e8ec;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
.imp-preview__bar { display: flex; align-items: center; gap: 12px; padding: 10px 16px;
  background: #171a21; border-bottom: 1px solid #262b36; position: sticky; top: 0; z-index: 10; }
.imp-preview__brand { font-weight: 600; font-size: 14px; }
.imp-preview__file { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
  color: #9aa4b8; }
.imp-preview__spacer { flex: 1; }
.imp-preview__link { color: #7c9cff; text-decoration: none; font-size: 13px; }
.imp-preview__link:hover { text-decoration: underline; }
.imp-preview__control { display: flex; align-items: center; gap: 6px; font-size: 13px;
  color: #9aa4b8; }
.imp-preview__select { background: #0f1115; color: #e6e8ec; border: 1px solid #2c3342;
  border-radius: 6px; padding: 4px 6px; font: inherit; font-size: 13px; }
.imp-preview__scenario { border-bottom: 1px solid #1e2230; padding: 20px 16px 28px; }
.imp-preview__scenario-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.imp-preview__scenario-head h2 { margin: 0; font-size: 15px; color: #f2f4f8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.imp-preview__panel { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.imp-preview__stage-wrap { flex: 1 1 480px; min-width: 280px; display: flex;
  flex-direction: column; gap: 8px; }
.imp-preview__stage-bar { display: flex; align-items: center; gap: 8px; font-size: 12px;
  color: #9aa4b8; }
.imp-preview__readout { margin-left: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.imp-preview__button { background: #212734; color: #e6e8ec; border: 1px solid #2c3342;
  border-radius: 6px; padding: 3px 9px; font: inherit; font-size: 12px; cursor: pointer; }
.imp-preview__button:hover { background: #2a3140; }
.imp-preview__button[disabled] { opacity: 0.5; cursor: not-allowed; }
.imp-preview__stage-frame { position: relative; box-sizing: border-box; width: 100%;
  max-width: 100%; margin: 0 auto; }
.imp-preview__stage { box-sizing: border-box; width: 100%; height: 100%; min-height: 80px;
  overflow: auto; padding: 16px; border: 1px solid #2c3342; border-radius: 8px;
  background: var(--imp-color-surface, #ffffff); color: var(--imp-color-text, #0f172a); }
.imp-preview__handle { position: absolute; touch-action: none; }
.imp-preview__handle--right { top: 0; right: -5px; width: 10px; height: 100%; cursor: ew-resize; }
.imp-preview__handle--bottom { left: 0; bottom: -5px; height: 10px; width: 100%;
  cursor: ns-resize; }
.imp-preview__handle--corner { right: -5px; bottom: -5px; width: 14px; height: 14px;
  cursor: nwse-resize; border-right: 3px solid #4b556b; border-bottom: 3px solid #4b556b;
  border-bottom-right-radius: 7px; }
.imp-preview__handle:hover { background: rgba(124, 156, 255, 0.25); }
.imp-preview__editor { flex: 0 1 320px; min-width: 260px; box-sizing: border-box;
  background: #171a21; border: 1px solid #262b36; border-radius: 8px; padding: 12px 14px; }
.imp-preview__editor h3 { margin: 0; font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.08em; color: #9aa4b8; }
.imp-preview__hint { margin: 6px 0 0; font-size: 12px; color: #7b8497; line-height: 1.5; }
.imp-preview__row { margin-top: 12px; }
.imp-preview__row-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.imp-preview__name { flex: 1; font-size: 12px; color: #cfd6e4;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.imp-preview__field { width: 100%; box-sizing: border-box; background: #0f1115; color: #e6e8ec;
  border: 1px solid #2c3342; border-radius: 6px; padding: 6px 8px; font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }
.imp-preview__field[disabled] { opacity: 0.6; }
.imp-preview__message { margin: 4px 0 0; font-size: 11px; color: #8b94a8; }
.imp-preview__message--error { color: #ff9b9b; }
.imp-preview__failure { margin: 0; padding: 12px 14px; border-radius: 8px; font-size: 13px;
  background: #2a1618; border: 1px solid #57282c; color: #ffb4b4; white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.imp-preview__empty { padding: 40px 16px; color: #9aa4b8; }
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
          'object like { name, colorScheme, tokens } — skipping it',
      )
      continue
    }
    themes.set(customThemeLabel(source, definition), definition)
  }
  for (const name of BUILT_IN_THEMES) themes.set(name, name)
}

const defaultThemeName = () => themes.keys().next().value

const readStoredTheme = () => {
  const fallback = defaultThemeName()
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return themes.has(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

const rememberTheme = (name) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, name)
  } catch { /* storage is unavailable — the choice just does not survive a reload */ }
}

const themeControl = () => {
  const current = readStoredTheme()
  const picker = select(
    {
      class: 'imp-preview__select',
      events: {
        change: (event) => {
          applyTheme(themes.get(event.target.value))
          rememberTheme(event.target.value)
        },
      },
    },
    [...themes.keys()].map((name) => option({ value: name, selected: name === current }, name)),
  )
  return label({ class: 'imp-preview__control' }, 'theme', picker)
}

const chromeBar = (file, isolated) =>
  header(
    { class: 'imp-preview__bar' },
    span({ class: 'imp-preview__brand' }, 'imp preview'),
    code({ class: 'imp-preview__file' }, file),
    span({ class: 'imp-preview__spacer' }),
    themeControl(),
    isolated ? a({ class: 'imp-preview__link', href: location.pathname }, 'all scenarios') : null,
    a({ class: 'imp-preview__link', href: '/' }, 'all previews'),
  )

const dragHandle = (kind, frame) => {
  const handle = div({ class: `imp-preview__handle imp-preview__handle--${kind}` })
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

const stageColumn = (nodes) => {
  const stage = div({ class: 'imp-preview__stage' }, nodes)
  const frame = div({ class: 'imp-preview__stage-frame' }, stage)
  frame.append(...['right', 'bottom', 'corner'].map((kind) => dragHandle(kind, frame)))
  const readout = span({ class: 'imp-preview__readout' })
  const updateReadout = () => {
    const rect = frame.getBoundingClientRect()
    readout.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`
  }
  new ResizeObserver(updateReadout).observe(frame)
  const setSize = (width, height) => {
    frame.style.width = width === null ? '' : `${width}px`
    frame.style.height = height === null ? '' : `${height}px`
  }
  const presetButtons = PRESETS.map((preset) =>
    button(
      {
        class: 'imp-preview__button',
        type: 'button',
        events: { click: () => setSize(preset.width, preset.height) },
      },
      preset.label,
    )
  )
  const bar = div(
    { class: 'imp-preview__stage-bar' },
    span('size'),
    presetButtons,
    button(
      {
        class: 'imp-preview__button',
        type: 'button',
        events: { click: () => setSize(null, null) },
      },
      'fit',
    ),
    readout,
  )
  return div({ class: 'imp-preview__stage-wrap' }, bar, frame)
}

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
    return { text: String(value), editable: false, note: `not editable here — ${error.message}` }
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

const stateRow = (nodes, declaration) => {
  const field = textarea({ class: 'imp-preview__field', rows: 2, spellcheck: false })
  const message = p({ class: 'imp-preview__message' }, 'looking for this state…')
  let state = null

  const setMessage = (text, isError) => {
    message.textContent = text
    message.classList.toggle('imp-preview__message--error', isError === true)
  }

  const apply = () => {
    if (!state) return
    let parsed
    try {
      parsed = JSON.parse(field.value)
    } catch (error) {
      setMessage(error.message, true)
      return
    }
    state.set(parsed)
    setMessage('', false)
  }

  const applyButton = button(
    {
      class: 'imp-preview__button',
      type: 'button',
      disabled: true,
      events: { click: apply },
    },
    'apply',
  )

  field.disabled = true
  if (declaration.initial !== null) field.value = declaration.initial

  const show = (value) => {
    const described = describeValue(value)
    if (document.activeElement !== field) field.value = described.text
    field.disabled = !described.editable
    applyButton.disabled = !described.editable
    setMessage(described.note, false)
  }

  const lookForState = (attemptsLeft) => {
    const found = findStateInTree(nodes, declaration.name)
    if (found) {
      state = found
      runInMountScope({ addCleanup: () => {} }, () => found.watch(show))
      return
    }
    if (attemptsLeft <= 0) {
      setMessage('not initialized in this scenario', false)
      return
    }
    setTimeout(() => lookForState(attemptsLeft - 1), STATE_LOOKUP_INTERVAL)
  }
  lookForState(STATE_LOOKUP_ATTEMPTS)

  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) apply()
  })

  return div(
    { class: 'imp-preview__row' },
    div(
      { class: 'imp-preview__row-head' },
      span({ class: 'imp-preview__name' }, declaration.name),
      applyButton,
    ),
    field,
    message,
  )
}

const stateEditor = (nodes, declarations) =>
  aside(
    { class: 'imp-preview__editor' },
    h3('state'),
    declarations.length
      ? [
        p(
          { class: 'imp-preview__hint' },
          'Values are JSON. Edit one and apply it (or press Ctrl+Enter) to drive the component.',
        ),
        declarations.map((declaration) => stateRow(nodes, declaration)),
      ]
      : p(
        { class: 'imp-preview__hint' },
        'No state declarations were found in the sources this preview imports.',
      ),
  )

const scenarioPanel = (name, scenario, declarations) => {
  let nodes
  try {
    nodes = asNodes(typeof scenario === 'function' ? scenario() : scenario)
  } catch (error) {
    nodes = null
    console.error(`imp preview: scenario '${name}' failed to build`, error)
  }
  return section(
    { class: 'imp-preview__scenario' },
    header(
      { class: 'imp-preview__scenario-head' },
      h2(name),
      a(
        { class: 'imp-preview__link', href: `?scenario=${encodeURIComponent(name)}` },
        'isolate',
      ),
    ),
    nodes
      ? div(
        { class: 'imp-preview__panel' },
        stageColumn(nodes),
        stateEditor(nodes, declarations),
      )
      : p({ class: 'imp-preview__failure' }, `${name} failed to build — see the terminal`),
  )
}

const scenarioOrder = (scenarios, order) => {
  const exported = Object.keys(scenarios)
  const written = order.filter((name) => exported.includes(name))
  return [...written, ...exported.filter((name) => !written.includes(name))]
}

export function startPreview(scenarios, meta, customThemes = []) {
  const styles = document.createElement('style')
  styles.textContent = CHROME_STYLES
  document.head.append(styles)
  registerThemes(customThemes)
  applyTheme(themes.get(readStoredTheme()))

  const names = scenarioOrder(scenarios, meta.order)
  const requested = new URLSearchParams(location.search).get('scenario')
  const isolated = requested !== null && names.includes(requested)
  const shown = isolated ? [requested] : names

  document.body.append(
    chromeBar(meta.file, isolated),
    ...(names.length ? shown.map((name) => scenarioPanel(name, scenarios[name], meta.states)) : [
      p(
        { class: 'imp-preview__empty' },
        `${meta.file} has no named exports — export one instance per scenario, like ` +
          `export const empty = myComponent()`,
      ),
    ]),
  )
}
