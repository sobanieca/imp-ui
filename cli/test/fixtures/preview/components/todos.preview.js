import { mockModule } from 'imp/preview'
import { todoList } from './todos.js'

mockModule('../http.js', ({ spy }) => ({
  fetchTodos: spy(async () => [{ id: 1, title: 'Buy milk' }, { id: 2, title: 'Ship imp' }]),
}))

export const populated = todoList()
