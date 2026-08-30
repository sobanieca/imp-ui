export const seedTodos = () => [
  { id: 1, title: 'Sketch the three shell regions', done: true },
  { id: 2, title: 'Feed the sidebar from the route', done: false },
  { id: 3, title: 'Check the bottom bar under 48rem', done: false },
  { id: 4, title: 'Write the e2e spec', done: false },
]

export const isDone = (todo) => todo.done

export const isActive = (todo) => !todo.done

export const matching = {
  all: () => true,
  active: isActive,
  done: isDone,
}

const nextId = (items) => items.reduce((highest, item) => Math.max(highest, item.id), 0) + 1

export const addTodo = (todos, title) =>
  todos.set((items) => [...items, { id: nextId(items), title, done: false }])

export const toggleTodo = (todos, id) =>
  todos.set((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item))

export const removeTodo = (todos, id) =>
  todos.set((items) => items.filter((item) => item.id !== id))
