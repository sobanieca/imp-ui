import { component } from 'imp'
import { useState } from 'imp/state'
import { useHttpClient } from 'imp/http'
import { router } from 'imp/router'
import { heading, link, text } from 'imp/std'
import { stack } from 'imp/std/layout'
import { loadingPanel, messagePanel, words } from '../panels.js'

export const statsShell = component('todo-stats-shell', {
  placeholder: () => loadingPanel(),
  onError: (error) => messagePanel('app.failed', error.message),
  onMount: async () => {
    const items = useState('todo.items')
    const api = useHttpClient('todo.api')
    const screens = router()

    if (items.get().length === 0) items.set(await api.get('/todos'))

    return stack(
      { gap: 4 },
      stack(
        { direction: 'row', justify: 'between', gap: 3 },
        heading({ level: 2 }, words('stats.title')),
        link({ href: '/' }, words('app.home')),
      ),
      text({ tone: 'secondary', size: 'sm' }, words('stats.hint')),
      screens,
    )
  },
})
