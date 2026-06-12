import { fire, mount, tick } from '../imp/testing.js'
import { assert, assertEquals } from 'jsr:@std/assert@^1'
import {
  button,
  div,
  each,
  li,
  match,
  onMount,
  p,
  portal,
  signal,
  span,
  ul,
  when,
} from '../imp/imp.js'

Deno.test('when: swaps branches around the marker', () => {
  const loading = signal(true)
  const view = mount(() =>
    div([
      'before',
      when(loading, (l) => l ? span('spinner') : p('content')),
      'after',
    ])
  )
  assertEquals(view.el.textContent, 'beforespinnerafter')
  loading.set(false)
  assertEquals(view.el.textContent, 'beforecontentafter')
  assert(view.query('p'))
  view.unmount()
})

Deno.test('when: old branch is disposed — listeners and effects stop', () => {
  const show = signal(true)
  const count = signal(0)
  let clicks = 0
  let effectRuns = 0
  const view = mount(() =>
    div(
      when(show, (s) =>
        s
          ? button({ events: { click: () => clicks++ } }, () => {
            effectRuns++
            return count()
          })
          : null),
    )
  )
  const btn = view.query('button')
  fire(btn, 'click')
  assertEquals(clicks, 1)
  show.set(false)
  fire(btn, 'click') // listener aborted with the branch scope
  assertEquals(clicks, 1)
  count.set(5) // text effect in dead branch must not re-run
  assertEquals(effectRuns, 1)
  view.unmount()
})

Deno.test('when: render output of null/array/string all work', () => {
  const mode = signal(0)
  const view = mount(() =>
    div(when(mode, (m) => m === 0 ? null : m === 1 ? 'text' : [span('a'), span('b')]))
  )
  assertEquals(view.el.textContent, '')
  mode.set(1)
  assertEquals(view.el.textContent, 'text')
  mode.set(2)
  assertEquals(view.el.textContent, 'ab')
  mode.set(0)
  assertEquals(view.el.textContent, '')
  view.unmount()
})

Deno.test('each: keyed — add, remove, reorder preserve nodes', () => {
  const items = signal([{ id: 1, text: 'a' }, { id: 2, text: 'b' }, { id: 3, text: 'c' }])
  const view = mount(() => ul(each(items, (item) => li(item.text))))
  const [liA, liB, liC] = view.queryAll('li')
  assertEquals(view.el.textContent, 'abc')

  items.set([{ id: 3, text: 'c' }, { id: 1, text: 'a' }]) // remove b, reorder
  const lis = view.queryAll('li')
  assertEquals(view.el.textContent, 'ca')
  assert(lis[0] === liC, 'row 3 node reused')
  assert(lis[1] === liA, 'row 1 node reused')
  assert(!liB.isConnected, 'row 2 removed')

  items.update((l) => [...l, { id: 4, text: 'd' }])
  assertEquals(view.el.textContent, 'cad')
  view.unmount()
})

Deno.test('each: removed row scope is disposed', () => {
  const items = signal([{ id: 1 }])
  let clicks = 0
  const view = mount(() => div(each(items, () => button({ events: { click: () => clicks++ } }))))
  const btn = view.query('button')
  fire(btn, 'click')
  items.set([])
  fire(btn, 'click')
  assertEquals(clicks, 1)
  view.unmount()
})

Deno.test('each: per-item signals give row-level granularity', () => {
  const makeTodo = (id, text) => ({ id, text, done: signal(false) })
  const todos = signal([makeTodo(1, 'a'), makeTodo(2, 'b')])
  const view = mount(() => ul(each(todos, (todo) => li({ class: { done: todo.done } }, todo.text))))
  const first = view.query('li')
  todos.peek()[0].done.set(true) // no list update — row updates itself
  assert(first.classList.contains('done'))
  assert(view.query('li') === first)
  view.unmount()
})

Deno.test('match: branches by key, payload pairs, fallback', () => {
  const state = signal('loading')
  const view = mount(() =>
    div(match(state, {
      loading: () => span('spinner'),
      error: (err) => p(['failed: ', String(err)]),
      _: () => 'unknown',
    }))
  )
  assertEquals(view.el.textContent, 'spinner')
  state.set(['error', 'timeout'])
  assertEquals(view.el.textContent, 'failed: timeout')
  state.set('whatever')
  assertEquals(view.el.textContent, 'unknown')
  view.unmount()
})

Deno.test('onMount: fires after attach, disposer runs on unmount', async () => {
  let mounted = null
  let cleaned = 0
  const view = mount(() =>
    div(onMount(span('x'), (node) => {
      mounted = node.isConnected
      return () => cleaned++
    }))
  )
  await tick()
  assertEquals(mounted, true)
  view.unmount()
  assertEquals(cleaned, 1)
})

Deno.test('onMount: cancelled if scope is disposed before attach', async () => {
  const show = signal(true)
  let fired = 0
  const view = mount(() => div(when(show, (s) => s ? onMount(span('x'), () => fired++) : null)))
  show.set(false) // dispose branch before the mount microtask runs
  await tick()
  assertEquals(fired, 0)
  view.unmount()
})

Deno.test('portal: renders into target, removed on scope dispose', () => {
  const show = signal(true)
  const target = document.createElement('div')
  document.body.appendChild(target)
  const view = mount(() => div(when(show, (s) => s ? portal(target, span('floating')) : null)))
  assertEquals(target.textContent, 'floating')
  show.set(false)
  assertEquals(target.textContent, '')
  view.unmount()
  target.remove()
})
