import { component } from './component.js'
import { div, input, pre } from './api/html.js'
import { initState } from './state.js'
import { button } from './std/general/button.js'
import { text } from './std/general/text.js'
import { codeEditor } from './std/inputs/code-editor.js'
import { select } from './std/inputs/select.js'
import { textField } from './std/inputs/text-field.js'
import { flex } from './std/layout/flex.js'
import { stack } from './std/layout/stack.js'
import { copyButton } from './std/shared/copy-button.js'
import { focusRing, token } from './std/shared/css.js'
import {
  applyDraft,
  clearDraft,
  isFontStack,
  knobsOf,
  MODES,
  parseTokens,
  readDraft,
  sameTokens,
  seedDraft,
  setBaseColor,
  setFont,
  setRadius,
  setShadow,
  setTokens,
  themeFileSource,
  tokensJson,
  tokensOf,
} from './theme-draft.js'
import { isHexColor, radiusSteps, shadowSteps } from './theme-colors.js'

export { appliedThemeName } from './theme-draft.js'

const NAME = 'imp-theme-editor'

const STATE_PREFIX = 'imp.themeEditor'

const TOKENS_ROWS = 16

const styles = () => `
  :host {
    display: block;
  }

  .swatch {
    flex: none;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    margin-block-end: 1px;
    padding: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background: ${token('color-surface')};
  }

  .swatch:focus-visible {
    ${focusRing()}
  }

  .usage {
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background: ${token('color-surface-sunken')};
  }

  .usage pre {
    margin: 0;
    overflow-x: auto;
    color: ${token('color-text')};
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
  }
`

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
  const fontStack = initState(self, `${STATE_PREFIX}.${key}`, value)
  fontStack.watch(self, (next) => {
    if (isFontStack(next)) onChange(next.trim())
  })
  const node = textField({ label: labelText, value: fontStack, autocomplete: 'off' })
  node.show = (next) => fontStack.set(next)
  return node
}

const choiceField = (self, key, labelText, choices, value, onChange) => {
  const choice = initState(self, `${STATE_PREFIX}.${key}`, value)
  choice.watch(self, onChange)
  const node = select({ label: labelText, value: choice, options: choices })
  node.show = (next) => choice.set(next)
  return node
}

const TOKENS_PROBLEM = 'Enter a JSON object that maps token names to CSS values'

const tokensField = (self, tokens, onChange) => {
  const source = initState(self, `${STATE_PREFIX}.tokens`, tokensJson(tokens))
  source.watch(self, (next) => {
    const parsed = parseTokens(next)
    if (parsed !== null) onChange(parsed)
  })
  const node = codeEditor({
    label: 'Tokens',
    language: 'json',
    rows: TOKENS_ROWS,
    value: source,
    validate: (next) => (parseTokens(next) === null ? TOKENS_PROBLEM : null),
    help:
      'Every token of the theme in the mode above. An edit applies as soon as the JSON parses. ' +
      'A knob rewrites the tokens it drives.',
  })
  node.show = (next) => source.set(tokensJson(next))
  return node
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
  setup: (self, themeName) => {
    const draft = readDraft(themeName) ?? seedDraft()
    const knobs = knobsOf(draft)
    const fields = {}

    const showKnobs = () => {
      const current = knobsOf(draft)
      for (const [key, field] of Object.entries(fields)) field.show(current[key])
    }

    const apply = ({ fromTokens = false } = {}) => {
      applyDraft(themeName, draft)
      if (!fromTokens) tokens.show(tokensOf(draft))
    }

    const reset = () => {
      clearDraft(themeName)
      globalThis.location.reload()
    }

    const knob = (key, change) => (value) => {
      if (knobsOf(draft)[key] === value) return
      change(value)
      apply()
    }

    fields.primary = colorField(
      self,
      'primary',
      'Primary',
      knobs.primary,
      knob('primary', (value) => setBaseColor(draft, 'primary', value)),
    )
    fields.secondary = colorField(
      self,
      'secondary',
      'Secondary',
      knobs.secondary,
      knob('secondary', (value) => setBaseColor(draft, 'secondary', value)),
    )
    fields.font = fontField(
      self,
      'font',
      'Font',
      knobs.font,
      knob('font', (value) => setFont(draft, 'font-family', value)),
    )
    fields.fontMono = fontField(
      self,
      'fontMono',
      'Mono font',
      knobs.fontMono,
      knob('fontMono', (value) => setFont(draft, 'font-family-mono', value)),
    )
    fields.radius = choiceField(
      self,
      'radius',
      'Border radius',
      radiusSteps(),
      knobs.radius,
      knob('radius', (value) => setRadius(draft, value)),
    )
    fields.shadow = choiceField(
      self,
      'shadow',
      'Shadow',
      shadowSteps(),
      knobs.shadow,
      knob('shadow', (value) => setShadow(draft, value)),
    )

    const tokens = tokensField(self, tokensOf(draft), (next) => {
      if (sameTokens(next, tokensOf(draft))) return
      setTokens(draft, next)
      showKnobs()
      apply({ fromTokens: true })
    })

    return stack(
      { gap: 3 },
      text(
        { tone: 'secondary', size: 'sm' },
        'Pick the base colours and imp derives the rest of the palette - hover and active steps, ' +
          'surfaces, borders and text - for the mode you are editing. Edit any token by hand in ' +
          'the JSON below.',
      ),
      choiceField(self, 'mode', 'Mode', MODES, draft.mode, (value) => {
        if (value === draft.mode) return
        draft.mode = value
        showKnobs()
        apply()
      }),
      fields.primary,
      fields.secondary,
      fields.font,
      fields.fontMono,
      fields.radius,
      fields.shadow,
      tokens,
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
  },
}

let createEditor = null

export const themeEditor = (themeName) => {
  createEditor ??= component(NAME, { ...definition, styles: styles() })
  return createEditor(themeName)
}
