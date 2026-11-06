import { appMap } from 'imp'
import { router } from 'imp/router'
import { link } from 'imp/std'
import { div, h2 } from 'imp/html'
import { mockModule } from 'imp/preview'
import { todoList } from './todos.js'

mockModule('../http.js', ({ spy }) => ({
  fetchTodos: spy(async () => [{ id: 1, title: 'Buy milk' }, { id: 2, title: 'Ship imp' }]),
}))

const app = appMap({ inbox: {}, done: 'Todos that are finished' })

export const populated = todoList()
export const routed = {
  scenario: 'Routed in a frame',
  frame: app.inbox,
  component: () =>
    router({
      map: app,
      screens: {
        [app.inbox]: () => div(todoList(), link({ href: app.done.href() }, 'Done')),
        [app.done]: () => h2({ class: 'done-title' }, 'Done'),
      },
    }),
}
