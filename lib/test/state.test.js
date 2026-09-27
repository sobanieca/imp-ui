import { component, mount } from 'imp'
import { button, div, html, li, span, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText, settled } from './shadow.js'
import { collectStatesFrom, statesProvidedBy } from '../src/state.js'

const probe = component('state-probe', { setup: (self, run) => run(self) })

const probeRoot = () => document.querySelector('state-probe').shadowRoot

const hostedState = (name, initialValue) => {
  let state
  mount(document.body, probe((self) => void (state = initState(self, name, initialValue))))
  return state
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('initState returns a state with the initial value', () => {
  const user = hostedState('t1.user', { name: 'Ada' })
  expect(user.get()).toEqual({ name: 'Ada' })
})

test('set replaces the value and get reflects it', () => {
  const count = hostedState('t2.count', 1)
  count.set(2)
  expect(count.get()).toEqual(2)
})

test('set with a spread object replaces object state', () => {
  const user = hostedState('t3.user', { name: 'Ada', role: 'admin' })
  user.set({ ...user.get(), name: 'Grace' })
  expect(user.get()).toEqual({ name: 'Grace', role: 'admin' })
})

test('watch runs immediately and on every set', () => {
  const count = hostedState('t4.count', 0)
  const seen = []
  mount(document.body, probe(() => void count.watch((value) => seen.push(value))))
  count.set(1)
  count.set(2)
  expect(seen).toEqual([0, 1, 2])
})

test('watch returns an unsubscribe function', () => {
  const count = hostedState('t5.count', 0)
  const seen = []
  let off
  mount(
    document.body,
    probe(() => {
      off = count.watch((value) => seen.push(value))
    }),
  )
  off()
  count.set(1)
  expect(seen).toEqual([0])
})

test('set is a no-op when the value is identical', () => {
  const user = hostedState('t6.user', { name: 'Ada' })
  let runs = 0
  mount(document.body, probe(() => void user.watch(() => runs++)))
  user.set(user.get())
  expect(runs).toEqual(1)
})

test('set is a no-op when a fresh value is structurally equal', () => {
  const user = hostedState('t6b.user', { name: 'Ada', tags: ['x'] })
  let runs = 0
  mount(document.body, probe(() => void user.watch(() => runs++)))
  user.set({ name: 'Ada', tags: ['x'] })
  expect(runs).toEqual(1)
  user.set({ name: 'Grace', tags: ['x'] })
  expect(runs).toEqual(2)
})

test('stored state values are deeply frozen', () => {
  const user = hostedState('t6c.user', { name: 'Ada', tags: ['x'] })
  expect(Object.isFrozen(user.get())).toBeTruthy()
  expect(Object.isFrozen(user.get().tags)).toBeTruthy()
  expect(() => {
    user.get().name = 'Grace'
  }).toThrow()
})

test('useState reaches the state that initState created', () => {
  let created
  let used
  const reader = component('t7-reader', {
    setup: (self) => void (used = useState(self, 't7.theme')),
  })
  mount(
    document.body,
    probe((self) => {
      created = initState(self, 't7.theme', 'dark')
      return reader()
    }),
  )
  used.set('light')
  expect(created.get()).toEqual('light')
  expect(used.get()).toEqual('light')
})

test('useState resolves inside a mounted component', () => {
  const reader = component('t8-reader', {
    setup: (self) => div(useState(self, 't8.message').text()),
  })
  mount(
    document.body,
    probe((self) => {
      initState(self, 't8.message', 'hello')
      return reader()
    }),
  )
  expect(renderedText(document.body)).toEqual('hello')
})

test('useState throws for uninitialized state', () => {
  let failure = null
  mount(
    document.body,
    probe((self) => {
      try {
        useState(self, 't9.missing')
      } catch (error) {
        failure = error
      }
    }),
  )
  expect(failure?.message).toContain("no state 't9.missing' is initialized")
})

test('state names must be namespaced with a dot', () => {
  const problems = []
  mount(
    document.body,
    probe((self) => {
      for (
        const attempt of [
          () => initState(self, 'user', 1),
          () => useState(self, 'user'),
          () => initState(self, 'user.', 1),
          () => initState(self, 42, 1),
        ]
      ) {
        try {
          attempt()
        } catch (error) {
          problems.push(error.message)
        }
      }
    }),
  )
  expect(problems[0]).toContain('must include a namespace')
  expect(problems[1]).toContain('must include a namespace')
  expect(problems[2]).toContain('must include a namespace')
  expect(problems[3]).toContain('must be a namespaced string')
})

test('initState twice in the same component scope throws', () => {
  let failure = null
  mount(
    document.body,
    probe((self) => {
      initState(self, 't10d.value', 'first')
      try {
        initState(self, 't10d.value', 'second')
      } catch (error) {
        failure = error
      }
    }),
  )
  expect(failure?.message).toContain("state 't10d.value' is already initialized")
})

test('useState in onRemove throws for a name that setup never resolved', async () => {
  let failure
  const screen = component('t9c-screen', {
    setup: () => div('screen'),
    onRemove: (self) => {
      try {
        useState(self, 't9c.project')
      } catch (error) {
        failure = error
      }
    },
  })
  let host
  mount(
    document.body,
    probe((self) => {
      initState(self, 't9c.project', null)
      host = screen()
      return host
    }),
  )
  host.remove()
  await settled()
  expect(failure?.message).toContain('<t9c-screen> has left the page')
  expect(failure?.message).toContain('resolve it in setup')
})

test('useState in onRemove returns the handle that setup resolved', async () => {
  const screen = component('t9d-screen', {
    setup: (self, id) => {
      useState(self, 't9d.project').set({ id })
      return div(id)
    },
    onRemove: (self) => useState(self, 't9d.project').set(null),
  })
  let project
  let host
  mount(
    document.body,
    probe((self) => {
      project = initState(self, 't9d.project', null)
      host = screen('p1')
      return host
    }),
  )
  expect(project.get()).toEqual({ id: 'p1' })
  host.remove()
  await settled()
  expect(project.get()).toEqual(null)
})

test('initState and useState need self as their first argument', () => {
  expect(() => initState('t9b.count', 0)).toThrow('the first argument must be the self')
  expect(() => useState('t9b.count')).toThrow('the first argument must be the self')
  expect(() => useState({}, 't9b.count')).toThrow('the first argument must be the self')
})

test('useState returns one handle per name during a mount', () => {
  let first
  let second
  mount(
    document.body,
    probe((self) => {
      initState(self, 't11.count', 0)
      first = useState(self, 't11.count')
      second = useState(self, 't11.count')
    }),
  )
  expect(first === second).toBeTruthy()
})

test('useState after initState returns the state that the component owns', async () => {
  let owned
  let reached
  let removed
  const owner = component('t11b-owner', {
    setup: (self) => {
      owned = initState(self, 't11b.count', 1)
      reached = useState(self, 't11b.count')
      return div()
    },
    onRemove: (self) => {
      removed = useState(self, 't11b.count')
    },
  })
  const host = owner()
  mount(document.body, host)
  expect(reached === owned).toBeTruthy()
  host.remove()
  await settled()
  expect(removed === owned).toBeTruthy()
})

test('watch(self, fn) stops when the component unmounts', async () => {
  const count = hostedState('t11d.count', 0)
  const seen = []
  const watcher = component('t11d-watcher', {
    setup: (self) => {
      count.watch(self, (value) => seen.push(value))
      return div('watching')
    },
  })
  mount(document.body, watcher())
  count.set(1)
  document.body.replaceChildren()
  await settled()
  count.set(2)
  expect(seen).toEqual([0, 1])
})

test('watch(self, fn) works after an await and throws once the mount has ended', async () => {
  const count = hostedState('t11e.count', 0)
  const seen = []
  let failure = null
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const watcher = component('t11e-watcher', {
    setup: async (self) => {
      await Promise.resolve()
      count.watch(self, (value) => seen.push(value))
      await gate
      try {
        count.watch(self, () => {})
      } catch (error) {
        failure = error
      }
      return div('late')
    },
  })
  const host = watcher()
  mount(document.body, host)
  await settled()
  count.set(1)
  host.remove()
  await settled()
  release()
  await settled()
  count.set(2)
  expect(seen).toEqual([0, 1])
  expect(failure?.message).toContain('has left the page')
  expect(() => count.watch({}, () => {})).toThrow('the first argument must be the self')
  expect(() => count.watch(42)).toThrow('watch takes a subscriber function, or self')
})

test('watch works anywhere and stops through the function it returns', () => {
  const count = hostedState('t11c.count', 0)
  const seen = []
  const stop = count.watch((value) => seen.push(value))
  count.set(1)
  stop()
  count.set(2)
  expect(seen).toEqual([0, 1])
})

test('text built outside a mount stays inert until mounted', () => {
  const count = hostedState('t11b.count', 0)
  const node = div(count.text())
  count.set(1)
  expect(node.textContent).toEqual('')
  mount(document.body, probe(() => node))
  expect(renderedText(document.body)).toEqual('1')
  count.set(2)
  expect(renderedText(document.body)).toEqual('2')
})

test('view and each built outside a mount stay inert until mounted', () => {
  const items = hostedState('t11c.items', ['a'])
  const node = div(
    items.view((current) => span(`${current.length}!`)),
    ul(items.each((item) => li(item))),
  )
  expect(node.textContent).toEqual('')
  mount(document.body, probe(() => node))
  expect(renderedText(document.body)).toEqual('1!a')
  items.set(['a', 'b'])
  expect(renderedText(document.body)).toEqual('2!ab')
})

test('text renders the value and updates on set', () => {
  const name = hostedState('t12.name', 'Ada')
  mount(document.body, probe(() => div(name.text())))
  expect(renderedText(document.body)).toEqual('Ada')
  name.set('Grace')
  expect(renderedText(document.body)).toEqual('Grace')
})

test('text accepts a selector and blanks nullish output', () => {
  const user = hostedState('t13.user', { name: 'Ada' })
  mount(document.body, probe(() => div(user.text((value) => value.name))))
  expect(renderedText(document.body)).toEqual('Ada')
  user.set({})
  expect(renderedText(document.body)).toEqual('')
})

test('each renders list items and re-renders on set', () => {
  const todos = hostedState('t14.todos', ['a', 'b'])
  mount(document.body, probe(() => ul(todos.each((item) => li(item)))))
  const itemTexts = () =>
    [...probeRoot().querySelectorAll('li')].map((element) => element.textContent)
  expect(itemTexts()).toEqual(['a', 'b'])
  todos.set([...todos.get(), 'c'])
  expect(itemTexts()).toEqual(['a', 'b', 'c'])
  todos.set([])
  expect(itemTexts()).toEqual([])
})

test('each keeps surrounding siblings intact', () => {
  const items = hostedState('t15.items', ['x'])
  mount(document.body, probe(() => div('before', items.each((item) => div(item)), 'after')))
  items.set(['y', 'z'])
  expect(renderedText(document.body)).toEqual('beforeyzafter')
})

test('each passes the item index to the renderer', () => {
  const letters = hostedState('t16.letters', ['a', 'b'])
  mount(document.body, probe(() => div(letters.each((item, index) => div(`${index}:${item}`)))))
  expect(renderedText(document.body)).toEqual('0:a1:b')
})

test('set with a function produces the next value from the current one', () => {
  const count = hostedState('t25.count', 1)
  count.set((value) => value + 1)
  expect(count.get()).toEqual(2)
  const todos = hostedState('t25.todos', ['a'])
  todos.set((items) => [...items, 'b'])
  expect(todos.get()).toEqual(['a', 'b'])
})

test('set with a function notifies subscribers like a plain set', () => {
  const count = hostedState('t26.count', 0)
  const seen = []
  mount(document.body, probe(() => void count.watch((value) => seen.push(value))))
  count.set((value) => value + 1)
  expect(seen).toEqual([0, 1])
})

test('set with a function producing an identical value notifies nobody', () => {
  const count = hostedState('t27.count', 5)
  const seen = []
  mount(document.body, probe(() => void count.watch((value) => seen.push(value))))
  count.set((value) => value)
  expect(seen).toEqual([5])
})

test('view re-renders its region on set', () => {
  const user = hostedState('t28.user', { name: 'Ada', role: 'admin' })
  mount(
    document.body,
    probe(() => div(user.view((value) => div(`${value.name} (${value.role})`)))),
  )
  expect(renderedText(document.body)).toEqual('Ada (admin)')
  user.set({ name: 'Grace', role: 'user' })
  expect(renderedText(document.body)).toEqual('Grace (user)')
})

test('view renders nothing for null or false output', () => {
  const loggedIn = hostedState('t29.loggedIn', false)
  mount(
    document.body,
    probe(() => div('before', loggedIn.view((value) => value && div('profile')), 'after')),
  )
  expect(renderedText(document.body)).toEqual('beforeafter')
  loggedIn.set(true)
  expect(renderedText(document.body)).toEqual('beforeprofileafter')
  loggedIn.set(false)
  expect(renderedText(document.body)).toEqual('beforeafter')
})

test('view requires a render function', () => {
  const count = hostedState('t30.count', 0)
  expect(() => count.view(div('static'))).toThrow('view needs a function')
})

test('view works on computed states', () => {
  const todos = hostedState('t31.todos', ['a', 'b'])
  const summary = computed([todos], (items) => items.length)
  mount(document.body, probe(() => div(summary.view((count) => div(`${count} left`)))))
  expect(renderedText(document.body)).toEqual('2 left')
  todos.set([])
  expect(renderedText(document.body)).toEqual('0 left')
})

test('a computed state rejects the updater form of set too', () => {
  const count = hostedState('t32.count', 1)
  const doubled = computed([count], (value) => value * 2)
  expect(() => doubled.set((value) => value + 1)).toThrow('read-only')
})

test('a mounted component reacts to page-wide state changes', () => {
  const count = hostedState('t17.count', 0)
  mount(document.body, probe(() => div({ id: 'child' }, count.text())))
  count.set(5)
  expect(probeRoot().querySelector('#child').textContent).toEqual('5')
})

test('bindings and a watch with self end when the subscribing component unmounts', async () => {
  const count = hostedState('t18.count', 0)
  const seen = []
  let node
  const watcher = component('t18-watcher', {
    setup: (self) => {
      node = count.text()
      count.watch(self, (value) => seen.push(value))
      return div(node)
    },
  })
  mount(document.body, watcher())
  count.set(1)
  document.body.replaceChildren()
  await settled()
  count.set(2)
  expect(seen).toEqual([0, 1])
  expect(node.data).toEqual('1')
})

test('computed combines several states into one', () => {
  const first = hostedState('t19.first', 'Ada')
  const last = hostedState('t19.last', 'Lovelace')
  const full = computed([first, last], (firstName, lastName) => `${firstName} ${lastName}`)
  expect(full.get()).toEqual('Ada Lovelace')
  const seen = []
  mount(document.body, probe(() => void full.watch((value) => seen.push(value))))
  first.set('Grace')
  expect(seen).toEqual(['Ada Lovelace', 'Grace Lovelace'])
})

test('a computed result is deeply frozen', () => {
  const items = hostedState('t19b.items', ['a'])
  const summary = computed([items], (list) => ({ count: list.length, list: [...list] }))
  const result = summary.get()
  expect(Object.isFrozen(result)).toBeTruthy()
  expect(Object.isFrozen(result.list)).toBeTruthy()
  expect(() => {
    result.count = 99
  }).toThrow()
})

test('a computed state notifies only when the computed outcome changes', () => {
  const user = hostedState('t20.user', { name: 'Ada', theme: 'dark' })
  const theme = computed([user], (current) => current.theme)
  const seen = []
  mount(document.body, probe(() => void theme.watch((value) => seen.push(value))))
  user.set({ ...user.get(), name: 'Grace' })
  expect(seen).toEqual(['dark'])
  user.set({ ...user.get(), theme: 'light' })
  expect(seen).toEqual(['dark', 'light'])
})

test('computed text updates in the DOM and ends with its component', async () => {
  const price = hostedState('t21.price', 2)
  const quantity = hostedState('t21.quantity', 3)
  const total = computed([price, quantity], (priceValue, count) => priceValue * count)
  let node
  mount(
    document.body,
    probe(() => {
      node = total.text()
      return div(node)
    }),
  )
  expect(node.data).toEqual('6')
  price.set(5)
  expect(node.data).toEqual('15')
  document.body.replaceChildren()
  await settled()
  price.set(10)
  quantity.set(10)
  expect(node.data).toEqual('15')
})

test('a computed state cannot be set directly', () => {
  const count = hostedState('t22.count', 1)
  const doubled = computed([count], (value) => value * 2)
  expect(() => doubled.set(4)).toThrow('read-only')
})

test('computed validates its arguments', () => {
  const count = hostedState('t23.count', 1)
  expect(() => computed([], () => 0)).toThrow('non-empty array of states')
  expect(() => computed([{}], () => 0)).toThrow('non-empty array of states')
  expect(() => computed([count], 'nope')).toThrow('function computing')
})

test('computed states compose', () => {
  const width = hostedState('t24.width', 1)
  const height = hostedState('t24.height', 2)
  const area = computed([width, height], (w, h) => w * h)
  const doubledArea = computed([area], (value) => value * 2)
  expect(doubledArea.get()).toEqual(4)
  const seen = []
  mount(document.body, probe(() => void doubledArea.watch((value) => seen.push(value))))
  width.set(3)
  expect(seen).toEqual([4, 12])
})

test('bindings nested in an each render survive re-renders', () => {
  const items = hostedState('t33.items', ['a'])
  const label = hostedState('t33.label', 'L')
  mount(document.body, probe(() => ul(items.each((item) => li(item, label.text())))))
  expect(renderedText(document.body)).toEqual('aL')
  items.set(['a', 'b'])
  expect(renderedText(document.body)).toEqual('aLbL')
  label.set('X')
  expect(renderedText(document.body)).toEqual('aXbX')
})

test('nested bindings are disposed when their region re-renders', () => {
  const items = hostedState('t34.items', ['a'])
  const label = hostedState('t34.label', 'L')
  let runs = 0
  mount(
    document.body,
    probe(() =>
      div(items.each((item) =>
        div(
          item,
          label.text((value) => {
            runs++
            return value
          }),
        )
      ))
    ),
  )
  expect(runs).toEqual(1)
  items.set(['a', 'b'])
  expect(runs).toEqual(3)
  label.set('X')
  expect(runs).toEqual(5)
})

test('a view nested inside a view re-renders and cleans up', () => {
  const outer = hostedState('t35.outer', 'o1')
  const inner = hostedState('t35.inner', 'i1')
  mount(
    document.body,
    probe(() => div(outer.view((value) => div(value, inner.view((nested) => span(nested)))))),
  )
  expect(renderedText(document.body)).toEqual('o1i1')
  inner.set('i2')
  expect(renderedText(document.body)).toEqual('o1i2')
  outer.set('o2')
  expect(renderedText(document.body)).toEqual('o2i2')
  inner.set('i3')
  expect(renderedText(document.body)).toEqual('o2i3')
})

test('nested bindings end with the subscribing component', async () => {
  const items = hostedState('t36.items', ['a'])
  const label = hostedState('t36.label', 'L')
  const seen = []
  mount(
    document.body,
    probe(() =>
      div(items.each((item) =>
        div(
          item,
          label.text((value) => {
            seen.push(value)
            return value
          }),
        )
      ))
    ),
  )
  document.body.replaceChildren()
  await settled()
  label.set('X')
  expect(seen).toEqual(['L'])
})

test('keyed each keeps the DOM of unchanged items', () => {
  const todos = hostedState('t38.todos', [{ id: 1, text: 'a' }, { id: 2, text: 'b' }])
  mount(document.body, probe(() => ul(todos.each((todo) => li(todo.text), (todo) => todo.id))))
  const [first, second] = probeRoot().querySelectorAll('li')
  todos.set([...todos.get(), { id: 3, text: 'c' }])
  const items = [...probeRoot().querySelectorAll('li')]
  expect(items.length).toEqual(3)
  expect(items[0] === first).toBeTruthy()
  expect(items[1] === second).toBeTruthy()
  expect(renderedText(document.body)).toEqual('abc')
})

test('keyed each reorders items without rebuilding them', () => {
  const todos = hostedState('t39.todos', [{ id: 1, text: 'a' }, { id: 2, text: 'b' }])
  mount(document.body, probe(() => ul(todos.each((todo) => li(todo.text), (todo) => todo.id))))
  const [first, second] = probeRoot().querySelectorAll('li')
  todos.set([todos.get()[1], todos.get()[0]])
  const items = [...probeRoot().querySelectorAll('li')]
  expect(items[0] === second).toBeTruthy()
  expect(items[1] === first).toBeTruthy()
  expect(renderedText(document.body)).toEqual('ba')
})

test('keyed each re-renders only the item that changed', () => {
  const todos = hostedState('t40.todos', [{ id: 1, done: false }, { id: 2, done: false }])
  let renders = 0
  mount(
    document.body,
    probe(() =>
      ul(todos.each((todo) => {
        renders++
        return li(todo.done ? 'x' : 'o')
      }, (todo) => todo.id))
    ),
  )
  expect(renders).toEqual(2)
  const [first] = probeRoot().querySelectorAll('li')
  todos.set(todos.get().map((todo) => todo.id === 2 ? { ...todo, done: true } : { ...todo }))
  expect(renders).toEqual(3)
  const items = [...probeRoot().querySelectorAll('li')]
  expect(items[0] === first).toBeTruthy()
  expect(renderedText(document.body)).toEqual('ox')
})

test('keyed each disposes nested bindings of removed items only', () => {
  const items = hostedState('t41.items', [{ id: 1 }, { id: 2 }])
  const label = hostedState('t41.label', 'L')
  let runs = 0
  mount(
    document.body,
    probe(() =>
      div(items.each((item) =>
        div(
          item.id,
          label.text((value) => {
            runs++
            return value
          }),
        ), (item) => item.id))
    ),
  )
  expect(runs).toEqual(2)
  items.set([items.get()[0]])
  label.set('X')
  expect(runs).toEqual(3)
})

test('keyed each puts the focus back into an item that it renders again', () => {
  const items = hostedState('t42f.items', [{ id: 1, done: false }, { id: 2, done: false }])
  mount(
    document.body,
    probe(() =>
      ul(items.each(
        (item) => li(span(String(item.id)), button({ 'aria-pressed': String(item.done) }, 'Done')),
        (item) => item.id,
      ))
    ),
  )
  const root = probeRoot()
  root.querySelectorAll('button')[1].focus()
  items.set([{ id: 1, done: false }, { id: 2, done: true }])
  expect(root.activeElement === root.querySelectorAll('button')[1]).toEqual(true)
  expect(root.activeElement.getAttribute('aria-pressed')).toEqual('true')
})

test('keyed each moves the focus to the next item when the focused item goes away', () => {
  const items = hostedState('t42g.items', [{ id: 1 }, { id: 2 }, { id: 3 }])
  mount(
    document.body,
    probe(() =>
      ul(items.each(
        (item) => li(span(String(item.id)), button({ 'data-id': String(item.id) }, 'Delete')),
        (item) => item.id,
      ))
    ),
  )
  const root = probeRoot()
  root.querySelectorAll('button')[1].focus()
  items.set([{ id: 1 }, { id: 3 }])
  expect(root.activeElement?.dataset.id).toEqual('3')
  items.set([{ id: 1 }])
  expect(root.activeElement?.dataset.id).toEqual('1')
})

test('keyed each warns on duplicate keys and still renders every item', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const items = hostedState('t42.items', [{ id: 1, text: 'a' }, { id: 1, text: 'b' }])
    mount(document.body, probe(() => ul(items.each((item) => li(item.text), (item) => item.id))))
    expect(renderedText(document.body)).toEqual('ab')
    expect(errors.length).toEqual(1)
    expect(errors[0].includes('duplicate key')).toBeTruthy()
  } finally {
    console.error = originalError
  }
})

