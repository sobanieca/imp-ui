import { component } from 'imp'
import { div } from 'imp/html'
import { initState, useState } from 'imp/state'
import { useHttpClient } from 'imp/http'
import { theme } from 'imp/theme'

export const nav = component('demo-nav', {
  setup: (self) => {
    const nav = useState(self, 'demo.nav')
    nav.set({ id: 1 })
    const api = useHttpClient(self, 'demo.api')
    return div(nav.text(), String(api))
  },
  onRemove: (self) => {
    useState(self, 'demo.nav').set(null)
    useState(self, 'demo.user').set(null)
    useHttpClient(self, 'demo.reports')
    initState(self, 'demo.left', true)
    theme.watch(self, () => {})
  },
})

const contribute = (self) => useState(self, 'demo.visitors').text()

export const visitor = component('demo-visitor', {
  setup: (self) => div(contribute(self)),
  onRemove: (self) => useState(self, 'demo.visitors').set(null),
})
