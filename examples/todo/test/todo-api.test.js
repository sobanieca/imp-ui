import { component, mount } from 'imp'
import { HttpError, initHttpClient } from 'imp/http'
import { beforeEach, expect, spy, test } from 'imp/test'
import {
  clientOptions,
  createTodo,
  loadSession,
  loadTodos,
  updateTodo,
} from '../src/todos/todo-api.js'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const answers = (...responses) => {
  let index = 0
  return spy(globalThis, 'fetch', () => responses[Math.min(index++, responses.length - 1)]())
}

const clientHost = component('todo-client-host', { setup: (self, prepare) => prepare(self) })

const client = (token = () => 'secret') => {
  let api
  mount(
    document.body,
    clientHost((self) =>
      void (api = initHttpClient(self, 'todo.api', clientOptions({ baseUrl: '/api', token })))
    ),
  )
  return api
}

beforeEach(() => document.body.replaceChildren())

test('every request carries the token of the session', async () => {
  const fetched = answers(() => jsonResponse([]))
  await loadTodos(client())
  expect(fetched.calls[0][0]).toEqual(`${location.origin}/api/todos`)
  expect(fetched.calls[0][1].headers.authorization).toEqual('Bearer secret')
})

test('a request without a token sends no authorization header', async () => {
  const fetched = answers(() => jsonResponse([]))
  await loadTodos(client(() => null))
  expect(fetched.calls[0][1].headers.authorization).toEqual(undefined)
})

test('a 503 on a read is retried until it succeeds', async ({ clock }) => {
  const fetched = answers(
    () => jsonResponse({ message: 'busy' }, 503),
    () => jsonResponse([{ id: '1', title: 'Ship it' }]),
  )
  const loading = loadTodos(client())
  await clock.runAll()
  expect(await loading).toEqual([{ id: '1', title: 'Ship it' }])
  expect(fetched.calls.length).toEqual(2)
}, { fakeTimers: true })

test('a create is sent once, as JSON, and never retried', async () => {
  const fetched = answers(() => jsonResponse({ message: 'busy' }, 503))
  const error = await createTodo(client(), { title: 'Ship it' }).catch((failure) => failure)
  expect(error instanceof HttpError).toEqual(true)
  expect(error.status).toEqual(503)
  expect(fetched.calls.length).toEqual(1)
  expect(fetched.calls[0][1].method).toEqual('POST')
})

test('an update is tracked under its own name', async () => {
  answers(() => jsonResponse({ id: '1', done: true }))
  const api = client()
  const saving = updateTodo(api, '1', { done: true })
  expect(api.tracked('todo.save').pending.get()).toEqual(1)
  await saving
  expect(api.tracked('todo.save').pending.get()).toEqual(0)
})

test('a 401 on the session means nobody is signed in, and clears the error', async () => {
  answers(() => jsonResponse({ message: 'Not signed in' }, 401))
  const api = client()
  expect(await loadSession(api)).toEqual(null)
  expect(api.lastError.get()).toEqual(null)
})

test('any other session failure is thrown', async () => {
  answers(() => jsonResponse({ message: 'Down' }, 500))
  const error = await loadSession(client()).catch((failure) => failure)
  expect(error.status).toEqual(500)
})
