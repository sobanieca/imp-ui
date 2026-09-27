import { component } from 'imp'
import { div, span } from 'imp/html'
import { icon } from 'imp/std'

export const statTile = component('todo-stat-tile', {
  styles: `
    :host { display: block; container-type: inline-size; }
    .tile {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--imp-space-4);
      padding: var(--imp-space-4) var(--imp-space-5);
      overflow: hidden;
      background: var(--imp-color-surface);
      border: var(--imp-border-width) solid var(--imp-color-border);
      border-radius: var(--imp-radius-container);
      box-shadow: var(--imp-shadow-sm);
      transition: transform var(--imp-duration-medium) ease, box-shadow var(--imp-duration-medium) ease;
    }
    .tile::after {
      content: '';
      position: absolute;
      inset-block-start: -40%;
      inset-inline-end: -20%;
      inline-size: 10rem;
      block-size: 10rem;
      border-radius: 50%;
      background: radial-gradient(closest-side, color-mix(in oklab, var(--tone) 22%, transparent), transparent);
      pointer-events: none;
    }
    .tile:hover { transform: translateY(-2px); box-shadow: var(--imp-shadow-md); }
    .badge {
      display: grid;
      place-items: center;
      flex: none;
      inline-size: 2.75rem;
      block-size: 2.75rem;
      border-radius: var(--imp-radius-item);
      color: #ffffff;
      background: linear-gradient(135deg, color-mix(in oklab, var(--tone), #ffffff 28%), var(--tone));
      box-shadow: 0 10px 24px -10px var(--tone);
    }
    .words { display: flex; flex-direction: column; gap: 0.125rem; }
    .value {
      font: 700 1.75rem / 1.1 var(--imp-font-family-heading);
      letter-spacing: -0.02em;
      color: var(--imp-color-text);
      font-variant-numeric: tabular-nums;
    }
    .label { font: var(--imp-font-size-sm) / 1.3 var(--imp-font-family); color: var(--imp-color-secondary); }
    @container (inline-size < 12rem) {
      .tile {
        flex-direction: column;
        align-items: start;
        gap: var(--imp-space-2);
        padding: var(--imp-space-3);
      }
      .badge { inline-size: 2.25rem; block-size: 2.25rem; }
      .value { font-size: 1.5rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .tile { transition: none; }
      .tile:hover { transform: none; }
    }
  `,
  setup: (_self, { glyph, tone, value, label }) =>
    div(
      { class: 'tile', style: { '--tone': `var(--imp-color-${tone})` } },
      span({ class: 'badge' }, icon(glyph)),
      div({ class: 'words' }, span({ class: 'value' }, value), span({ class: 'label' }, label)),
    ),
})
