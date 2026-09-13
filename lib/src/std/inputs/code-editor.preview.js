import { codeBlock } from 'imp/std/display'
import { codeEditor, form } from 'imp/std/inputs'
import { stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { component } from 'imp'
import { groups } from '../preview-groups.js'

export const name = 'Code editor'
export const group = groups.inputs

const config = `{
  "name": "acme",
  "port": 4516,
  "open": true,
  "publicExports": ["main.js", "api/http.js"]
}
`

const script = `import { component } from 'imp'
import { button, div, span } from 'imp/html'
import { initState } from 'imp/state'

export const counter = component('demo-counter', {
  setup: (self, { start = 0 } = {}) => {
    const count = initState(self, 'demo.count', start)
    return div(
      button({ events: { click: () => count.set((n) => n - 1) } }, '-'),
      span(count.text()),
      button({ events: { click: () => count.set((n) => n + 1) } }, '+'),
    )
  },
})
`

const parseProblem = (text) => {
  try {
    JSON.parse(text)
    return null
  } catch {
    return 'Enter valid JSON'
  }
}

export const json = {
  scenario: 'JSON in a form',
  component: form(
    { initialValues: { config } },
    codeEditor({
      field: 'config',
      label: 'imp.json',
      language: 'json',
      rows: 8,
      validate: parseProblem,
      help: 'Tab indents. Escape, then Tab, leaves the editor.',
    }),
  ),
}

export const javascript = {
  scenario: 'JavaScript',
  component: form(
    { initialValues: { script } },
    codeEditor({ field: 'script', label: 'counter.js', language: 'js', rows: 14 }),
  ),
}

const mirrored = component('preview-code-editor-live', {
  setup: (self) => {
    const source = initState(self, 'preview.codeEditor.source', script)
    return stack(
      { gap: 3 },
      codeEditor({ value: source, label: 'Edit', language: 'js', rows: 8 }),
      codeBlock({ code: source, language: 'js', label: 'Result' }),
    )
  },
})

export const live = {
  scenario: 'Bound to a state, shown in a codeBlock',
  component: mirrored(),
}

export const readOnly = {
  scenario: 'Read only',
  component: form(
    { initialValues: { config } },
    codeEditor({ field: 'config', label: 'imp.json', language: 'json', rows: 6, readonly: true }),
  ),
}

export const empty = {
  scenario: 'Empty, with a placeholder',
  component: form(
    { initialValues: { notes: '' } },
    codeEditor({
      field: 'notes',
      label: 'Snippet',
      language: 'css',
      rows: 5,
      placeholder: '.card { padding: 1rem }',
    }),
  ),
}