test('each reports a non-array value and renders nothing', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const items = hostedState('t43.items', 'nope')
    mount(document.body, probe(() => div('b', items.each((item) => div(item)), 'a')))
    expect(renderedText(document.body)).toEqual('ba')
    expect(errors.length).toEqual(1)
    expect(errors[0].includes('needs an array')).toBeTruthy()
    items.set(null)
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('each validates its arguments', () => {
  const items = hostedState('t44.items', [])
  expect(() => items.each('nope')).toThrow('each needs a function')
  expect(() => items.each(() => div(), 'nope')).toThrow('stable key')
})

test('a state update cycle throws instead of looping forever', () => {
  const a = hostedState('t45.a', { n: 0 })
  const b = hostedState('t45.b', { n: 0 })
  mount(
    document.body,
    probe(() => {
      a.watch((value) => {
        if (value.n > 0) b.set({ n: value.n + 1 })
      })
      b.watch((value) => {
        if (value.n > 0) a.set({ n: value.n + 1 })
      })
    }),
  )
  expect(() => a.set({ n: 1 })).toThrow('cycle')
  expect(() => b.set({ n: b.get().n + 1 })).toThrow('cycle')
})

test('a throwing subscriber does not block other subscribers', () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const count = hostedState('t46.count', 0)
    const seen = []
    mount(
      document.body,
      probe(() => {
        count.watch((value) => {
          if (value > 0) throw new Error('subscriber boom')
        })
        count.watch((value) => seen.push(value))
      }),
    )
    count.set(1)
    expect(seen).toEqual([0, 1])
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('plain data values pass validation silently', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const data = hostedState('t48.data', { name: 'Ada', tags: ['a', 'b'], nested: { ok: true } })
    data.set([1, 'two', null, undefined, { deep: [{ n: 3 }] }])
    data.set('plain')
    data.set(42)
    expect(errors.length).toEqual(0)
  } finally {
    console.error = originalError
  }
})

