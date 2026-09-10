import { component } from 'imp'
import { div, input, pre } from 'imp/html'
import { applyTheme, colorSchemeOf } from 'imp/theme'
import { initState } from 'imp/state'
import { button, text } from 'imp/std'
import { select, textField } from 'imp/std/inputs'
import { flex, stack } from 'imp/std/layout'
import { copyButton } from './preview-copy.js'
import { keptTokens, themeFileSource, themeFromDraft } from './preview-theme-source.js'
import { defaultTokens, THEME_DEFAULTS } from '../../lib/src/theme.js'
import {
  isHexColor,
  radiusLevelOf,
  radiusSteps,
  shadowLevelOf,
  shadowSteps,
} from '../../lib/src/theme-colors.js'

const TOKEN_PREFIX = '--imp-'

const DRAFT_STORAGE_PREFIX = 'imp.preview.theme-draft.'

const MODES = ['light', 'dark']

const DARK_DEFAULTS = { primary: '#7c9cff', secondary: '#94a3b8' }

const EDITOR_STYLES = `
  :host {
    display: block;
  }

  .swatch {
    flex: none;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    margin-block-end: 1px;
    padding: 0;
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-item, 6px);
    background: var(--imp-color-surface, #ffffff);
  }

  .swatch:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 1px;
  }

  .usage {
    padding: var(--imp-space-2, 8px);
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-item, 6px);
    background: var(--imp-color-surface-sunken, #f1f5f9);
  }

  .usage pre {
    margin: 0;
    overflow-x: auto;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
  }
`

const STATE_PREFIX = 'imp.preview.theme-editor'

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

const baseFont = (name) => {
  const value = baseTokens[name]
  return typeof value === 'string' && value !== '' ? value : defaultTokens()[name]
}

const seedDraft = () => {
  const scheme = colorSchemeOf(baseTokens) ?? 'light'
  const defaults = scheme === 'dark' ? DARK_DEFAULTS : LIGHT_DEFAULTS
  const fromTheme = baseColors(baseTokens, defaults)
  return {
    mode: scheme,
    font: baseFont('font-family'),
    fontMono: baseFont('font-family-mono'),
    radius: radiusLevelOf(baseTokens),
    shadow: shadowLevelOf(baseTokens, scheme),
    light: scheme === 'light' ? fromTheme : { ...LIGHT_DEFAULTS },
    dark: scheme === 'dark' ? fromTheme : { ...DARK_DEFAULTS },
    kept: keptTokens(baseTokens),
  }
}

const isFontStack = (value) => typeof value === 'string' && value.trim() !== ''

const validDraft = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  isFontStack(value.font) && isFontStack(value.fontMono) &&
  MODES.every((mode) => isHexColor(value[mode]?.primary) && isHexColor(value[mode]?.secondary))

const readDraft = (themeName) => {
  try {
    const stored = JSON.parse(localStorage.getItem(draftKey(themeName)) ?? 'null')
    return validDraft(stored) ? { kept: keptTokens(baseTokens), ...stored } : null
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

const colorField = (self, key, labelText, value, onChange) => {
  const hex = initState(self, `${STATE_PREFIX}.${key}`, value)
  const swatch = input({
    class: 'swatch',
    type: 'color',
    value,
    'aria-label': `${labelText} colour picker`,
  })
  hex.watch(self, (next) => {
    if (!isHexColor(next)) return
    swatch.value = next
    onChange(next)
  })
  swatch.addEventListener('input', () => hex.set(swatch.value))
  const node = flex(
    { gap: 2, verticalAlign: 'bottom' },
    textField({ label: labelText, value: hex, autocomplete: 'off' }),
    swatch,
  )
  node.show = (next) => hex.set(next)
  return node
}

const fontField = (self, key, labelText, value, onChange) => {
  const stack_ = initState(self, `${STATE_PREFIX}.${key}`, value)
  stack_.watch(self, (next) => {
    if (isFontStack(next)) onChange(next.trim())
  })
  return textField({ label: labelText, value: stack_, autocomplete: 'off' })
}

const choiceField = (self, key, labelText, choices, value, onChange) => {
  const choice = initState(self, `${STATE_PREFIX}.${key}`, value)
  choice.watch(self, onChange)
  return select({ label: labelText, value: choice, options: choices })
}

const USAGE_EXAMPLE = `import { init } from 'imp'
import light, { dark } from './theme.js'

await init({ theme: light })

// later, from a theme switcher:
applyTheme(dark)`

const usage = () =>
  div(
    { class: 'usage' },
    stack(
      { gap: 1 },
      text({ size: 'sm' }, 'Save the copied file as theme.js in your app and pass it to init():'),
      pre(USAGE_EXAMPLE),
      text(
        { size: 'sm' },
        'A web font named in Font or Mono font loads only when index.html links it, at the weights of font-weight-normal and font-weight-bold.',
      ),
    ),
  )

const definition = {
  styles: EDITOR_STYLES,
  setup: (self, themeName) => {
    const draft = readDraft(themeName) ?? seedDraft()

    const apply = () => {
      writeDraft(themeName, draft)
      applyTheme(themeFromDraft(themeName, draft, draft.mode))
    }

    const reset = () => {
      clearDraft(themeName)
      globalThis.location.reload()
    }

    const setColor = (key) => (value) => {
      if (draft[draft.mode][key] === value) return
      draft[draft.mode][key] = value
      apply()
    }

    const primary = colorField(
      self,
      'primary',
      'Primary',
      draft[draft.mode].primary,
      setColor('primary'),
    )
    const secondary = colorField(
      self,
      'secondary',
      'Secondary',
      draft[draft.mode].secondary,
      setColor('secondary'),
    )

    const root = stack(
      { gap: 3 },
      text(
        { tone: 'secondary', size: 'sm' },
        'Pick the base colours and imp derives the rest of the palette - hover and active steps, ' +
          'surfaces, borders and text - for the mode you are editing.',
      ),
      choiceField(self, 'mode', 'Mode', MODES, draft.mode, (value) => {
        if (value === draft.mode) return
        draft.mode = value
        primary.show(draft[draft.mode].primary)
        secondary.show(draft[draft.mode].secondary)
        apply()
      }),
      primary,
      secondary,
      fontField(self, 'font', 'Font', draft.font, (value) => {
        if (value === draft.font) return
        draft.font = value
        apply()
      }),
      fontField(self, 'font-mono', 'Mono font', draft.fontMono, (value) => {
        if (value === draft.fontMono) return
        draft.fontMono = value
        apply()
      }),
      choiceField(self, 'radius', 'Border radius', radiusSteps(), draft.radius, (value) => {
        if (value === draft.radius) return
        draft.radius = value
        apply()
      }),
      choiceField(self, 'shadow', 'Shadow', shadowSteps(), draft.shadow, (value) => {
        if (value === draft.shadow) return
        draft.shadow = value
        apply()
      }),
      usage(),
      flex(
        { gap: 2, wrap: true },
        copyButton(self, 'theme', () => themeFileSource(themeName, draft)),
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

export const themeEditor = (themeName) => {
  createEditor ??= component('imp-preview-theme', definition)
  return createEditor(themeName)
}
