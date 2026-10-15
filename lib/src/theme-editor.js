import { component } from './component.js'
import { div, pre } from './api/html.js'
import { initState } from './state.js'
import { button } from './std/general/button.js'
import { loader } from './std/feedback/loader.js'
import { notice } from './std/feedback/notice.js'
import { text } from './std/general/text.js'
import { codeEditor } from './std/inputs/code-editor.js'
import { colorPicker } from './std/inputs/color-picker.js'
import { comboBox } from './std/inputs/combo-box.js'
import { segmented } from './std/inputs/segmented.js'
import { flex } from './std/layout/flex.js'
import { stack } from './std/layout/stack.js'
import { tabs } from './std/layout/tabs.js'
import { copyButton } from './std/shared/copy-button.js'
import { token } from './std/shared/css.js'
import {
  applyDraft,
  clearDraft,
  isFontStack,
  knobsOf,
  parseTokens,
  readDraft,
  sameTokens,
  seedDraft,
  setBaseColor,
  setFont,
  setHeadingColor,
  setLoader,
  setRadius,
  setShadow,
  setShadowColor,
  setTokens,
  themeFileSource,
  tokensJson,
} from './theme-draft.js'
import {
  isHexColor,
  loaderShapes,
  radiusSteps,
  shadowSteps,
  TEXT_CONTRAST_MINIMUM,
} from './theme-colors.js'
import { contrastProblems } from './theme-contrast.js'

export { appliedThemeName } from './theme-draft.js'

const NAME = 'imp-theme-editor'

const STATE_PREFIX = 'imp.themeEditor'

const KNOBS_TAB = 'knobs'

const TOKENS_TAB = 'tokens'

const styles = () => `
  :host {
    display: block;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
    min-inline-size: 0;
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

const SAMPLE_NAME = 'imp-theme-loader-sample'

const sampleStyles = () => `
  :host {
    display: grid;
    place-items: center;
    flex: none;
    box-sizing: border-box;
    inline-size: calc(1lh + 2 * ${token('space-2')} + 2 * ${token('border-width')});
    block-size: calc(1lh + 2 * ${token('space-2')} + 2 * ${token('border-width')});
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-tight')};
    color: ${token('color-primary')};
  }
`

let createSample = null

const loaderSample = () => {
  createSample ??= component(SAMPLE_NAME, {
    styles: sampleStyles(),
    setup: () => loader({ label: 'The loader of the theme', size: 'sm' }),
  })
  return createSample()
}

const download = (fileName, content) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/javascript' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const FONT_STACKS = [
  {
    value: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    label: 'System UI',
  },
  {
    value: `'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    label: 'IBM Plex Sans',
  },
  { value: `'Sora', system-ui, sans-serif`, label: 'Sora' },
  { value: `'Inter', system-ui, sans-serif`, label: 'Inter' },
  { value: `Georgia, 'Times New Roman', Times, serif`, label: 'Georgia' },
]

const MONO_FONT_STACKS = [
  {
    value: `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
    label: 'System mono',
  },
  {
    value: `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
    label: 'IBM Plex Mono',
  },
  { value: `'JetBrains Mono', ui-monospace, monospace`, label: 'JetBrains Mono' },
  { value: `'Fira Code', ui-monospace, monospace`, label: 'Fira Code' },
  { value: `'Courier New', Courier, monospace`, label: 'Courier New' },
]

const colorField = (self, key, labelText, value, onChange) => {
  const hex = initState(self, `${STATE_PREFIX}.${key}`, value)
  hex.watch(self, (next) => {
    if (isHexColor(next)) onChange(next)
  })
  const node = colorPicker({ label: labelText, value: hex })
  node.show = (next) => hex.set(next)
  return node
}

const fontField = (self, key, labelText, options, value, onChange) => {
  const fontStack = initState(self, `${STATE_PREFIX}.${key}`, value)
  fontStack.watch(self, (next) => {
    if (isFontStack(next)) onChange(next.trim())
  })
  const node = comboBox({ label: labelText, value: fontStack, options, custom: true })
  node.show = (next) => fontStack.set(next)
  return node
}

const choiceField = (self, key, labelText, choices, value, onChange) => {
  const choice = initState(self, `${STATE_PREFIX}.${key}`, value)
  choice.watch(self, onChange)
  const node = segmented({ label: labelText, value: choice, options: choices })
  node.show = (next) => choice.set(next)
  return node
}

const loaderField = (self, value, onChange) => {
  const choice = choiceField(self, 'loader', 'Loader', loaderShapes(), value, onChange)
  const node = flex({ gap: 2, verticalAlign: 'bottom' }, choice, loaderSample())
  node.show = (next) => choice.show(next)
  return node
}

const TOKENS_PROBLEM = 'Enter a JSON object that maps token names to CSS values'

const lineCount = (text) => text.split('\n').length

const TOKENS_HELP = 'Every token of the theme, as JSON. An edit applies as soon as the JSON parses.'

const KNOBS_HELP = `${TOKENS_HELP} A knob rewrites the tokens it drives.`

