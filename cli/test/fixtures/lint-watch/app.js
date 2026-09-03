import { component } from 'imp'
import { div } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { useRoute } from 'imp/router'
import { lang } from 'imp/i18n'
import { theme } from 'imp/theme'

const poller = { watch: (run) => run() }

export const orders = component('demo-orders', {
  setup: async (me) => {
    const orders = initState(me, 'demo.orders', [])
    const user = useState(me, 'demo.user')
    const summary = computed([orders], (list) => list.length)
    user.watch(() => {})
    orders.watch(me, () => {})
    me.stop = summary.watch(() => {})
    const stop = theme.watch(() => {})
    lang.watch(() => {})
    poller.watch(() => {})
    const route = useRoute()
    await Promise.resolve()
    route.watch(() => {})
    useRoute().watch(() => {})
    useRoute().watch(me, () => {})
    return div(orders.text(), stop.name)
  },
  onMount: (self) => {
    lang.watch(self, () => {})
    theme.watch(() => {})
  },
  onRemove: (self) => {
    self.stop()
    lang.watch(() => {})
  },
})
