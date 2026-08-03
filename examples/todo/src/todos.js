export const PRIORITIES = ['high', 'normal', 'low']

export const STATUSES = ['all', 'open', 'done']

const rank = (todo) => PRIORITIES.indexOf(todo.priority)

const matchesQuery = (todo, query) => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return `${todo.title} ${todo.notes}`.toLowerCase().includes(needle)
}

const matchesStatus = (todo, status) => status === 'all' || (status === 'done') === todo.done

export const visibleTodos = (todos, { query = '', status = 'all' } = {}) =>
  todos
    .filter((todo) => matchesStatus(todo, status) && matchesQuery(todo, query))
    .sort((left, right) =>
      Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
      rank(left) - rank(right) ||
      left.title.localeCompare(right.title)
    )

export const summarize = (todos) => ({
  total: todos.length,
  done: todos.filter((todo) => todo.done).length,
  open: todos.filter((todo) => !todo.done).length,
  hours: todos.filter((todo) => !todo.done).reduce((sum, todo) => sum + (todo.estimate ?? 0), 0),
})
