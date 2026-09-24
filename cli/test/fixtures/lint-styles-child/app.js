import { component } from 'imp'
import { div, p } from 'imp/html'
import { card, stack } from 'imp/std'

const styles = () => `
  .frame { display: grid; gap: 8px }
  .usage { padding: 8px; border: 1px solid var(--imp-color-border, #cbd5e1) }
  .hint { color: var(--imp-color-secondary, #64748b) }
`

export const editor = component('demo-editor', {
  styles: styles(),
  setup: () => {
    const hint = p({ class: 'hint' }, 'Pick two colours')
    return div(
      { class: 'frame' },
      stack({ gap: 2 }, div({ class: 'usage' }, 'Save the file as theme.js'), hint),
      card({ padding: 'sm' }, div({ class: ['usage', 'wide'] }, 'Also out of reach')),
    )
  },
})
