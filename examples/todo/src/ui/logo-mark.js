import { component } from 'imp'
import { span } from 'imp/html'
import { luCheckCheck } from 'imp/icons'
import { icon } from 'imp/std'

export const logoMark = component('todo-logo-mark', {
  styles: `
    .mark {
      display: grid;
      place-items: center;
      inline-size: 2.25rem;
      block-size: 2.25rem;
      border-radius: var(--imp-radius-item);
      color: #ffffff;
      background: linear-gradient(135deg, var(--imp-color-primary), var(--imp-color-pink));
      box-shadow: 0 8px 20px -8px var(--imp-color-primary);
    }
    .mark.large { inline-size: 3.5rem; block-size: 3.5rem; border-radius: var(--imp-radius-container); }
  `,
  setup: (_self, { large = false } = {}) =>
    span({ class: ['mark', large && 'large'] }, icon(luCheckCheck, { size: large ? 'lg' : 'md' })),
})
