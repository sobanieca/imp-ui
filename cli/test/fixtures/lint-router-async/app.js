import { component } from 'imp'
import { div } from 'imp/html'
import { useState } from 'imp/state'
import { useHttpClient } from 'imp/http'
import { router, useRoute } from 'imp/router'

export const section = component('demo-section', {
  onMount: async () => {
    const api = useHttpClient('demo.api')
    const items = useState('demo.items')
    const slot = router()
    const route = useRoute()
    items.set(await api.get('/items'))
    route.watch((current) => console.log(current.path))
    const table = router({ routes: { '/': () => div('home') } })
    const styled = router({ placeholder: () => div('loading') })
    return div(slot, table, styled, route.text((current) => current.path))
  },
})
