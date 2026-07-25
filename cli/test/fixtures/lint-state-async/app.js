import { component } from 'imp'
import { div, li, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'

export const orders = component('demo-orders', {
  onMount: async () => {
    const orders = initState('demo.orders', [])
    const user = useState('demo.user')
    const summary = computed([orders], (list) => list.length)
    const poller = { watch: (run) => run() }
    user.watch(() => {})
    const loadTotals = async () => {
      const totals = await fetch('/api/totals').then((response) => response.json())
      orders.set(totals)
    }
    const data = await fetch('/api/orders').then((response) => response.json())
    const late = useState('demo.filter')
    initState('demo.total', data.length)
    orders.set(data)
    orders.watch(() => {})
    summary.watch(() => {})
    poller.watch(() => {})
    loadTotals()
    return div(
      user.text((current) => current.name),
      late.text(),
      ul(orders.each((order) => li(order.id), (order) => order.id)),
    )
  },
})
