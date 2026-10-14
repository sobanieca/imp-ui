import { markdown } from 'imp/std/display'
import { groups } from '../preview-groups.js'

export const name = 'Markdown'
export const group = groups.display
export const description = `
  Renders markdown text as themed prose.

  It is the reader half of **richTextEditor**. Both read the same markdown with the same rules, so a
  draft and its published form look alike.
`

const notes = `
# imp 0.2

A dev server that reloads on save, and a build that ships what you import.

## What is new

- **No build step** while you work. The browser runs your modules as written.
- A _catalog_ of components under \`imp/std\`.
- The theme is a set of \`--imp-*\` tokens. See [theming](https://imp.dev/docs/theming).

## Upgrading

1. Run \`imp update\`.
2. Move your config into \`imp.json\`.
3. Delete the old bundler config.

> The version is below 1.0, so a rename lands without a shim.

---

Reported by ~~the compiler~~ the linter.
`

const post = `
<p align="center">A quiet week</p>

The garden is the same size as last year. The list is not.

- tomatoes
  - san marzano
  - green zebra
- beans

\`\`\`sh
imp start --port 4600
\`\`\`

A hard break lives at the end of this line,\\
so the next line stays in the paragraph.
`

const short = 'A **single** paragraph with `code`, an [imp link](https://imp.dev) and nothing else.'

export const release = { scenario: 'Release notes', component: markdown({ text: notes }) }

export const article = { scenario: 'An article', component: markdown({ text: post }) }

export const oneLine = { scenario: 'One paragraph', component: markdown({ text: short }) }

export const empty = { scenario: 'No text', component: markdown() }
