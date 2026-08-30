import { component } from 'imp'
import { div } from 'imp/html'
import { icon } from 'imp/std'
import { appLogo, themeSelect, userCard } from 'imp/std/shell'

export const appBar = component('app-bar', {
  styles: `
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--imp-space-3);
      min-inline-size: 0;
    }

    .brand {
      min-inline-size: 0;
      overflow: hidden;
    }

    .actions {
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--imp-space-2);
    }
  `,
  build: () =>
    div(
      { class: 'bar' },
      div(
        { class: 'brand' },
        appLogo({
          label: 'imp tasks',
          tagline: 'shell example',
          icon: icon({ name: 'check', size: 'lg' }),
        }),
      ),
      div(
        { class: 'actions' },
        themeSelect(),
        userCard({
          signedIn: true,
          compact: true,
          name: 'Ada Lovelace',
          description: 'ada@example.com',
        }),
      ),
    ),
})
