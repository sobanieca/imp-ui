import { component } from 'imp'
import { div, span } from 'imp/html'
import { useState } from 'imp/state'

const load = () => Promise.resolve('data')

export const badge = component('demo-badge', {
  loading: () => span('...'),
  setup: () => div('ready'),
})

export const list = component('demo-list', {
  loading: () => span('...'),
  setup: (self) => {
    const items = useState(self, 'demo.items')
    if (items.get() === undefined) return null
    return items.each((item) => div(item))
  },
})

export const deferred = component('demo-deferred', {
  loading: () => span('...'),
  setup: () => load().then((data) => div(data)),
})

export const awaited = component('demo-awaited', {
  loading: () => span('...'),
  setup: async () => div(await load()),
})
