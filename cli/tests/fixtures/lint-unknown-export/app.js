import { component } from 'imp'
import { div } from 'imp/html'
import { luHistory, luHouse, luTrash } from 'imp/icons'
import { useStat } from 'imp/state'
import { button, card, icon } from 'imp/std'

export const panel = component('demo-panel', {
  setup: (self) => {
    useStat(self, 'demo.open')
    return div(card(button({ label: 'Home' }, icon(luHouse), icon(luTrash), icon(luHistory))))
  },
})
