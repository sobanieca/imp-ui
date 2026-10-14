import { component } from 'imp'
import { div } from 'imp/html'
import { initState, useState } from 'imp/state'

export const app = component('demo-app', {
  setup: (self) => {
    const user = initState(self, 'user', { name: 'Ada' })
    const theme = useState(self, 'theme')
    const count = initState(self, `count`, 0)
    const settings = initState(self, 'myapp.settings.', {})
    const good = initState(self, 'myapp.cart', [])
    const dynamic = useState(self, globalThis.stateName)
    return div(user.text(), theme.text(), count.text(), settings.text(), good.text(), dynamic.text())
  },
})
