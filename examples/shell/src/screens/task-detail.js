import { component } from 'imp'
import { computed, useState } from 'imp/state'
import { button, heading, link, text } from 'imp/std'
import { emptyState } from 'imp/std/display'
import { flex, stack } from 'imp/std/layout'
import { app } from '../app-map.js'
import { removeTodo, toggleTodo } from '../todos.js'

export const taskDetail = component('todo-detail', {
  setup: (self, { id }) => {
    const todos = useState(self, 'tasks.todos')
    const todo = computed([todos], (items) => items.find((item) => item.id === id) ?? null)
    return todo.view((current) =>
      current === null
        ? emptyState({
          title: 'No such task',
          description: 'It was deleted, or it never existed.',
        }, link({ href: app.tasks.all.href() }, 'Back to all tasks'))
        : stack(
          { gap: 4 },
          heading({ level: 1 }, current.title),
          text({ tone: 'secondary' }, current.done ? 'Done.' : 'Still to do.'),
          flex(
            { gap: 2, wrap: true },
            button(
              { variant: 'primary', events: { click: () => toggleTodo(todos, id) } },
              current.done ? 'Mark as active' : 'Mark as done',
            ),
            button({ variant: 'danger', events: { click: () => removeTodo(todos, id) } }, 'Delete'),
          ),
        )
    )
  },
})
