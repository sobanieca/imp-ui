import { component } from 'imp'
import { li, ul } from 'imp/html'
import { initState } from 'imp/state'
import { fetchTodos } from '../http.js'

export const todoList = component('demo-todos', {
  placeholder: () => 'loading todos…',
  async onMount() {
    const todos = initState('demo.todos', [])
    todos.set(await fetchTodos())
    return ul(todos.each((todo) => li({ class: 'todo' }, todo.title)))
  },
})