test('initState reports a non-plain initial value', () => {
  class Session {}
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const session = hostedState('t49.session', new Session())
    expect(errors.length).toEqual(1)
    expect(errors[0].includes(`state 't49.session'`)).toBeTruthy()
    expect(errors[0].includes('is a Session')).toBeTruthy()
    expect(errors[0].includes('plain data')).toBeTruthy()
    expect(session.get() instanceof Session).toBeTruthy()
  } finally {
    console.error = originalError
  }
})

test('dates and temporal values are valid state values', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    hostedState('t55.dates', {
      created: new Date(),
      day: Temporal.PlainDate.from('2026-07-17'),
      at: Temporal.Instant.from('2026-07-17T12:00:00Z'),
      pause: Temporal.Duration.from({ minutes: 5 }),
      history: [new Date(0), Temporal.PlainDateTime.from('2026-07-17T08:30')],
      endpoint: new URL('https://example.com/api'),
      pattern: /^\d+$/u,
    })
    expect(errors.length).toEqual(0)
  } finally {
    console.error = originalError
  }
})

test('keyed each keeps DOM for items whose dates are content-equal', () => {
  let renders = 0
  const items = hostedState('t56.items', [{ id: 1, due: new Date(1000) }])
  mount(
    document.body,
    probe(() =>
      ul(items.each((item) => {
        renders++
        return li(item.id)
      }, (item) => item.id))
    ),
  )
  expect(renders).toEqual(1)
  items.set([{ id: 1, due: new Date(1000) }])
  expect(renders).toEqual(1)
  items.set([{ id: 1, due: new Date(2000) }])
  expect(renders).toEqual(2)
})

