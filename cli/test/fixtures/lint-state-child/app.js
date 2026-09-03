import { component } from 'imp'
import { div, el, span } from 'imp/html'
import { initState } from 'imp/state'
import { useRoute } from 'imp/router'
import { lang } from 'imp/i18n'

export const counter = component('demo-counter', {
  setup: (self) => {
    const count = initState(self, 'demo.count', 0)
    return div(count, span(lang), el('p', count), useRoute(), count.text())
  },
})
