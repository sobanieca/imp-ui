import { component } from 'imp'
import { div } from 'imp/html'
import { button, text } from 'imp/std'
import { drawer, stack } from 'imp/std/layout'
import { initState } from 'imp/state'

export const name = 'Drawer'
export const group = 'Layout'
export const description = "Run 'imp skill std/drawer' to learn what drawer can do before using it."

export const fromTheEnd = component('drawer-end-demo', {
  build: () => {
    const open = initState('drawer.open', false)
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
})()

export const pinnedOpen = component('drawer-pinned-demo', {
  build: () => {
    const open = initState('drawer.open', false)
    return div(
      button({ events: { click: () => open.set(true) } }, 'Filters, pinned'),
      drawer(
        { title: 'Filters', open, pin: true },
        text('Pinned from the start: a click outside leaves it open. Unpin it from the bar.'),
      ),
    )
  },
})()

export const nonBlockingPanel = component('drawer-panel-demo', {
  build: () => {
    const open = initState('drawer.open', false)
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
})()
