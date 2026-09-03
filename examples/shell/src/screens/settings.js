import { component } from 'imp'
import { button, heading, text } from 'imp/std'
import { flex, stack } from 'imp/std/layout'
import { seedTodos } from '../todos.js'
import { useState } from 'imp/state'

export const settings = component('todo-settings', {
  setup: (self) => {
    const todos = useState(self, 'tasks.todos')
    return stack(
      { gap: 4 },
      heading({ level: 1 }, 'Settings'),
      text(
        { tone: 'secondary' },
        'Nothing here is stored. The screen exists so the sidebar and the bottom bar have a destination outside the lists.',
      ),
      flex(
        { gap: 2, wrap: true },
        button({ events: { click: () => todos.set(seedTodos()) } }, 'Reset the demo tasks'),
        button({ variant: 'danger', events: { click: () => todos.set([]) } }, 'Delete every task'),
      ),
    )
  },
})
