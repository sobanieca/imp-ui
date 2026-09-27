import { todoProgress } from './todo-progress.js'

export const name = 'Todo progress'
export const group = 'Todos'
export const description = 'The share of done todos, as a bar with a translated label.'

const todo = (id, done = false) => ({ id, title: `Todo ${id}`, priority: 'normal', done })

export const empty = todoProgress({ todos: [] })

export const halfDone = {
  scenario: 'Two of four done',
  component: () =>
    todoProgress({ todos: [todo('1', true), todo('2', true), todo('3'), todo('4')] }),
}

export const allDone = todoProgress({ todos: [todo('1', true), todo('2', true)] })
