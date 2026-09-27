export const PRIORITIES = ['low', 'normal', 'high']

export const FILTERS = ['all', 'active', 'completed']

export const PRIORITY_COLORS = { low: 'gray', normal: 'blue', high: 'red' }

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }

export const filterTodos = (todos, filter) => {
  if (filter === 'active') return todos.filter((todo) => !todo.done)
  if (filter === 'completed') return todos.filter((todo) => todo.done)
  return todos
}

export const sortTodos = (todos) =>
  todos.toSorted((first, second) =>
    Number(first.done) - Number(second.done) ||
    PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority] ||
    (first.due ?? '9999').localeCompare(second.due ?? '9999') ||
    first.title.localeCompare(second.title)
  )

export const countTodos = (todos) => {
  const total = todos?.length ?? 0
  const done = todos?.filter((todo) => todo.done).length ?? 0
  return { total, done, open: total - done }
}

export const countByPriority = (todos) =>
  PRIORITIES.map((priority) => {
    const matching = (todos ?? []).filter((todo) => todo.priority === priority)
    return {
      priority,
      open: matching.filter((todo) => !todo.done).length,
      done: matching.filter((todo) => todo.done).length,
    }
  })

export const todoOptions = (todos) =>
  (todos ?? []).map((todo) => ({ value: todo.id, label: todo.title }))

export const replaceTodo = (todos, updated) =>
  todos.map((todo) => (todo.id === updated.id ? updated : todo))

export const formatDate = (isoDate, language) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(`${isoDate}T00:00`))
