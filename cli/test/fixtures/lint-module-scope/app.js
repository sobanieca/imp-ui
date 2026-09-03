import { component } from 'imp'
import { div } from 'imp/html'
import { useState } from 'imp/state'

let current = null
const cache = {}

export const peek = () => [current, cache]

export const panel = component('demo-panel', {
  setup: (self) => {
    current = self
    cache.host = self.host
    cache.user = useState(self, 'demo.user')
    self.timer = setTimeout(() => {}, 0)
    return div(String(self.timer))
  },
  onRemove: () => {
    current = null
  },
})