test('URLs and regexes compare by content in keyed each', () => {
  let renders = 0
  const links = hostedState('t58.links', [
    { id: 1, href: new URL('https://example.com/a'), match: /a/i },
  ])
  mount(
    document.body,
    probe(() =>
      ul(links.each((link) => {
        renders++
        return li(link.id)
      }, (link) => link.id))
    ),
  )
  expect(renders).toEqual(1)
  links.set([{ id: 1, href: new URL('https://example.com/a'), match: /a/i }])
  expect(renders).toEqual(1)
  links.set([{ id: 1, href: new URL('https://example.com/b'), match: /a/i }])
  expect(renders).toEqual(2)
  links.set([{ id: 1, href: new URL('https://example.com/b'), match: /a/g }])
  expect(renders).toEqual(3)
})

test('computed does not notify when temporal results are content-equal', () => {
  const day = hostedState('t57.day', { iso: '2026-07-17' })
  const asDate = computed([day], (value) => Temporal.PlainDate.from(value.iso))
  const seen = []
  mount(document.body, probe(() => void asDate.watch((value) => seen.push(value.toString()))))
  day.set({ iso: '2026-07-17' })
  expect(seen).toEqual(['2026-07-17'])
  day.set({ iso: '2026-07-18' })
  expect(seen).toEqual(['2026-07-17', '2026-07-18'])
})

