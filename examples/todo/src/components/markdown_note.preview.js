import { form, textArea } from 'imp/std/inputs'
import { flex } from 'imp/std/layout'
import { markdownNote } from './markdown_note.js'

const rich = `# Release notes

Ship **micromark** behind \`imp install\`, then:

1. write the note
2. watch it render
3. [read the docs](https://github.com/sobanieca/imp-ui)

> Raw HTML like <script>alert(1)</script> is escaped, never executed.

\`\`\`js
markdownNote({ field: 'notes' })
\`\`\`
`

export const rendered = markdownNote({ source: rich })

export const empty = markdownNote({ source: '', label: 'Preview' })

export const inline = markdownNote({
  source: 'Start with `imp skill state`, then `imp skill components`.',
})

export const live = form(
  { initialValues: { notes: '**Type here** and the panel below follows.' } },
  flex(
    { direction: 'column', gap: 3 },
    textArea({ field: 'notes', label: 'Notes', rows: 4 }),
    markdownNote({ field: 'notes', label: 'Preview' }),
  ),
)
