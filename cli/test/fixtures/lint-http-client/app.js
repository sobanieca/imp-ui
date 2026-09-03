import { component } from 'imp'
import { div } from 'imp/html'
import { createHttpClient, initHttpClient, useHttpClient } from 'imp/http'

export const shared = createHttpClient('sync', { baseUrl: '/sync' })

export const orders = component('demo-orders', {
  setup: async (self) => {
    const api = initHttpClient(self, 'api', { baseUrl: '/api' })
    const admin = useHttpClient(self, 'demo.admin')
    const good = initHttpClient(self, 'demo.api', { baseUrl: '/api' })
    initHttpClient(self, shared)
    const orders = await api.get('/orders')
    if (self.abortSignal.aborted) return null
    const later = createHttpClient('demo.reports', { baseUrl: '/reports' })
    const late = useHttpClient(self, 'exports')
    await admin.get('/audit')
    await late.get('/summary')
    return div(good.pending.text(), later.name, orders.length)
  },
})
