import { component } from 'imp'
import { div } from 'imp/html'
import { createHttpClient, initHttpClient, useHttpClient } from 'imp/http'

export const shared = createHttpClient('sync', { baseUrl: '/sync' })

export const orders = component('demo-orders', {
  onMount: async () => {
    const api = initHttpClient('api', { baseUrl: '/api' })
    const admin = useHttpClient('demo.admin')
    const good = initHttpClient('demo.api', { baseUrl: '/api' })
    initHttpClient(shared)
    const orders = await api.get('/orders')
    const later = createHttpClient('demo.reports', { baseUrl: '/reports' })
    const late = useHttpClient('demo.exports')
    initHttpClient('demo.stats', { baseUrl: '/stats' })
    await admin.get('/audit')
    await late.get('/summary')
    return div(good.pending.text(), later.name, orders.length)
  },
})
