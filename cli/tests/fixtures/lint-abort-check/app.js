import { component } from 'imp'
import { div } from 'imp/html'
import { initState, useState } from 'imp/state'
import { useHttpClient } from 'imp/http'

const pause = () => new Promise((resolve) => setTimeout(resolve, 10))

export const orders = component('demo-orders', {
  setup: async (self) => {
    const api = useHttpClient(self, 'demo.api')
    const data = await useHttpClient(self, 'demo.reports').get('/orders')
    const orders = initState(self, 'demo.orders', data)
    const [more] = await Promise.all([api.get('/more'), api.get('/most')])
    const extra = useState(self, 'demo.extra')
    await pause()
    const late = useState(self, 'demo.late')
    await Promise.resolve()
    if (self.abortSignal.aborted) return null
    const user = useState(self, 'demo.user')
    return div(orders.text(), extra.text(), late.text(), user.text(), String(more))
  },
})

export const bundlerPlugin = {
  name: 'demo-plugin',
  setup: async (self) => {
    await Promise.resolve()
    return initState(self, 'demo.plugin', null)
  },
}
