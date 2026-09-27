import { userFromToken } from './session.mock.js'

let nextId = 4
let todos = [
  {
    id: '1',
    title: 'Read the imp skills',
    notes: 'Start with `imp skill`, then open **routing** and **state**.',
    priority: 'high',
    due: '2026-10-01',
    done: true,
  },
  {
    id: '2',
    title: 'Write the first screen',
    notes: '',
    priority: 'normal',
    due: '2026-10-05',
    done: false,
  },
  { id: '3', title: 'Ship it', notes: '', priority: 'low', done: false },
]
let listRequests = 0

const itemPath = /^\/api\/todos\/([^/]+)$/
const idOf = (path) => path.match(itemPath)?.[1]
const signedIn = (request) => userFromToken(request.headers.authorization) !== null
const unauthorized = { status: 401, body: { message: 'Not signed in' } }
const notFound = { status: 404, body: { message: 'No such todo' } }

export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/todos',
    delay: 300,
    handler: (request) => {
      if (!signedIn(request)) return unauthorized
      listRequests += 1
      if (listRequests === 1) return { status: 503, body: { message: 'Warming up' } }
      return { body: todos }
    },
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/todos',
    delay: 200,
    handler: (request) => {
      if (!signedIn(request)) return unauthorized
      const todo = {
        notes: '',
        priority: 'normal',
        done: false,
        ...request.body,
        id: String(nextId),
      }
      nextId += 1
      todos = [...todos, todo]
      return { status: 201, body: todo }
    },
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/todos/clear-completed',
    handler: (request) => {
      if (!signedIn(request)) return unauthorized
      todos = todos.filter((todo) => !todo.done)
      return { body: todos }
    },
  },
  {
    match: (request) => request.method === 'GET' && itemPath.test(request.path),
    handler: (request) => {
      if (!signedIn(request)) return unauthorized
      const todo = todos.find((item) => item.id === idOf(request.path))
      return todo ? { body: todo } : notFound
    },
  },
  {
    match: (request) => request.method === 'PATCH' && itemPath.test(request.path),
    delay: 200,
    handler: (request) => {
      if (!signedIn(request)) return unauthorized
      const id = idOf(request.path)
      const current = todos.find((todo) => todo.id === id)
      if (!current) return notFound
      const updated = { ...current, ...request.body, id }
      todos = todos.map((todo) => (todo.id === id ? updated : todo))
      return { body: updated }
    },
  },
  {
    match: (request) => request.method === 'DELETE' && itemPath.test(request.path),
    handler: (request) => {
      if (!signedIn(request)) return unauthorized
      const id = idOf(request.path)
      if (!todos.some((todo) => todo.id === id)) return notFound
      todos = todos.filter((todo) => todo.id !== id)
      return { status: 204 }
    },
  },
]
