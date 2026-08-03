import { component, init, mount } from 'imp'
import { div } from 'imp/html'
import { initState } from 'imp/state'
import { initHttpClient } from 'imp/http'
import { beforeAll, beforeEach, expect, spy, test } from 'imp/test'
import { todoItem } from '../src/components/todo_item.js'

const todo = {
  id: 't1',
  title: 'Read the imp skills',
  notes: 'Start with imp skill state.',
  priority: 'high',
  estimate: 1,
  pinned: false,
  done: false,
}

let items = null

const host = component('todo-item-test-host', {
  onMount: (_instance, ...children) => {
    items = initState('todo.items', [todo])
    initHttpClient('todo.api', { baseUrl: '/api' })
    return div(...children)
  },
})

const find = (root, selector) => {
  const direct = root.querySelector(selector)
  if (direct) return direct
  for (const node of [root, ...root.querySelectorAll('*')]) {
    if (!node.shadowRoot) continue
    const found = find(node.shadowRoot, selector)
    if (found) return found
  }
  return null
}

const render = () => {
  mount(document.body, host(todoItem({ todo })))
  return document.body
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeAll(() => init({ translations: { en: () => import('../locales/en.js') } }))

beforeEach(() => document.body.replaceChildren())

test('shows the title, the notes and the priority', () => {
  const card = find(render(), `#todo-${todo.id}`)
  expect(find(card, 'a').textContent).toEqual('Read the imp skills')
  expect(find(card, '.badge-high').textContent).toEqual('High')
  expect(find(find(card, 'imp-text'), 'p').textContent).toEqual('1 h · Start with imp skill state.')
})

test('the switch is a real checkbox named after its todo', () => {
  const control = find(render(), 'input[type="checkbox"]')
  expect(control.getAttribute('role')).toEqual('switch')
  expect(control.getAttribute('aria-label')).toEqual('Mark “Read the imp skills” as done')
  expect(control.checked).toEqual(false)
})

test('flipping the switch patches the todo and updates the list', async () => {
  const call = spy(
    globalThis,
    'fetch',
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ ...todo, done: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
  )
  find(render(), 'input[type="checkbox"]').click()
  await settled()

  expect(call.calls.length).toEqual(1)
  expect(call.calls[0][0]).toContain('/api/todos/t1')
  expect(call.calls[0][1].method).toEqual('PATCH')
  expect(items.get()[0].done).toEqual(true)
})

test('a failed request puts the switch back', async () => {
  spy(
    globalThis,
    'fetch',
    () => Promise.resolve(new Response('nope', { status: 500 })),
  )
  const control = find(render(), 'input[type="checkbox"]')
  control.click()
  await settled()

  expect(control.checked).toEqual(false)
  expect(items.get()[0].done).toEqual(false)
})
