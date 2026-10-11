import { component } from 'imp'
import { div } from 'imp/html'
import { initState, useState } from 'imp/state'
import { initHttpClient, useHttpClient } from 'imp/http'

export const profile = component('demo-profile', {
  setup: (self) => {
    const user = initState('demo.user', { name: 'Ada' })
    const settings = useState(`demo.settings`)
    const api = initHttpClient({ baseUrl: '/api' })
    const reports = useHttpClient()
    const flags = useState(self, 'demo.flags')
    return div(user.text(), settings.text(), flags.text(), String(api), String(reports))
  },
})
