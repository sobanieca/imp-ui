import { component } from 'imp'
import { div, span } from 'imp/html'
import { useState } from 'imp/state'
import { lang } from 'imp/i18n'

export const orders = component('demo-orders', {
  loading: (self, { id }) => {
    const user = useState(self, 'demo.user')
    return div(user.text(), lang.text(), span({ class: user }), String(id))
  },
  setup: async (self, { id }) => {
    const user = useState(self, 'demo.user')
    await Promise.resolve()
    return div(user.text(), lang.text(), String(id))
  },
})
