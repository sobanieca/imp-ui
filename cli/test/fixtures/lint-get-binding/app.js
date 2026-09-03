import { component } from 'imp'
import { div, input } from 'imp/html'
import { useState } from 'imp/state'
import { button } from 'imp/std'
import { theme } from 'imp/theme'

export const form = component('demo-form', {
  setup: (self) => {
    const busy = useState(self, 'demo.busy')
    return div(
      button('Save', { disabled: busy.get() }),
      input({ value: busy.get(), class: busy }),
      div({ title: theme.get() }),
    )
  },
})
