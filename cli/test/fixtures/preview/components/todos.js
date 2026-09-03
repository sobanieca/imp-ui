import { component } from 'imp'
import { li, ul } from 'imp/html'
import { fetchTodos } from '../http.js'
import { initState } from 'imp/state'

export const todoList = component('demo-todos', {
  loading: () => 'loading todos...',
  async setup(self) {
    const todos = initState(self, 'demo.todos', [])
    todos.set(await fetchTodos())
    return ul(todos.each((todo) => li({ class: 'todo' }, todo.title)))
  },
})
