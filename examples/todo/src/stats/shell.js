import { component } from 'imp'
import { useState } from 'imp/state'
import { useHttpClient } from 'imp/http'
import { router } from 'imp/router'
import { heading, link, text } from 'imp/std'
import { container, divider, row, spacer, stack } from 'imp/std/layout'
import { loadingPanel, messagePanel, words } from '../panels.js'

export const statsShell = component('todo-stats-shell', {
  placeholder: () => loadingPanel(),
  onError: (error) => messagePanel('app.failed', error.message),
  onMount: async () => {
    const items = useState('todo.items')
    const api = useHttpClient('todo.api')
    const screens = router()

    if (items.get().length === 0) items.set(await api.get('/todos'))

    return container(
      { size: 'lg', padding: 4 },
      stack(
        { gap: 4 },
        row(
          { align: 'center', gap: 3 },
          heading({ level: 2 }, words('stats.title')),
          spacer(),
          link({ href: '/' }, words('app.home')),
        ),
        text({ tone: 'secondary', size: 'sm' }, words('stats.hint')),
        divider(),
        screens,
      ),
    )
  },
})
