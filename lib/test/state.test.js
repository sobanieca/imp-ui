import { button, component, computed, div, initState, li, mount, span, ul, useState } from 'imp'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const probe = component('state-probe', { onMount: (run) => run() })

const probeRoot = () => document.querySelector('state-probe').shadowRoot

const settled = () => new Promise((resolve) => setTimeout(resolve))

beforeEach(() => {
  document.body.replaceChildren()
})

test('initState returns a state with the initial value', () => {
  const user = initState('t1.user', { name: 'Ada' })
  expect(user.get()).toEqual({ name: 'Ada' })
})

test('set replaces the value and get reflects it', () => {
  const count = initState('t2.count', 1)
  count.set(2)
  expect(count.get()).toEqual(2)
})

test('set with a spread object replaces object state', () => {
  const user = initState('t3.user', { name: 'Ada', role: 'admin' })
  user.set({ ...user.get(), name: 'Grace' })
  expect(user.get()).toEqual({ name: 'Grace', role: 'admin' })
})

test('watch runs immediately and on every set', () => {
  const count = initState('t4.count', 0)
  const seen = []
  mount(document.body, probe(() => count.watch((value) => seen.push(value))))
  count.set(1)
  count.set(2)
  expect(seen).toEqual([0, 1, 2])
})

test('watch returns an unsubscribe function', () => {
  const count = initState('t5.count', 0)
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
  const user = initState('t6.user', { name: 'Ada' })
  let runs = 0
  mount(document.body, probe(() => user.watch(() => runs++)))
  user.set(user.get())
  expect(runs).toEqual(1)
})

test('useState returns the same state initState created', () => {
  const created = initState('t7.theme', 'dark')
  const used = useState('t7.theme')
  expect(used === created).toBeTruthy()
  used.set('light')
  expect(created.get()).toEqual('light')
})

test('useState resolves inside a mounted component', () => {
  initState('t8.message', 'hello')
  mount(document.body, probe(() => div(useState('t8.message').text())))
  expect(renderedText(document.body)).toEqual('hello')
})

test('useState throws for uninitialized state', () => {
  expect(() => useState('t9.missing')).toThrow("no state 't9.missing' is initialized")
})

test('state names must be namespaced with a dot', () => {
  expect(() => initState('user', 1)).toThrow('must include a namespace')
  expect(() => useState('user')).toThrow('must include a namespace')
  expect(() => initState('user.', 1)).toThrow('must include a namespace')
  expect(() => initState(42, 1)).toThrow('must be a namespaced string')
})

test('initState twice in the same scope throws', () => {
  const first = initState('t10.count', 1)
  expect(() => initState('t10.count', 99)).toThrow("state 't10.count' is already initialized")
  expect(first.get()).toEqual(1)
})

test('watch, text, view, and each throw outside a mounting component', () => {
  const count = initState('t11.count', 0)
  expect(() => count.watch(() => {})).toThrow('mounting component')
  expect(() => count.text()).toThrow('mounting component')
  expect(() => count.view((value) => div(value))).toThrow('mounting component')
  expect(() => count.each((item) => li(item))).toThrow('mounting component')
})

test('text renders the value and updates on set', () => {
  const name = initState('t12.name', 'Ada')
  mount(document.body, probe(() => div(name.text())))
  expect(renderedText(document.body)).toEqual('Ada')
  name.set('Grace')
  expect(renderedText(document.body)).toEqual('Grace')
})

test('text accepts a selector and blanks nullish output', () => {
  const user = initState('t13.user', { name: 'Ada' })
  mount(document.body, probe(() => div(user.text((value) => value.name))))
  expect(renderedText(document.body)).toEqual('Ada')
  user.set({})
  expect(renderedText(document.body)).toEqual('')
})

test('each renders list items and re-renders on set', () => {
  const todos = initState('t14.todos', ['a', 'b'])
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
  const items = initState('t15.items', ['x'])
  mount(document.body, probe(() => div('before', items.each((item) => div(item)), 'after')))
  items.set(['y', 'z'])
  expect(renderedText(document.body)).toEqual('beforeyzafter')
})

test('each passes the item index to the renderer', () => {
  const letters = initState('t16.letters', ['a', 'b'])
  mount(document.body, probe(() => div(letters.each((item, index) => div(`${index}:${item}`)))))
  expect(renderedText(document.body)).toEqual('0:a1:b')
})