test('set reports a nested non-plain value with its path', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const user = hostedState('t50.user', { name: 'Ada' })
    user.set({ name: 'Ada', sessions: [{ startedAt: new Map() }] })
    expect(errors.length).toEqual(1)
    expect(errors[0].includes(`at 'sessions[0].startedAt'`)).toBeTruthy()
    expect(errors[0].includes('is a Map')).toBeTruthy()
  } finally {
    console.error = originalError
  }
})

test('set reports a value that references itself in a cycle', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const node = hostedState('t51.node', { name: 'root' })
    const cyclic = { name: 'root' }
    cyclic.self = cyclic
    node.set(cyclic)
    expect(errors.length).toEqual(1)
    expect(errors[0].includes(`at 'self'`)).toBeTruthy()
    expect(errors[0].includes('cycle')).toBeTruthy()
  } finally {
    console.error = originalError
  }
})

test('an updater resolving to a function is reported', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const value = hostedState('t52.value', 1)
    value.set(() => () => 2)
    expect(errors.length).toEqual(1)
    expect(errors[0].includes('is a function')).toBeTruthy()
  } finally {
    console.error = originalError
  }
})

test('storing another state is reported with a hint', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const source = hostedState('t53.source', 1)
    const target = hostedState('t53.target', 0)
    target.set({ source })
    expect(errors.length).toEqual(1)
    expect(errors[0].includes('is another state')).toBeTruthy()
  } finally {
    console.error = originalError
  }
})

