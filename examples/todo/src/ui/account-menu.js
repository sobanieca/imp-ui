import { component } from 'imp'
import { div, span } from 'imp/html'
import { luLogOut } from 'imp/icons'
import { computed, useState } from 'imp/state'
import { button, icon } from 'imp/std'
import { avatar } from 'imp/std/display'
import { langSelect, themeSelect, userCard } from 'imp/std/shell'
import { tr, translated } from '../translate.js'

export const accountMenu = component('todo-account-menu', {
  styles: `
    .anchor { display: inline-flex; anchor-name: --todo-account; }
    .panel {
      position: fixed;
      position-anchor: --todo-account;
      position-area: block-end span-inline-start;
      position-try-fallbacks: flip-block, flip-inline;
      box-sizing: border-box;
      inset: auto;
      margin: var(--imp-space-2) 0 0;
      inline-size: min(20rem, calc(100dvi - 2rem));
      padding: var(--imp-space-4);
      color: var(--imp-color-text);
      background: color-mix(in oklab, var(--imp-color-surface) 88%, transparent);
      backdrop-filter: blur(20px) saturate(1.4);
      border: var(--imp-border-width) solid var(--imp-color-border);
      border-radius: var(--imp-radius-container);
      box-shadow: var(--imp-shadow-lg);
      opacity: 1;
      transition: opacity var(--imp-duration-fast) ease-out, translate var(--imp-duration-fast) ease-out;
    }
    .panel:not(:popover-open) { display: none; }
    @starting-style {
      .panel:popover-open { opacity: 0; translate: 0 -0.25rem; }
    }
    .sections { display: flex; flex-direction: column; gap: var(--imp-space-3); }
    .rule { block-size: var(--imp-border-width); background: var(--imp-color-border); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--imp-space-3); }
    .name { font: var(--imp-font-size-sm) / 1.3 var(--imp-font-family); color: var(--imp-color-secondary); }
    @media (max-width: 47.99rem) {
      .anchor { display: none; }
      .panel,
      .panel:not(:popover-open) {
        display: block;
        position: static;
        inline-size: auto;
        margin: 0;
        padding: 0;
        background: none;
        backdrop-filter: none;
        border: none;
        box-shadow: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel { transition: none; }
    }
    @media (forced-colors: active) {
      .panel { background: Canvas; border-color: CanvasText; }
    }
  `,
  setup: (self, { languages, themes, onSignOut }) => {
    const session = useState(self, 'todo.session')
    const name = computed([session], (user) => user?.name ?? '')
    const panel = div(
      { class: 'panel', popover: 'auto', role: 'group', 'aria-label': translated('account.title') },
      div(
        { class: 'sections' },
        userCard({ name, description: computed([session], (user) => user?.email ?? '') }),
        div({ class: 'rule' }),
        div(
          { class: 'row' },
          span({ class: 'name' }, tr('account.language')),
          langSelect({ languages }),
        ),
        div(
          { class: 'row' },
          span({ class: 'name' }, tr('account.theme')),
          themeSelect({ themes }),
        ),
        div({ class: 'rule' }),
        button(
          { variant: 'ghost', block: true, events: { click: onSignOut } },
          icon(luLogOut, { size: 'sm' }),
          tr('app.signOut'),
        ),
      ),
    )
    return div(
      span(
        { class: 'anchor' },
        button(
          {
            variant: 'ghost',
            square: true,
            label: translated('account.open'),
            popoverTarget: panel,
          },
          avatar({ name, size: 'sm', decorative: true }),
        ),
      ),
      panel,
    )
  },
})