test('set with a function produces the next value from the current one', () => {
  const count = initState('t25.count', 1)
  count.set((value) => value + 1)
  expect(count.get()).toEqual(2)
  const todos = initState('t25.todos', ['a'])
  todos.set((items) => [...items, 'b'])
  expect(todos.get()).toEqual(['a', 'b'])
})

test('set with a function notifies subscribers like a plain set', () => {
  const count = initState('t26.count', 0)
  const seen = []
  mount(document.body, probe(() => count.watch((value) => seen.push(value))))
  count.set((value) => value + 1)
  expect(seen).toEqual([0, 1])
})

test('set with a function producing an identical value notifies nobody', () => {
  const count = initState('t27.count', 5)
  const seen = []
  mount(document.body, probe(() => count.watch((value) => seen.push(value))))
  count.set((value) => value)
  expect(seen).toEqual([5])
})

test('view re-renders its region on set', () => {
  const user = initState('t28.user', { name: 'Ada', role: 'admin' })
  mount(
    document.body,
    probe(() => div(user.view((value) => div(`${value.name} (${value.role})`)))),
  )
  expect(renderedText(document.body)).toEqual('Ada (admin)')
  user.set({ name: 'Grace', role: 'user' })
  expect(renderedText(document.body)).toEqual('Grace (user)')
})

test('view renders nothing for null or false output', () => {
  const loggedIn = initState('t29.loggedIn', false)
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
  const count = initState('t30.count', 0)
  expect(() => count.view(div('static'))).toThrow('view needs a function')
})

test('view works on computed states', () => {
  const todos = initState('t31.todos', ['a', 'b'])
  const summary = computed([todos], (items) => items.length)
  mount(document.body, probe(() => div(summary.view((count) => div(`${count} left`)))))
  expect(renderedText(document.body)).toEqual('2 left')
  todos.set([])
  expect(renderedText(document.body)).toEqual('0 left')
})

test('a computed state rejects the updater form of set too', () => {
  const count = initState('t32.count', 1)
  const doubled = computed([count], (value) => value * 2)
  expect(() => doubled.set((value) => value + 1)).toThrow('read-only')
})

test('a mounted component reacts to page-wide state changes', () => {
  const count = initState('t17.count', 0)
  mount(document.body, probe(() => div({ id: 'child' }, count.text())))
  count.set(5)
  expect(probeRoot().querySelector('#child').textContent).toEqual('5')
})

test('subscriptions end when the subscribing component unmounts', async () => {
  const count = initState('t18.count', 0)
  const seen = []
  let node
  mount(
    document.body,
    probe(() => {
      node = count.text()
      count.watch((value) => seen.push(value))
      return div(node)
    }),
  )
  count.set(1)
  document.body.replaceChildren()
  await settled()
  count.set(2)
  expect(seen).toEqual([0, 1])
  expect(node.data).toEqual('1')
})

test('computed combines several states into one', () => {
  const first = initState('t19.first', 'Ada')
  const last = initState('t19.last', 'Lovelace')
  const full = computed([first, last], (firstName, lastName) => `${firstName} ${lastName}`)
  expect(full.get()).toEqual('Ada Lovelace')
  const seen = []
  mount(document.body, probe(() => full.watch((value) => seen.push(value))))
  first.set('Grace')
  expect(seen).toEqual(['Ada Lovelace', 'Grace Lovelace'])
})

test('a computed state notifies only when the computed outcome changes', () => {
  const user = initState('t20.user', { name: 'Ada', theme: 'dark' })
  const theme = computed([user], (current) => current.theme)
  const seen = []
  mount(document.body, probe(() => theme.watch((value) => seen.push(value))))
  user.set({ ...user.get(), name: 'Grace' })
  expect(seen).toEqual(['dark'])
  user.set({ ...user.get(), theme: 'light' })
  expect(seen).toEqual(['dark', 'light'])
})

test('computed text updates in the DOM and ends with its component', async () => {
  const price = initState('t21.price', 2)
  const quantity = initState('t21.quantity', 3)
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
  const count = initState('t22.count', 1)
  const doubled = computed([count], (value) => value * 2)
  expect(() => doubled.set(4)).toThrow('read-only')
})

