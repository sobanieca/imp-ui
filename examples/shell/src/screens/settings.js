import { component } from 'imp'
import { useState } from 'imp/state'
import { button, heading, text } from 'imp/std'
import { flex, stack } from 'imp/std/layout'
import { seedTodos } from '../todos.js'

export const settings = component('todo-settings', {
  build: () => {
    const todos = useState('tasks.todos')
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
