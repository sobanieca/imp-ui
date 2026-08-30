import { component } from 'imp'
import { div, input, label, option, p, pre, select } from 'imp/html'
import { applyTheme } from 'imp/theme'
import { button, text } from 'imp/std'
import { copyButton } from './preview_copy.js'
import { themeFileSource, themeFromDraft } from './preview_theme_source.js'
import { THEME_DEFAULTS } from '../../lib/src/theme.js'
import {
  isHexColor,
  radiusLevelOf,
  radiusSteps,
  shadowLevelOf,
  shadowSteps,
} from '../../lib/src/theme_colors.js'

const TOKEN_PREFIX = '--imp-'

const DRAFT_STORAGE_PREFIX = 'imp.preview.theme-draft.'

const MODES = ['light', 'dark']

const DARK_DEFAULTS = { primary: '#7c9cff', secondary: '#94a3b8' }

const EDITOR_STYLES = `
  :host {
    display: block;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-3, 12px);
    font-family: var(--imp-font-family, system-ui, sans-serif);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field > label {
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .inputs {
    display: flex;
    align-items: center;
    gap: var(--imp-space-2, 8px);
  }

  .actions {
    display: flex;
    gap: var(--imp-space-2, 8px);
    flex-wrap: wrap;
  }

  input[type='text'],
  select {
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

  input:focus-visible,
  select:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 1px;
  }

  .usage {
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-1, 4px);
    padding: var(--imp-space-2, 8px);
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-md, 6px);
    background: var(--imp-color-surface-sunken, #f1f5f9);
  }

  .usage p {
    margin: 0;
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .usage pre {
    margin: 0;
    overflow-x: auto;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
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

const draftKey = (themeName) => `${DRAFT_STORAGE_PREFIX}${themeName}`

const baseColors = (tokens, fallback) => ({
  primary: isHexColor(tokens['color-primary']) ? tokens['color-primary'] : fallback.primary,
  secondary: isHexColor(tokens['color-secondary']) ? tokens['color-secondary'] : fallback.secondary,
})

const LIGHT_DEFAULTS = { primary: THEME_DEFAULTS.primary, secondary: THEME_DEFAULTS.secondary }

const seedDraft = (colorScheme) => {
  const scheme = colorScheme === 'dark' ? 'dark' : 'light'
  const defaults = scheme === 'dark' ? DARK_DEFAULTS : LIGHT_DEFAULTS
  const fromTheme = baseColors(baseTokens, defaults)
  return {
    mode: scheme,
    radius: radiusLevelOf(baseTokens),
    shadow: shadowLevelOf(baseTokens, scheme),
    light: scheme === 'light' ? fromTheme : { ...LIGHT_DEFAULTS },
    dark: scheme === 'dark' ? fromTheme : { ...DARK_DEFAULTS },
  }
}

const validDraft = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  MODES.every((mode) => isHexColor(value[mode]?.primary) && isHexColor(value[mode]?.secondary))

const readDraft = (themeName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(draftKey(themeName)) ?? 'null')
    return validDraft(stored) ? stored : null
  } catch {
    return null
  }
}

const writeDraft = (themeName, draft) => {
  try {
    localStorage.setItem(draftKey(themeName), JSON.stringify(draft))
  } catch { /* storage is unavailable - the tweak just does not survive a reload */ }
}

const clearDraft = (themeName) => {
  try {
    localStorage.removeItem(draftKey(themeName))
  } catch { /* storage is unavailable - nothing was stored to clear */ }
}

export const applyStoredDraft = (themeName) => {
  const draft = readDraft(themeName)
  if (draft) applyTheme(themeFromDraft(themeName, draft, draft.mode))
}

const download = (fileName, content) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/javascript' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const colorField = (id, labelText, value, onChange) => {
  const field = input({ id, type: 'text', value, spellcheck: 'false', autocomplete: 'off' })
  const swatch = input({ type: 'color', value, 'aria-label': `${labelText} colour picker` })
  const commit = (next) => {
    if (isHexColor(next)) onChange(next)
  }
  field.addEventListener('input', () => {
    if (isHexColor(field.value)) swatch.value = field.value
    commit(field.value)
  })
  swatch.addEventListener('input', () => {
    field.value = swatch.value
    commit(swatch.value)
  })
  const node = div(
    { class: 'field' },
    label({ for: id }, labelText),
    div({ class: 'inputs' }, field, swatch),
  )
  node.show = (next) => {
    field.value = next
    swatch.value = next
  }
  return node
}

const choiceField = (id, labelText, choices, value, onChange) => {
  const control = select(
    { id },
    ...choices.map((choice) =>
      option(choice === value ? { value: choice, selected: 'selected' } : { value: choice }, choice)
    ),
  )
  control.addEventListener('change', () => onChange(control.value))
  return div({ class: 'field' }, label({ for: id }, labelText), div({ class: 'inputs' }, control))
}

const USAGE_EXAMPLE = `import { init } from 'imp'
import light, { dark } from './theme.js'

await init({ theme: light })

// later, from a theme switcher:
applyTheme(dark)`

const usage = () =>
  div(
    { class: 'usage' },
    p('Save the copied file as theme.js in your app and pass it to init():'),
    pre(USAGE_EXAMPLE),
  )

const definition = {
  styles: EDITOR_STYLES,
  build: (_instance, themeName, colorScheme) => {
    const draft = readDraft(themeName) ?? seedDraft(colorScheme)

    const apply = () => {
      writeDraft(themeName, draft)
      applyTheme(themeFromDraft(themeName, draft, draft.mode))
    }

    const reset = () => {
      clearDraft(themeName)
      globalThis.location.reload()
    }

    const setColor = (key) => (value) => {
      draft[draft.mode][key] = value
      apply()
    }

    const primary = colorField(
      'theme-primary',
      'Primary',
      draft[draft.mode].primary,
      setColor('primary'),
    )
    const secondary = colorField(
      'theme-secondary',
      'Secondary',
      draft[draft.mode].secondary,
      setColor('secondary'),
    )

    const root = div(
      { class: 'editor' },
      text(
        { tone: 'secondary', size: 'sm' },
        'Pick the base colours and imp derives the rest of the palette - hover and active steps, ' +
          'surfaces, borders and text - for the mode you are editing.',
      ),
      choiceField('theme-mode', 'Mode', MODES, draft.mode, (value) => {
        draft.mode = value
        primary.show(draft[draft.mode].primary)
        secondary.show(draft[draft.mode].secondary)
        apply()
      }),
      primary,
      secondary,
      choiceField('theme-radius', 'Border radius', radiusSteps(), draft.radius, (value) => {
        draft.radius = value
        apply()
      }),
      choiceField('theme-shadow', 'Shadow', shadowSteps(), draft.shadow, (value) => {
        draft.shadow = value
        apply()
      }),
      usage(),
      div(
        { class: 'actions' },
        copyButton(() => themeFileSource(themeName, draft)),
        button(
          {
            size: 'sm',
            events: { click: () => download('theme.js', themeFileSource(themeName, draft)) },
          },
          'download theme.js',
        ),
        button({ size: 'sm', variant: 'ghost', events: { click: reset } }, 'reset'),
      ),
    )
    return root
  },
}

let createEditor = null

export const themeEditor = (themeName, colorScheme) => {
  createEditor ??= component('imp-preview-theme', definition)
  return createEditor(themeName, colorScheme)
}
