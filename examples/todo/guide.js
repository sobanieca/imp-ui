import { areaRoutes, article, button, component, h2, li, navigate, ul } from 'imp'

const guideScreen = component('todo-guide', {
  styles: `
    button {
      background: var(--primary);
      color: #fff;
      border: 1px solid var(--primary-border);
      border-radius: 8px;
      padding: 8px 12px;
      font: inherit;
      cursor: pointer;
    }
    button:hover { border-color: var(--focus) }
    .guide {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    .guide h2 {
      margin: 0 0 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .guide ul {
      margin: 0 0 16px;
      padding-left: 20px;
      color: var(--muted);
      line-height: 1.7;
    }
  `,
  onMount: () =>
    article(
      { class: 'guide' },
      h2('what to try'),
      ul(
        li('add todos in the quick list, filter with the chips, watch the counts and meter follow'),
        li('“to board” promotes a todo into a draggable card and jumps you to the board'),
        li('drag a card between columns mid-edit — its text and stage badge travel with it'),
        li('flip the theme or toggle the session clock in the toolbar — both live in the shell'),
        li(
          'this section is an area — its own module, fetched on demand the first time you open it',
        ),
      ),
      button({ class: 'primary', events: { click: () => navigate('/') } }, 'back to the list'),
    ),
})

export default areaRoutes({
  '/': () => guideScreen(),
})