test('computed validates its arguments', () => {
  const count = initState('t23.count', 1)
  expect(() => computed([], () => 0)).toThrow('non-empty array of states')
  expect(() => computed([{}], () => 0)).toThrow('non-empty array of states')
  expect(() => computed([count], 'nope')).toThrow('function computing')
})

test('computed states compose', () => {
  const width = initState('t24.width', 1)
  const height = initState('t24.height', 2)
  const area = computed([width, height], (w, h) => w * h)
  const doubledArea = computed([area], (value) => value * 2)
  expect(doubledArea.get()).toEqual(4)
  const seen = []
  mount(document.body, probe(() => doubledArea.watch((value) => seen.push(value))))
  width.set(3)
  expect(seen).toEqual([4, 12])
})

test('bindings nested in an each render survive re-renders', () => {
  const items = initState('t33.items', ['a'])
  const label = initState('t33.label', 'L')
  mount(document.body, probe(() => ul(items.each((item) => li(item, label.text())))))
  expect(renderedText(document.body)).toEqual('aL')
  items.set(['a', 'b'])
  expect(renderedText(document.body)).toEqual('aLbL')
  label.set('X')
  expect(renderedText(document.body)).toEqual('aXbX')
})

test('nested bindings are disposed when their region re-renders', () => {
  const items = initState('t34.items', ['a'])
  const label = initState('t34.label', 'L')
  let runs = 0
  mount(
    document.body,
    probe(() =>
      div(items.each((item) => {
        label.watch(() => runs++)
        return div(item)
      }))
    ),
  )
  expect(runs).toEqual(1)
  items.set(['a', 'b'])
  expect(runs).toEqual(3)
  label.set('X')
  expect(runs).toEqual(5)
})

test('a view nested inside a view re-renders and cleans up', () => {
  const outer = initState('t35.outer', 'o1')
  const inner = initState('t35.inner', 'i1')
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
  const items = initState('t36.items', ['a'])
  const label = initState('t36.label', 'L')
  const seen = []
  mount(
    document.body,
    probe(() =>
      div(items.each((item) => {
        label.watch((value) => seen.push(value))
        return div(item)
      }))
    ),
  )
  document.body.replaceChildren()
  await settled()
  label.set('X')
  expect(seen).toEqual(['L'])
})

test('keyed each keeps the DOM of unchanged items', () => {
  const todos = initState('t38.todos', [{ id: 1, text: 'a' }, { id: 2, text: 'b' }])
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
  const todos = initState('t39.todos', [{ id: 1, text: 'a' }, { id: 2, text: 'b' }])
  mount(document.body, probe(() => ul(todos.each((todo) => li(todo.text), (todo) => todo.id))))
  const [first, second] = probeRoot().querySelectorAll('li')
  todos.set([todos.get()[1], todos.get()[0]])
  const items = [...probeRoot().querySelectorAll('li')]
  expect(items[0] === second).toBeTruthy()
  expect(items[1] === first).toBeTruthy()
  expect(renderedText(document.body)).toEqual('ba')
})

test('keyed each re-renders only the item that changed', () => {
  const todos = initState('t40.todos', [{ id: 1, done: false }, { id: 2, done: false }])
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
  const items = initState('t41.items', [{ id: 1 }, { id: 2 }])
  const label = initState('t41.label', 'L')
  let runs = 0
  mount(
    document.body,
    probe(() =>
      div(items.each((item) => {
        label.watch(() => runs++)
        return div(item.id)
      }, (item) => item.id))
    ),
  )
  expect(runs).toEqual(2)
  items.set([items.get()[0]])
  label.set('X')
  expect(runs).toEqual(3)
})

test('keyed each warns on duplicate keys and still renders every item', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => errors.push(message)
  try {
    const items = initState('t42.items', [{ id: 1, text: 'a' }, { id: 1, text: 'b' }])
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
    const items = initState('t43.items', 'nope')
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
  const items = initState('t44.items', [])
  expect(() => items.each('nope')).toThrow('each needs a function')
  expect(() => items.each(() => div(), 'nope')).toThrow('stable key')
})

