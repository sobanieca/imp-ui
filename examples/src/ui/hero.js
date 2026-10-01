import { component } from 'imp'
import { div, h1, p } from 'imp/html'

export const hero = component('todo-hero', {
  styles: `
    :host { display: block; }
    .hero {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      justify-content: space-between;
      gap: var(--imp-space-4);
    }
    .words { display: flex; flex-direction: column; gap: var(--imp-space-2); min-inline-size: 0; }
    .eyebrow {
      margin: 0;
      font: var(--imp-font-weight-bold) var(--imp-font-size-sm) / 1 var(--imp-font-family);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--imp-color-primary);
    }
    h1 {
      margin: 0;
      font-family: var(--imp-font-family-heading);
      font-weight: 600;
      font-size: clamp(2rem, 1.5rem + 2.2dvi, 3.25rem);
      line-height: 1.05;
      letter-spacing: -0.03em;
      overflow-wrap: anywhere;
      background: linear-gradient(
        120deg,
        var(--imp-color-text) 25%,
        var(--imp-color-primary) 70%,
        var(--imp-color-pink)
      );
      background-clip: text;
      color: transparent;
    }
    .subtitle {
      margin: 0;
      font: var(--imp-font-size-lg) / var(--imp-line-height-normal) var(--imp-font-family);
      color: var(--imp-color-secondary);
    }
    .actions { display: flex; flex-wrap: wrap; gap: var(--imp-space-2); align-items: center; }
    @media (forced-colors: active) {
      h1 { background: none; color: CanvasText; }
    }
  `,
  setup: (_self, { eyebrow, title, subtitle, actions }) =>
    div(
      { class: 'hero' },
      div(
        { class: 'words' },
        eyebrow && p({ class: 'eyebrow' }, eyebrow),
        h1(title),
        subtitle && p({ class: 'subtitle' }, subtitle),
      ),
      actions && div({ class: 'actions' }, actions),
    ),
})