const tokensField = (self, tokens, help, onChange) => {
  const json = tokensJson(tokens)
  const source = initState(self, `${STATE_PREFIX}.tokens`, json)
  const rows = initState(self, `${STATE_PREFIX}.rows`, lineCount(json))
  source.watch(self, (next) => {
    rows.set(lineCount(next))
    const parsed = parseTokens(next)
    if (parsed !== null) onChange(parsed)
  })
  const node = codeEditor({
    label: 'Tokens',
    language: 'json',
    rows,
    value: source,
    validate: (next) => (parseTokens(next) === null ? TOKENS_PROBLEM : null),
    help,
  })
  node.show = (next) => source.set(tokensJson(next))
  return node
}

const USAGE_EXAMPLE = `import { init } from 'imp'
import theme from './theme.js'

await init({ theme })`

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

const CONTRAST_PASSES = `Every text colour has a contrast of ${TEXT_CONTRAST_MINIMUM}:1 or more on its background, the WCAG AA level.`

const CONTRAST_FAILS = `Some text is below the WCAG AA contrast of ${TEXT_CONTRAST_MINIMUM}:1, or imp cannot check it`

const contrastReport = (problems) =>
  problems.view((list) =>
    list.length
      ? notice(
          { kind: 'warning', title: CONTRAST_FAILS },
          div(
            { class: 'contrast' },
            ...list.map(({ text: textToken, background, ratio, reason }) =>
              text({ size: 'sm' }, `${textToken} on ${background}: ${reason ?? `${ratio}:1`}`),
            ),
          ),
        )
      : text({ tone: 'secondary', size: 'sm' }, CONTRAST_PASSES),
  )

const knobFields = (self, draft, knob) => {
  const knobs = knobsOf(draft)
  return {
    primary: colorField(
      self,
      'primary',
      'Primary',
      knobs.primary,
      knob('primary', (value) => setBaseColor(draft, 'primary', value)),
    ),
    secondary: colorField(
      self,
      'secondary',
      'Secondary',
      knobs.secondary,
      knob('secondary', (value) => setBaseColor(draft, 'secondary', value)),
    ),
    heading: colorField(
      self,
      'heading',
      'Heading colour',
      knobs.heading,
      knob('heading', (value) => setHeadingColor(draft, value)),
    ),
    font: fontField(
      self,
      'font',
      'Font',
      FONT_STACKS,
      knobs.font,
      knob('font', (value) => setFont(draft, 'font-family', value)),
    ),
    fontMono: fontField(
      self,
      'fontMono',
      'Mono font',
      MONO_FONT_STACKS,
      knobs.fontMono,
      knob('fontMono', (value) => setFont(draft, 'font-family-mono', value)),
    ),
    radius: choiceField(
      self,
      'radius',
      'Border radius',
      radiusSteps(),
      knobs.radius,
      knob('radius', (value) => setRadius(draft, value)),
    ),
    shadow: choiceField(
      self,
      'shadow',
      'Shadow',
      shadowSteps(),
      knobs.shadow,
      knob('shadow', (value) => setShadow(draft, value)),
    ),
    shadowColor: colorField(
      self,
      'shadowColor',
      'Shadow colour',
      knobs.shadowColor,
      knob('shadowColor', (value) => setShadowColor(draft, value)),
    ),
    loader: loaderField(
      self,
      knobs.loader,
      knob('loader', (value) => setLoader(draft, value)),
    ),
  }
}

const knobsPanel = (fields) =>
  stack(
    { gap: 3 },
    text(
      { tone: 'secondary', size: 'sm' },
      'Pick the two base colours. imp derives the text, the surfaces and the border from the '
        + 'secondary colour, and a readable text colour on the primary. The heading colour '
        + 'follows the text colour until you set it.',
    ),
    fields.primary,
    fields.secondary,
    fields.heading,
    fields.font,
    fields.fontMono,
    fields.radius,
    fields.shadow,
    fields.shadowColor,
    fields.loader,
  )

const definition = {
  setup: (self, { theme: themeName, tokensOnly = false }) => {
    const draft = readDraft(themeName) ?? seedDraft()
    const contrast = initState(self, `${STATE_PREFIX}.contrast`, contrastProblems(draft.tokens))
    let fields = {}

    const showKnobs = () => {
      const current = knobsOf(draft)
      for (const [key, field] of Object.entries(fields)) field.show(current[key])
    }

    const apply = ({ fromTokens = false } = {}) => {
      applyDraft(themeName, draft)
      contrast.set(contrastProblems(draft.tokens))
      if (fromTokens) return
      tokens.show(draft.tokens)
      showKnobs()
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

    const tokens = tokensField(
      self,
      draft.tokens,
      tokensOnly ? TOKENS_HELP : KNOBS_HELP,
      (next) => {
        if (sameTokens(next, draft.tokens)) return
        setTokens(draft, next)
        showKnobs()
        apply({ fromTokens: true })
      },
    )

    const views = () => {
      if (tokensOnly) return tokens
      fields = knobFields(self, draft, knob)
      return tabs({
        label: 'Theme editor views',
        items: [
          { id: KNOBS_TAB, label: 'Knobs', content: knobsPanel(fields) },
          { id: TOKENS_TAB, label: 'Tokens', content: tokens },
        ],
      })
    }

    return div(
      { class: 'editor' },
      views(),
      contrastReport(contrast),
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

export const themeEditor = (props) => {
  createEditor ??= component(NAME, { ...definition, styles: styles() })
  return createEditor(props)
}
