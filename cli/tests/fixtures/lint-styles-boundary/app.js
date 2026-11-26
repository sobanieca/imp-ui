import { component } from 'imp'
import { div, section, span } from 'imp/html'
import { button, text } from 'imp/std'
import { card } from 'imp/std/display'
import { stack } from 'imp/std/layout'

export const page = component('demo-page', {
  styles: `
    :host { display: block; }
    .choices { display: grid; gap: 0.5rem; }
    .note, .hint { color: var(--imp-color-secondary); }
    .page { padding: 1.5rem; background: url(./backdrop.svg); }
  `,
  setup: () =>
    div(
      { class: 'page' },
      stack(
        { gap: 3 },
        div({ class: 'choices' }, card(text('One')), card(text('Two'))),
        section(span({ class: ['note', 'plain'] }, 'nested')),
        card({ header: div({ class: { hint: true } }, 'Header') }, 'Body'),
        false && div({ class: 'choices' }),
      ),
      div({ class: 'choices' }, button('Fine: the div is in the tree of the component')),
      stack(div({ class: 'unknown' }, 'Fine: no rule of the styles names it')),
    ),
})

export const plain = component('demo-plain', {
  setup: () => stack(div({ class: 'choices' }, 'Fine: the component has no styles')),
})
