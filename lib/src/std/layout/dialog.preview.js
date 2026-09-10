import { component } from 'imp'
import { div } from 'imp/html'
import { button, text } from 'imp/std'
import { dialog, stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Dialog'
export const group = groups.layout

export const modalDialog = {
  scenario: 'Modal dialog',
  component: component('dialog-modal-demo', {
    setup: (self) => {
      const open = initState(self, 'dialog.open', false)
      return div(
        button({ variant: 'primary', events: { click: () => open.set(true) } }, 'Edit user'),
        dialog(
          { title: 'Edit user', open },
          stack(
            { gap: 3 },
            text('The page behind is inert, the backdrop dims it, and Escape closes this.'),
            button({ events: { click: () => open.set(false) } }, 'Done'),
          ),
        ),
      )
    },
  })(),
}

export const movableWindow = {
  scenario: 'Movable window',
  component: component('dialog-window-demo', {
    setup: (self) => {
      const open = initState(self, 'dialog.open', false)
      return div(
        button({ events: { click: () => open.set(true) } }, 'Open the inspector'),
        dialog(
          { title: 'Inspector', modal: false, open },
          stack(
            { gap: 3 },
            text('Drag this by its title bar, or focus the bar and use the arrow keys.'),
            text(
              { tone: 'secondary', size: 'sm' },
              'The page behind still scrolls and still works.',
            ),
          ),
        ),
      )
    },
  })(),
}

export const secondWindow = {
  scenario: 'Second window',
  component: component('dialog-second-window-demo', {
    setup: (self) => {
      const open = initState(self, 'dialog.open', false)
      return div(
        button({ events: { click: () => open.set(true) } }, 'Open a second window'),
        dialog(
          { title: 'Notes', modal: false, open },
          text(
            'Every non-modal dialog is its own window, and they stack in the order they opened.',
          ),
        ),
      )
    },
  })(),
}
