import { component } from 'imp'
import { div, input, label, li, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { button, heading, icon, link, text } from 'imp/std'
import { luTrash } from 'imp/icons'
import { emptyState } from 'imp/std/display'
import { textField } from 'imp/std/inputs'
import { stack } from 'imp/std/layout'
import { app } from '../app-map.js'
import { addTodo, matching, removeTodo, toggleTodo } from '../todos.js'

const todoRow = component('todo-row', {
  styles: `
    .row {
      display: flex;
      align-items: center;
      gap: var(--imp-space-3);
      padding-block: var(--imp-space-2);
      padding-inline: var(--imp-space-3);
      border: var(--imp-border-width) solid var(--imp-color-border);
      border-radius: var(--imp-radius-md);
      background-color: var(--imp-color-surface);
    }

    .box {
      flex: none;
      inline-size: 1.15rem;
      block-size: 1.15rem;
      accent-color: var(--imp-color-primary);
    }

    .title {
      flex: 1;
      min-inline-size: 0;
      color: var(--imp-color-text);
      font-family: var(--imp-font-family);
      font-size: var(--imp-font-size-md);
    }

    .done .title {
      text-decoration: line-through;
      color: var(--imp-color-secondary);
    }
  `,
  setup: (self, { todo }) => {
    const todos = useState(self, 'tasks.todos')
    return div(
      { class: ['row', todo.done && 'done'] },
      input({
        id: 'done',
        class: 'box',
        type: 'checkbox',
        checked: todo.done,
        events: { change: () => toggleTodo(todos, todo.id) },
      }),
      label({ class: 'title', for: 'done' }, todo.title),
      link({ href: app.tasks.$taskId.href({ taskId: todo.id }), size: 'sm' }, 'Open'),
      button({
        variant: 'ghost',
        size: 'sm',
        label: `Delete ${todo.title}`,
        events: { click: () => removeTodo(todos, todo.id) },
      }, icon(luTrash, { size: 'sm' })),
    )
  },
})

const addTask = component('todo-add', {
  styles: `
    .add {
      display: flex;
      align-items: flex-end;
      gap: var(--imp-space-2);
    }
  `,
  setup: (self) => {
    const todos = useState(self, 'tasks.todos')
    const draft = initState(self, 'tasks.draft', '')

    const add = () => {
      const title = draft.get().trim()
      if (title === '') return
      addTodo(todos, title)
      draft.set('')
    }

    return div(
      {
        id: 'add-task',
        class: 'add',
        events: {
          keydown: (event) => {
            if (event.key === 'Enter') add()
          },
        },
      },
      textField({ value: draft, label: 'New task', placeholder: 'What needs doing?' }),
      button({ variant: 'primary', events: { click: add } }, 'Add'),
    )
  },
})

const taskList = component('todo-list', {
  styles: `
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--imp-space-2);
      list-style: none;
      margin: 0;
      padding: 0;
    }
  `,
  setup: (self, { filter }) => {
    const todos = useState(self, 'tasks.todos')
    const visible = computed([todos], (items) => items.filter(matching[filter]))
    const nothingToShow = computed([visible], (items) => items.length === 0)

    return div(
      nothingToShow.view((empty) =>
        empty
          ? emptyState({
            title: 'Nothing on this list',
            description: 'Add a task above, or pick another section.',
          })
          : null
      ),
      ul({ class: 'list' }, visible.each((todo) => li(todoRow({ todo })), (todo) => todo.id)),
    )
  },
})

export const tasks = component('todo-tasks', {
  setup: (_self, { filter, node }) =>
    stack(
      { gap: 4 },
      heading({ level: 1 }, node.spec.label),
      text({ tone: 'secondary' }, node.spec.description),
      addTask(),
      taskList({ filter }),
    ),
})
