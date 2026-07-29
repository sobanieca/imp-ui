import { people } from './people.js'

const createFlakyHandler = () => {
  let calls = 0
  return () => {
    calls++
    if (calls % 2 === 0) throw new Error(`simulated network error on attempt ${calls}`)
    return { status: 200, body: { calls } }
  }
}

export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/users',
    delay: 20,
    handler: () => ({ status: 200, body: people }),
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/users',
    handler: (request) => ({ status: 201, body: { id: 'u3', ...request.body } }),
  },
  {
    match: (request) => request.path === '/api/flaky',
    handler: createFlakyHandler(),
  },
]
