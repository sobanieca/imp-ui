import { component } from 'imp'
import { details, div, input, label, span, summary } from 'imp/html'
import { applyTheme } from 'imp/theme'
import { button, text } from 'imp/std'
import { copyButton } from './preview_copy.js'

const TOKEN_PREFIX = '--imp-'

const EDITS_STORAGE_PREFIX = 'imp.preview.tokens.'

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i

const GROUPS = [
  { title: 'Colors', open: true, holds: (name) => name.startsWith('color-') },
  { title: 'Radius', open: true, holds: (name) => name.startsWith('radius-') },
  { title: 'Shadow', open: true, holds: (name) => name.startsWith('shadow-') },
  { title: 'Spacing', open: false, holds: (name) => name.startsWith('space-') },
  {
    title: 'Typography',
    open: false,
    holds: (name) => name.startsWith('font-') || name.startsWith('line-height-'),
  },
  {
    title: 'Sizes',
    open: false,
    holds: (name) => name.startsWith('content-') || name.startsWith('sidebar-'),
  },
  {
    title: 'Borders',
    open: false,
    holds: (name) => name === 'border-width' || name === 'focus-ring-width',
  },
  { title: 'Motion', open: false, holds: (name) => name.startsWith('duration-') },
]

const EDITOR_STYLES = `
  :host {
    display: block;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-2, 8px);
    font-family: var(--imp-font-family, system-ui, sans-serif);
  }

  .actions {
    display: flex;
    gap: var(--imp-space-2, 8px);
    flex-wrap: wrap;
  }

  details {
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-md, 6px);
    background: var(--imp-color-surface, #ffffff);
  }

  summary {
    padding: var(--imp-space-2, 8px);
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-sm, 0.875rem);
    font-weight: var(--imp-font-weight-medium, 500);
    cursor: pointer;
    border-radius: var(--imp-radius-md, 6px);
  }

  summary:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: -2px;
  }

  .tokens {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-2, 8px);
    padding: var(--imp-space-2, 8px);
    border-block-start: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  }

  .token {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .token label {
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
    overflow-wrap: anywhere;
  }

  .fields {
    display: flex;
    align-items: center;
    gap: var(--imp-space-2, 8px);
  }

  input[type='text'] {
    flex: 1;
    min-inline-size: 0;
    box-sizing: border-box;
    padding: var(--imp-space-1, 4px) var(--imp-space-2, 8px);
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-sm, 4px);
    background: var(--imp-color-surface, #ffffff);
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  input[type='color'] {
    flex: none;
    inline-size: 2.25rem;
    block-size: 2rem;
    padding: 0;
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-sm, 4px);
    background: var(--imp-color-surface, #ffffff);
  }

  input:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 1px;
  }

  .changed input[type='text'] {
    border-color: var(--imp-color-primary, #2563eb);
  }
`

let baseTokens = {}

const readAppliedTokens = () => {
  const { style } = document.documentElement
  const tokens = {}
  for (const property of style) {
    if (property.startsWith(TOKEN_PREFIX)) {
      tokens[property.slice(TOKEN_PREFIX.length)] = style.getPropertyValue(property).trim()
    }
  }
  return tokens
}

export const snapshotBaseTokens = () => {
  baseTokens = readAppliedTokens()
  return baseTokens
}

const editsKey = (themeName) => `${EDITS_STORAGE_PREFIX}${themeName}`

export const readEdits = (themeName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(editsKey(themeName)) ?? '{}')
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  } catch {
    return {}
  }
}

const writeEdits = (themeName, edits) => {
  try {
    if (Object.keys(edits).length === 0) localStorage.removeItem(editsKey(themeName))
    else localStorage.setItem(editsKey(themeName), JSON.stringify(edits))
  } catch { /* storage is unavailable - the tweak just does not survive a reload */ }
}

export const applyEdits = (themeName, colorScheme, edits) => {
  if (Object.keys(edits).length === 0) return
  applyTheme({ name: `${themeName} (edited)`, colorScheme, tokens: edits })
}

const themeModuleSource = (themeName, colorScheme, tokens) => {
  const entries = Object.entries(tokens)
    .map(([name, value]) => `    '${name}': '${value.replaceAll("'", "\\'")}',`)
    .join('\n')
  return `export default {
  name: '${themeName}',
  colorScheme: '${colorScheme ?? 'light'}',
  tokens: {
${entries}
  },
}
`
}

const groupsOf = (tokens) => {
  const names = Object.keys(tokens)
  const grouped = GROUPS
    .map(({ title, open, holds }) => ({ title, open, names: names.filter(holds) }))
    .filter(({ names: found }) => found.length > 0)
  const claimed = new Set(grouped.flatMap(({ names: found }) => found))
  const rest = names.filter((name) => !claimed.has(name))
  return rest.length === 0 ? grouped : [...grouped, { title: 'Other', open: false, names: rest }]
}

const tokenRow = (name, value, isEdited, onChange) => {
  const fieldId = `token-${name}`
  const field = input({
    id: fieldId,
    type: 'text',
    value,
    spellcheck: 'false',
    autocomplete: 'off',
  })
  const row = div(
    { class: ['token', isEdited ? 'changed' : null] },
    label({ for: fieldId }, name),
    div({ class: 'fields' }, field),
  )
  const swatch = HEX_COLOR.test(value)
    ? input({ type: 'color', value, 'aria-label': `${name} colour picker` })
    : null
  if (swatch) {
    row.querySelector('.fields').append(swatch)
    swatch.addEventListener('input', () => {
      field.value = swatch.value
      row.classList.add('changed')
      onChange(name, swatch.value)
    })
  }
  field.addEventListener('input', () => {
    row.classList.add('changed')
    if (swatch && HEX_COLOR.test(field.value)) swatch.value = field.value
    onChange(name, field.value)
  })
  return row
}

const definition = {
  styles: EDITOR_STYLES,
  onMount: (_instance, themeName, colorScheme) => {
    const edits = { ...readEdits(themeName) }
    const current = { ...baseTokens, ...edits }

    const onChange = (name, value) => {
      if (value === baseTokens[name]) delete edits[name]
      else edits[name] = value
      current[name] = value
      writeEdits(themeName, edits)
      applyTheme({ name: `${themeName} (edited)`, colorScheme, tokens: { [name]: value } })
    }

    const reset = () => {
      writeEdits(themeName, {})
      globalThis.location.reload()
    }

    return div(
      { class: 'editor' },
      text(
        { tone: 'secondary', size: 'sm' },
        'Every value is a CSS value and applies to this page as you type. Edits are kept per theme.',
      ),
      div(
        { class: 'actions' },
        button({ size: 'sm', variant: 'ghost', events: { click: reset } }, 'reset'),
        copyButton(themeModuleSource(`${themeName}-edited`, colorScheme, current)),
      ),
      ...groupsOf(current).map(({ title, open, names }) =>
        details(
          open ? { open: 'open' } : {},
          summary(span(title)),
          div(
            { class: 'tokens' },
            ...names.map((name) =>
              tokenRow(name, current[name], Object.hasOwn(edits, name), onChange)
            ),
          ),
        )
      ),
    )
  },
}

let createEditor = null

export const themeEditor = (themeName, colorScheme) => {
  createEditor ??= component('imp-preview-theme', definition)
  return createEditor(themeName, colorScheme)
}