test('a value shared twice without a cycle passes validation', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const shared = { n: 1 }
    hostedState('t54.pair', { left: shared, right: shared })
    expect(errors.length).toEqual(0)
  } finally {
    console.error = originalError
  }
})

test('keyed each skips an item whose render throws', () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const items = hostedState('t47.items', [{ id: 1, text: 'ok' }])
    mount(
      document.body,
      probe(() =>
        ul(items.each((item) => {
          if (item.text === 'bad') throw new Error('render boom')
          return li(item.text)
        }, (item) => item.id))
      ),
    )
    items.set([...items.get(), { id: 2, text: 'bad' }, { id: 3, text: 'also ok' }])
    expect(renderedText(document.body)).toEqual('okalso ok')
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('a state prop value binds an attribute and null removes it', () => {
  const hint = hostedState('t48.hint', 'save')
  let node
  mount(
    document.body,
    probe(() => {
      node = div({ 'data-hint': hint })
      return node
    }),
  )
  expect(node.getAttribute('data-hint')).toEqual('save')
  hint.set('done')
  expect(node.getAttribute('data-hint')).toEqual('done')
  hint.set(null)
  expect(node.hasAttribute('data-hint')).not.toBeTruthy()
})

test('a state prop value binds a property', () => {
  const busy = hostedState('t49.busy', false)
  let node
  mount(
    document.body,
    probe(() => {
      node = button({ disabled: busy }, 'go')
      return node
    }),
  )
  expect(node.disabled).not.toBeTruthy()
  busy.set(true)
  expect(node.disabled).toBeTruthy()
})

test('a computed prop value binds class and updates on set', () => {
  const theme = hostedState('t50.theme', 'dark')
  const themeClass = computed([theme], (value) => `card card--${value}`)
  let node
  mount(
    document.body,
    probe(() => {
      node = div({ class: themeClass })
      return node
    }),
  )
  expect(node.className).toEqual('card card--dark')
  theme.set('light')
  expect(node.className).toEqual('card card--light')
})

test('a bound class object drops names that turn falsy', () => {
  const active = hostedState('t51.active', true)
  const itemClass = computed([active], (value) => ({ item: true, active: value }))
  let node
  mount(
    document.body,
    probe(() => {
      node = div({ class: itemClass })
      return node
    }),
  )
  expect(node.className).toEqual('item active')
  active.set(false)
  expect(node.className).toEqual('item')
})

test('a bound style object resets entries a new value omits', () => {
  const emphasized = hostedState('t52.emphasized', true)
  const emphasisStyle = computed(
    [emphasized],
    (on) => on ? { fontWeight: 'bold', color: 'red' } : { color: 'blue' },
  )
  let node
  mount(
    document.body,
    probe(() => {
      node = div({ style: emphasisStyle })
      return node
    }),
  )
  expect(node.style.getPropertyValue('font-weight')).toEqual('bold')
  emphasized.set(false)
  expect(node.style.getPropertyValue('font-weight')).toEqual('')
  expect(node.style.getPropertyValue('color')).toEqual('blue')
})

test('a state prop value built outside a mount binds when mounted', () => {
  const theme = hostedState('t53.theme', 'dark')
  const node = div({ class: theme })
  expect(node.hasAttribute('class')).toEqual(false)
  mount(document.body, probe(() => node))
  expect(node.getAttribute('class')).toEqual('dark')
  theme.set('light')
  expect(node.getAttribute('class')).toEqual('light')
})

test('bindings mounted directly through mount() go live and end with its unmount', () => {
  const count = hostedState('t72.count', 0)
  const node = span(count.text())
  const unmount = mount(document.body, div(node))
  expect(node.textContent).toEqual('0')
  count.set(1)
  expect(node.textContent).toEqual('1')
  unmount()
  count.set(2)
  expect(node.textContent).toEqual('1')
})

test('a binding that is never mounted never subscribes', () => {
  const count = hostedState('t73.count', 0)
  const node = count.text()
  count.set(1)
  expect(node.data).toEqual('')
})

test('bound props end with the subscribing component', async () => {
  const hint = hostedState('t54.hint', 'a')
  let node
  mount(
    document.body,
    probe(() => {
      node = div({ 'data-hint': hint })
      return node
    }),
  )
  document.body.replaceChildren()
  await settled()
  hint.set('b')
  expect(node.getAttribute('data-hint')).toEqual('a')
})

test('a state passed as an element argument warns and is skipped', () => {
  const warn = spy(console, 'warn', () => {})
  const count = hostedState('t55.count', 1)
  const node = div(count)
  expect(node.childNodes.length).toEqual(0)
  expect(node.attributes.length).toEqual(0)
  expect(warn.calls.length).toEqual(1)
  expect(warn.calls[0][0]).toContain('passed directly')
})

test('useState resolves from the component inside a re-rendered view', () => {
  const toggle = hostedState('t37.toggle', false)
  const owner = component('t37-owner', {
    setup: (self) => {
      initState(self, 't37.value', 'scoped')
      return div(toggle.view(() => useState(self, 't37.value').text()))
    },
  })
  mount(document.body, owner())
  expect(renderedText(document.body)).toEqual('scoped')
  toggle.set(true)
  expect(renderedText(document.body)).toEqual('scoped')
})

test('a computed state ignores a source set that leaves its result deep-equal', () => {
  const user = hostedState('t56.user', { address: { city: 'London' }, visits: 1 })
  const address = computed([user], (value) => value.address)
  const seen = []
  mount(document.body, probe(() => void address.watch((value) => seen.push(value))))

  user.set({ address: { city: 'London' }, visits: 2 })
  expect(seen).toEqual([{ city: 'London' }])

  user.set({ address: { city: 'Oslo' }, visits: 3 })
  expect(seen).toEqual([{ city: 'London' }, { city: 'Oslo' }])
})

test('a computed list ignores a recompute producing a deep-equal array', () => {
  const todos = hostedState('t57.todos', [{ id: 1, done: false }, { id: 2, done: true }])
  const open = computed([todos], (items) => items.filter((item) => !item.done))
  const seen = []
  mount(document.body, probe(() => void open.watch((items) => seen.push(items))))

  todos.set([{ id: 1, done: false }, { id: 2, done: true }, { id: 3, done: true }])
  expect(seen).toEqual([[{ id: 1, done: false }]])

  todos.set([{ id: 1, done: true }, { id: 2, done: true }])
  expect(seen).toEqual([[{ id: 1, done: false }], []])
})

test('an unkeyed each over a computed does not rebuild when the result is deep-equal', () => {
  const todos = hostedState('t58.todos', [{ id: 1, title: 'a', done: false }])
  const open = computed([todos], (items) => items.filter((item) => !item.done))
  mount(document.body, probe(() => ul(open.each((todo) => li(todo.title)))))

  const before = probeRoot().querySelector('li')
  todos.set([{ id: 1, title: 'a', done: false }, { id: 2, title: 'b', done: true }])
  expect(probeRoot().querySelector('li') === before).toBeTruthy()

  todos.set([{ id: 1, title: 'A', done: false }])
  expect(probeRoot().querySelector('li') === before).toEqual(false)
  expect(renderedText(probeRoot())).toEqual('A')
})

test('a computed state computes once per source set regardless of subscriber count', () => {
  const source = hostedState('t59.source', { n: 1 })
  let computeRuns = 0
  const derived = computed([source], (value) => {
    computeRuns++
    return value.n * 2
  })

  mount(
    document.body,
    probe(() => {
      for (let i = 0; i < 10; i++) derived.watch(() => {})
    }),
  )
  const afterSubscribe = computeRuns
  source.set({ n: 2 })
  expect(computeRuns - afterSubscribe).toEqual(1)
})

test('a subscribed computed serves get() from cache without recomputing', () => {
  const source = hostedState('t59b.source', { n: 1 })
  let computeRuns = 0
  const derived = computed([source], (value) => {
    computeRuns++
    return value.n * 2
  })

  derived.get()
  derived.get()
  expect(computeRuns).toEqual(2)

  mount(document.body, probe(() => void derived.watch(() => {})))
  const afterSubscribe = computeRuns
  derived.get()
  derived.get()
  expect(computeRuns).toEqual(afterSubscribe)
  expect(derived.get()).toEqual(2)
})

test('an unsubscribed computed recomputes on get()', () => {
  const source = hostedState('t59c.source', 1)
  let computeRuns = 0
  const derived = computed([source], (value) => {
    computeRuns++
    return value * 2
  })

  derived.get()
  source.set(5)
  expect(derived.get()).toEqual(10)
  expect(computeRuns).toEqual(2)
})

test('every subscriber of a computed state still sees each change', () => {
  const source = hostedState('t60.source', 1)
  const derived = computed([source], (value) => value * 2)
  const first = []
  const second = []
  mount(
    document.body,
    probe(() => {
      derived.watch((value) => first.push(value))
      derived.watch((value) => second.push(value))
    }),
  )
  source.set(2)
  source.set(3)
  expect(first).toEqual([2, 4, 6])
  expect(second).toEqual([2, 4, 6])
})

test('one component unmounting does not stop another component watching the same computed', async () => {
  const source = hostedState('t61.source', 1)
  const derived = computed([source], (value) => value * 2)
  const leaving = []
  const staying = []

  const goer = component('t61-goer', {
    setup: (self) => {
      derived.watch(self, (value) => leaving.push(value))
      return div('goer')
    },
  })
  const stayer = component('t61-stayer', {
    setup: (self) => {
      derived.watch(self, (value) => staying.push(value))
      return div('stayer')
    },
  })

  const host = div(goer(), stayer())
  mount(document.body, host)
  source.set(2)
  expect(leaving).toEqual([2, 4])
  expect(staying).toEqual([2, 4])

  host.firstChild.remove()
  await settled()

  source.set(3)
  expect(leaving).toEqual([2, 4])
  expect(staying).toEqual([2, 4, 6])
})

test('a computed state detaches from its sources when its last subscriber leaves', () => {
  const source = hostedState('t62.source', 1)
  let computeRuns = 0
  const derived = computed([source], (value) => {
    computeRuns++
    return value * 2
  })

  const stop = derived.watch(() => {})
  stop()

  const afterUnmount = computeRuns
  source.set(2)
  source.set(3)
  expect(computeRuns - afterUnmount).toEqual(0)
})

test('a computed state resubscribes correctly after all subscribers left', () => {
  const source = hostedState('t63.source', 1)
  const derived = computed([source], (value) => value * 2)

  const stop = derived.watch(() => {})
  stop()

  source.set(5)
  const seen = []
  derived.watch((value) => seen.push(value))
  expect(seen).toEqual([10])
  source.set(6)
  expect(seen).toEqual([10, 12])
})

test('calling a computed unsubscribe twice does not corrupt its source subscription', () => {
  const source = hostedState('t64.source', 1)
  const derived = computed([source], (value) => value * 2)
  const first = []
  const second = []
  let off
  mount(
    document.body,
    probe(() => {
      off = derived.watch((value) => first.push(value))
      derived.watch((value) => second.push(value))
    }),
  )
  off()
  off()
  source.set(2)
  expect(first).toEqual([2])
  expect(second).toEqual([2, 4])
})

test('text does not rewrite its node when the selected value is unchanged', () => {
  const user = hostedState('t65.user', { name: 'Ada', visits: 1 })
  let node
  mount(
    document.body,
    probe(() => {
      node = user.text((u) => u.name)
      return span(node)
    }),
  )

  let writes = 0
  const real = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Object.getPrototypeOf(node)),
    'data',
  )
  Object.defineProperty(node, 'data', {
    get() {
      return real.get.call(this)
    },
    set(value) {
      writes++
      real.set.call(this, value)
    },
  })

  user.set((u) => ({ ...u, visits: 2 }))
  user.set((u) => ({ ...u, visits: 3 }))
  expect(writes).toEqual(0)

  user.set((u) => ({ ...u, name: 'Grace' }))
  expect(writes).toEqual(1)
  expect(node.data).toEqual('Grace')
})

