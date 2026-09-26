import { component } from 'imp'
import { div } from 'imp/html'
import { button, text } from 'imp/std'
import { drawer, stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Drawer'
export const group = groups.layout

export const fromTheEnd = {
  scenario: 'From the end',
  component: component('drawer-end-demo', {
    setup: (self) => {
      const open = initState(self, 'drawer.open', false)
      return div(
        button({ variant: 'primary', events: { click: () => open.set(true) } }, 'Filters'),
        drawer(
          { title: 'Filters', open },
          stack(
            { gap: 3 },
            text('Slides in from the end of the line - the right in English. Escape closes this.'),
            button({ events: { click: () => open.set(false) } }, 'Apply'),
          ),
        ),
      )
    },
  })(),
}

export const withABackground = {
  scenario: 'With a background',
  component: component('drawer-background-demo', {
    setup: (self) => {
      const open = initState(self, 'drawer.open', false)
      return div(
        button({ events: { click: () => open.set(true) } }, 'Painted drawer'),
        drawer(
          {
            title: 'Details',
            open,
            background: div({
              style:
                'background: linear-gradient(180deg, var(--imp-color-violet, #c084fc) 0%, transparent 60%); opacity: 0.4',
            }),
          },
          text('The gradient is one node under the bar and the content, clipped to the panel.'),
        ),
      )
    },
  })(),
}

export const nonBlockingPanel = {
  scenario: 'Non-blocking panel',
  component: component('drawer-panel-demo', {
    setup: (self) => {
      const open = initState(self, 'drawer.open', false)
      return div(
        button({ events: { click: () => open.set(!open.get()) } }, 'Toggle the inspector'),
        drawer(
          { title: 'Inspector', modal: false, open },
          stack(
            { gap: 3 },
            text('The page behind still scrolls and still works while this stays open.'),
            text({ tone: 'secondary', size: 'sm' }, 'Escape does not close it; the button does.'),
          ),
        ),
      )
    },
  })(),
}