test('a state update cycle throws instead of looping forever', () => {
  const a = initState('t45.a', { n: 0 })
  const b = initState('t45.b', { n: 0 })
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
    const count = initState('t46.count', 0)
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

test('keyed each skips an item whose render throws', () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const items = initState('t47.items', [{ id: 1, text: 'ok' }])
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
  const hint = initState('t48.hint', 'save')
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
  const busy = initState('t49.busy', false)
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
  const theme = initState('t50.theme', 'dark')
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
  const active = initState('t51.active', true)
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
  const emphasized = initState('t52.emphasized', true)
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

test('a state prop value outside a mounting component throws', () => {
  const theme = initState('t53.theme', 'dark')
  expect(() => div({ class: theme })).toThrow('mounting component')
})

test('bound props end with the subscribing component', async () => {
  const hint = initState('t54.hint', 'a')
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
  const count = initState('t55.count', 1)
  const node = div(count)
  expect(node.childNodes.length).toEqual(0)
  expect(node.attributes.length).toEqual(0)
  expect(warn.calls.length).toEqual(1)
  expect(warn.calls[0][0]).toContain('passed directly')
})

test('useState resolves from the component inside a re-rendered view', () => {
  const toggle = initState('t37.toggle', false)
  const owner = component('t37-owner', {
    onMount: () => {
      initState('t37.value', 'scoped')
      return div(toggle.view(() => useState('t37.value').text()))
    },
  })
  mount(document.body, owner())
  expect(renderedText(document.body)).toEqual('scoped')
  toggle.set(true)
  expect(renderedText(document.body)).toEqual('scoped')
})

test('a computed state ignores a source set that leaves its result deep-equal', () => {
  const user = initState('t56.user', { address: { city: 'London' }, visits: 1 })
  const address = computed([user], (value) => value.address)
  const seen = []
  mount(document.body, probe(() => address.watch((value) => seen.push(value))))

  user.set({ address: { city: 'London' }, visits: 2 })
  expect(seen).toEqual([{ city: 'London' }])

  user.set({ address: { city: 'Oslo' }, visits: 3 })
  expect(seen).toEqual([{ city: 'London' }, { city: 'Oslo' }])
})

test('a computed list ignores a recompute producing a deep-equal array', () => {
  const todos = initState('t57.todos', [{ id: 1, done: false }, { id: 2, done: true }])
  const open = computed([todos], (items) => items.filter((item) => !item.done))
  const seen = []
  mount(document.body, probe(() => open.watch((items) => seen.push(items))))

  todos.set([{ id: 1, done: false }, { id: 2, done: true }, { id: 3, done: true }])
  expect(seen).toEqual([[{ id: 1, done: false }]])

  todos.set([{ id: 1, done: true }, { id: 2, done: true }])
  expect(seen).toEqual([[{ id: 1, done: false }], []])
})

test('an unkeyed each over a computed does not rebuild when the result is deep-equal', () => {
  const todos = initState('t58.todos', [{ id: 1, title: 'a', done: false }])
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
  const source = initState('t59.source', { n: 1 })
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

test('every subscriber of a computed state still sees each change', () => {
  const source = initState('t60.source', 1)
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
  const source = initState('t61.source', 1)
  const derived = computed([source], (value) => value * 2)
  const leaving = []
  const staying = []

  const goer = component('t61-goer', {
    onMount: () => {
      derived.watch((value) => leaving.push(value))
      return div('goer')
    },
  })
  const stayer = component('t61-stayer', {
    onMount: () => {
      derived.watch((value) => staying.push(value))
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

test('a computed state detaches from its sources when its last subscriber leaves', async () => {
  const source = initState('t62.source', 1)
  let computeRuns = 0
  const derived = computed([source], (value) => {
    computeRuns++
    return value * 2
  })

  mount(document.body, probe(() => derived.watch(() => {})))
  document.body.replaceChildren()
  await settled()

  const afterUnmount = computeRuns
  source.set(2)
  source.set(3)
  expect(computeRuns - afterUnmount).toEqual(0)
})

test('a computed state resubscribes correctly after all subscribers left', async () => {
  const source = initState('t63.source', 1)
  const derived = computed([source], (value) => value * 2)

  mount(document.body, probe(() => derived.watch(() => {})))
  document.body.replaceChildren()
  await settled()

  source.set(5)
  const seen = []
  mount(document.body, probe(() => derived.watch((value) => seen.push(value))))
  expect(seen).toEqual([10])
  source.set(6)
  expect(seen).toEqual([10, 12])
})

test('calling a computed unsubscribe twice does not corrupt its source subscription', () => {
  const source = initState('t64.source', 1)
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
  const user = initState('t65.user', { name: 'Ada', visits: 1 })
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
