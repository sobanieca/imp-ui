import { component } from 'imp'
import { div, input, label, li, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { button, heading, icon, text } from 'imp/std'
import { emptyState } from 'imp/std/display'
import { textField } from 'imp/std/inputs'
import { stack } from 'imp/std/layout'
import { addTodo, matching, removeTodo, toggleTodo } from '../todos.js'

const titles = {
  all: 'All tasks',
  active: 'Active',
  done: 'Done',
}

const descriptions = {
  all: 'Every task in the demo list.',
  active: 'What is still waiting to be done.',
  done: 'What is already finished.',
}

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
  build: (_instance, { todo }) => {
    const todos = useState('tasks.todos')
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
      button({
        variant: 'ghost',
        size: 'sm',
        label: `Delete ${todo.title}`,
        events: { click: () => removeTodo(todos, todo.id) },
      }, icon({ name: 'trash', size: 'sm' })),
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

    .add imp-text-field {
      flex: 1;
      min-inline-size: 0;
    }
  `,
  build: () => {
    const todos = useState('tasks.todos')
    const draft = initState('tasks.draft', '')

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
  build: (_instance, { filter }) => {
    const todos = useState('tasks.todos')
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
  build: (_instance, { filter }) =>
    stack(
      { gap: 4 },
      heading({ level: 1 }, titles[filter]),
      text({ tone: 'secondary' }, descriptions[filter]),
      addTask(),
      taskList({ filter }),
    ),
})