test('keyed each renders fragment items and keeps them updatable', () => {
  const items = hostedState('t66.items', [
    { id: 'a', label: 'first' },
    { id: 'b', label: 'second' },
  ])
  mount(
    document.body,
    probe(() => ul(items.each((item) => html(`<li>${item.label}</li>`), (item) => item.id))),
  )
  const labels = () => [...probeRoot().querySelectorAll('li')].map((node) => node.textContent)
  expect(labels()).toEqual(['first', 'second'])
  items.set([{ id: 'b', label: 'second' }, { id: 'a', label: 'first' }])
  expect(labels()).toEqual(['second', 'first'])
  items.set([{ id: 'a', label: 'first' }])
  expect(labels()).toEqual(['first'])
})

test('re-rendering a view disposes inner bindings before they see the new value', () => {
  const user = hostedState('t67.user', { name: 'ada' })
  const seen = []
  mount(
    document.body,
    probe(() =>
      user.view((current) =>
        current
          ? span(user.text((value) => {
            seen.push(value)
            return value.name
          }))
          : span('signed out')
      )
    ),
  )
  user.set(null)
  expect(seen).toEqual([{ name: 'ada' }])
  expect(renderedText(probeRoot())).toEqual('signed out')
})

test('collectStatesFrom reports every state in scope at a node, nearest provider first', () => {
  const leaf = component('collect-leaf', {
    setup: (self) => {
      initState(self, 'collect.leaf', 'inner')
      initState(self, 'collect.shared', 'from the leaf')
      return span({ id: 'target' }, 'leaf')
    },
  })
  const root = component('collect-root', {
    setup: (self) => {
      initState(self, 'collect.root', { open: true })
      initState(self, 'collect.shared', 'from the root')
      return div(leaf())
    },
  })
  mount(document.body, root())
  const target = document.querySelector('collect-root').shadowRoot
    .querySelector('collect-leaf').shadowRoot.querySelector('#target')

  const collected = collectStatesFrom(target)

  expect(collected).toEqual([
    { name: 'collect.leaf', value: 'inner' },
    { name: 'collect.shared', value: 'from the leaf' },
    { name: 'collect.root', value: { open: true } },
  ])
})

