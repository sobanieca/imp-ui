import { init, mount } from 'imp'
import { beforeAll, beforeEach, expect, spy, test } from 'imp/test'
import { app } from '../src/app-map.js'
import { root } from '../src/app.js'
import { todoProgress } from '../src/todos/todo-progress.js'

const find = (node, selector) => {
  const scope = node.shadowRoot ?? node
  const direct = scope.querySelector(selector)
  if (direct) return direct
  for (const child of scope.querySelectorAll('*')) {
    const found = child.shadowRoot ? find(child, selector) : null
    if (found) return found
  }
  return null
}

const settle = async () => {
  for (let round = 0; round < 10; round += 1) await new Promise((resolve) => setTimeout(resolve))
}

beforeAll(() => init({ lang: 'en', translations: { en: () => import('../locales/en.js') } }))

beforeEach(() => {
  document.body.replaceChildren()
  history.replaceState(null, '', '/')
  localStorage.clear()
})

test('the map holds every section, with a param under todos', () => {
  expect([app.home, app.todos, app.stats, app.about].map(String)).toEqual([
    '/',
    '/todos',
    '/stats',
    '/about',
  ])
  expect(app.todos.spec.children).toEqual([app.todos.$todoId])
  expect(app.todos.$todoId.href({ todoId: '7' })).toEqual('/todos/7')
  expect(app.stats.spec.access).toEqual('user')
})

test('a visitor with no session sees the sign-in form', async () => {
  spy(globalThis, 'fetch', () =>
    new Response('{"message":"Not signed in"}', {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }))
  mount(document.body, root())
  await settle()
  const page = document.querySelector('todo-root')
  expect(find(page, 'todo-sign-in')).toBeTruthy()
  expect(find(page, 'todo-list-screen')).toEqual(null)
})

test('the progress bar counts the done todos', async () => {
  mount(
    document.body,
    todoProgress({
      todos: [
        { id: '1', title: 'A', priority: 'low', done: true },
        { id: '2', title: 'B', priority: 'low', done: false },
      ],
    }),
  )
  await settle()
  const host = document.querySelector('todo-progress')
  expect(find(host, 'progress').getAttribute('value')).toEqual('50')
  expect(find(host, '.label').textContent).toEqual('1 of 2 done')
})
