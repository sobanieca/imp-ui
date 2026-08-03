import { component } from 'imp'
import { initState } from 'imp/state'
import { initHttpClient } from 'imp/http'
import { stack } from 'imp/std/layout'
import { todoItem } from './todo_item.js'

const todos = [
  {
    id: 't1',
    title: 'Read the imp skills',
    notes: 'Start with imp skill state.',
    priority: 'high',
    estimate: 1,
    pinned: true,
    done: false,
  },
  {
    id: 't2',
    title: 'Wire up the http client',
    notes: '',
    priority: 'normal',
    estimate: 2,
    pinned: false,
    done: true,
  },
  {
    id: 't3',
    title:
      'A title long enough to wrap onto a second line, so the badges keep their place at the end of the row',
    notes: 'And a note that runs on as well.',
    priority: 'low',
    estimate: 0.5,
    pinned: false,
    done: false,
  },
]

const host = component('todo-item-preview-host', {
  onMount: (_instance, ...children) => {
    initState('todo.items', todos)
    initHttpClient('todo.api', { baseUrl: '/api' })
    return stack({ gap: 3 }, ...children)
  },
})

export const open = host(todoItem({ todo: todos[0] }))

export const done = host(todoItem({ todo: todos[1] }))

export const wrapping = host(todoItem({ todo: todos[2] }))

export const list = host(...todos.map((todo) => todoItem({ todo })))