test('statesProvidedBy lists the states a host initialized, and nothing from its ancestors', () => {
  const leaf = component('provided-leaf', {
    setup: (self) => {
      initState(self, 'provided.leaf', 'inner')
      useState(self, 'provided.root')
      return span('leaf')
    },
  })
  const root = component('provided-root', {
    setup: (self) => {
      initState(self, 'provided.root', { open: true })
      return div(leaf())
    },
  })
  mount(document.body, root())
  const rootHost = document.querySelector('provided-root')
  const leafHost = rootHost.shadowRoot.querySelector('provided-leaf')

  const describe = (host) =>
    statesProvidedBy(host).map(({ name, state }) => `${name}=${JSON.stringify(state.get())}`)

  expect(describe(rootHost)).toEqual(['provided.root={"open":true}'])
  expect(describe(leafHost)).toEqual(['provided.leaf="inner"'])
  expect(describe(rootHost.shadowRoot.querySelector('div'))).toEqual([])

  statesProvidedBy(rootHost)[0].state.set({ open: false })
  expect(describe(rootHost)).toEqual(['provided.root={"open":false}'])
})

test('collectStatesFrom sees nothing outside the branch it is called from', () => {
  const sibling = component('collect-sibling', {
    setup: (self) => {
      initState(self, 'collect.sibling', 'hidden')
      return span('sibling')
    },
  })
  const onlyRoot = component('collect-only-root', {
    setup: (self) => {
      initState(self, 'collect.only', 1)
      return div(sibling(), span({ id: 'outside' }, 'outside'))
    },
  })
  mount(document.body, onlyRoot())
  const outside = document.querySelector('collect-only-root').shadowRoot.querySelector('#outside')

  expect(collectStatesFrom(outside).map(({ name }) => name)).toEqual(['collect.only'])
})

test('a subscriber setting a newer value does not leave later subscribers on the stale one', () => {
  const count = hostedState('t62.count', 0)
  const seen = []
  mount(
    document.body,
    probe(() => {
      count.watch((value) => {
        if (value === 1) count.set(2)
      })
      count.watch((value) => seen.push(value))
      return div(count.text())
    }),
  )
  count.set(1)
  expect(seen).toEqual([0, 2])
  expect(count.get()).toEqual(2)
  expect(renderedText(document.body)).toEqual('2')
})

test('a computed whose subscriber sets a source settles every subscriber on the final value', () => {
  const count = hostedState('t63.count', 0)
  const doubled = computed([count], (n) => n * 2)
  const seen = []
  mount(
    document.body,
    probe(() => {
      doubled.watch((value) => {
        if (value === 2) count.set(5)
      })
      doubled.watch((value) => seen.push(value))
    }),
  )
  count.set(1)
  expect(seen).toEqual([0, 10])
})

test('keyed each skips an item whose key throws and keeps the rest consistent', () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const items = hostedState('t64.items', [{ id: 1, text: 'a' }, { id: 2, text: 'b' }])
    mount(
      document.body,
      probe(() =>
        ul(items.each((item) => li(item.text), (item) => {
          if (item.id === 3) throw new Error('key boom')
          return item.id
        }))
      ),
    )
    items.set([{ id: 1, text: 'a' }, { id: 3, text: 'c' }, { id: 2, text: 'b' }])
    expect(renderedText(document.body)).toEqual('ab')
    expect(errors.length).toEqual(1)
    items.set([{ id: 2, text: 'b' }, { id: 1, text: 'a' }])
    expect(renderedText(document.body)).toEqual('ba')
    expect(document.querySelectorAll('state-probe').length).toEqual(1)
    expect(probeRoot().querySelectorAll('li').length).toEqual(2)
  } finally {
    console.error = originalError
  }
})
