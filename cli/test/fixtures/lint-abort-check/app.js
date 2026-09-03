import { component } from 'imp'
import { div } from 'imp/html'
import { initState, useState } from 'imp/state'
import { useHttpClient } from 'imp/http'

export const orders = component('demo-orders', {
  setup: async (self) => {
    const api = useHttpClient(self, 'demo.api')
    const data = await useHttpClient(self, 'demo.reports').get('/orders')
    const orders = initState(self, 'demo.orders', data)
    const more = await api.get('/more', { signal: self.abortSignal })
    const extra = useState(self, 'demo.extra')
    await Promise.resolve()
    if (self.abortSignal.aborted) return null
    const user = useState(self, 'demo.user')
    return div(orders.text(), extra.text(), user.text(), String(more))
  },
})

export const bundlerPlugin = {
  name: 'demo-plugin',
  setup: async (self) => {
    await Promise.resolve()
    return initState(self, 'demo.plugin', null)
  },
}
