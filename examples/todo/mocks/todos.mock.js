let nextId = 5

const todos = [
  {
    id: 't1',
    title: 'Read the imp skills',
    notes: 'Start with imp skill state, then imp skill components.',
    priority: 'high',
    estimate: 1,
    pinned: true,
    done: false,
  },
  {
    id: 't2',
    title: 'Wire up the http client',
    notes: 'One client in the root component, resolved from every screen below it.',
    priority: 'normal',
    estimate: 2,
    pinned: false,
    done: true,
  },
  {
    id: 't3',
    title: 'Translate the app into Polish',
    notes: 'locales/pl.js — the built-in form messages are translated there too.',
    priority: 'low',
    estimate: 0.5,
    pinned: false,
    done: false,
  },
  {
    id: 't4',
    title: 'Ship the midnight theme',
    notes: '',
    priority: 'normal',
    estimate: 3,
    pinned: false,
    done: false,
  },
]

const idIn = (path) => path.match(/^\/api\/todos\/([^/]+)$/)?.[1] ?? null

const find = (path) => todos.find((todo) => todo.id === idIn(path)) ?? null

const missing = { status: 404, body: { message: 'No todo with that id' } }

export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/todos',
    delay: 400,
    handler: () => ({ body: todos }),
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/todos',
    delay: 300,
    handler: (request) => {
      const todo = {
        id: `t${nextId++}`,
        notes: '',
        priority: 'normal',
        estimate: 1,
        pinned: false,
        done: false,
        ...request.body,
      }
      todos.unshift(todo)
      return { status: 201, body: todo }
    },
  },
  {
    match: (request) => request.method === 'GET' && idIn(request.path) !== null,
    delay: 200,
    handler: (request) => {
      const todo = find(request.path)
      return todo ? { body: todo } : missing
    },
  },
  {
    match: (request) => request.method === 'PATCH' && idIn(request.path) !== null,
    delay: 250,
    handler: (request) => {
      const todo = find(request.path)
      if (!todo) return missing
      Object.assign(todo, request.body, { id: todo.id })
      return { body: todo }
    },
  },
  {
    match: (request) => request.method === 'DELETE' && idIn(request.path) !== null,
    delay: 250,
    handler: (request) => {
      const todo = find(request.path)
      if (!todo) return missing
      todos.splice(todos.indexOf(todo), 1)
      return { status: 204 }
    },
  },
]
