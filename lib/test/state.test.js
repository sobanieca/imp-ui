import { component, div, initState, li, mergeStates, mount, span, ul, useState } from 'imp'
import { beforeEach, expect, test } from 'imp/test'

const probe = component('state-probe', { onMount: (run) => run() })

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

test('on runs immediately and on every set', () => {
  const count = initState('t4.count', 0)
  const seen = []
  mount(document.body, probe(() => count.on((value) => seen.push(value))))
  count.set(1)
  count.set(2)
  expect(seen).toEqual([0, 1, 2])
})

test('on returns an unsubscribe function', () => {
  const count = initState('t5.count', 0)
  const seen = []
  let off
  mount(
    document.body,
    probe(() => {
      off = count.on((value) => seen.push(value))
    }),
  )
  off()
  count.set(1)
  expect(seen).toEqual([0])
})

test('set is a no-op when the value is identical', () => {
  const user = initState('t6.user', { name: 'Ada' })
  let runs = 0
  mount(document.body, probe(() => user.on(() => runs++)))
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
  expect(document.body.textContent).toEqual('hello')
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

test('initState twice in the same scope warns and reuses the existing state', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const first = initState('t10.count', 1)
    const second = initState('t10.count', 99)
    expect(second === first).toBeTruthy()
    expect(second.get()).toEqual(1)
    expect(warnings.length).toEqual(1)
  } finally {
    console.warn = originalWarn
  }
})

test('on, text, view, and each throw outside a mounting component', () => {
  const count = initState('t11.count', 0)
  expect(() => count.on(() => {})).toThrow('mounting component')
  expect(() => count.text()).toThrow('mounting component')
  expect(() => count.view((value) => div(value))).toThrow('mounting component')
  expect(() => count.each((item) => li(item))).toThrow('mounting component')
})

test('text renders the value and updates on set', () => {
  const name = initState('t12.name', 'Ada')
  mount(document.body, probe(() => div(name.text())))
  expect(document.body.textContent).toEqual('Ada')
  name.set('Grace')
  expect(document.body.textContent).toEqual('Grace')
})

test('text accepts a selector and blanks nullish output', () => {
  const user = initState('t13.user', { name: 'Ada' })
  mount(document.body, probe(() => div(user.text((value) => value.name))))
  expect(document.body.textContent).toEqual('Ada')
  user.set({})
  expect(document.body.textContent).toEqual('')
})

test('each renders list items and re-renders on set', () => {
  const todos = initState('t14.todos', ['a', 'b'])
  mount(document.body, probe(() => ul(todos.each((item) => li(item)))))
  const itemTexts = () => [...document.querySelectorAll('li')].map((element) => element.textContent)
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
  expect(document.body.textContent).toEqual('beforeyzafter')
})

test('each passes the item index to the renderer', () => {
  const letters = initState('t16.letters', ['a', 'b'])
  mount(document.body, probe(() => div(letters.each((item, index) => div(`${index}:${item}`)))))
  expect(document.body.textContent).toEqual('0:a1:b')
})

test('update produces the next value from the current one', () => {
  const count = initState('t25.count', 1)
  count.update((value) => value + 1)
  expect(count.get()).toEqual(2)
  const todos = initState('t25.todos', ['a'])
  todos.update((items) => [...items, 'b'])
  expect(todos.get()).toEqual(['a', 'b'])
})

test('update notifies subscribers like set', () => {
  const count = initState('t26.count', 0)
  const seen = []
  mount(document.body, probe(() => count.on((value) => seen.push(value))))
  count.update((value) => value + 1)
  expect(seen).toEqual([0, 1])
})

test('update requires a function', () => {
  const count = initState('t27.count', 0)
  expect(() => count.update(5)).toThrow('update needs a function')
})

test('view re-renders its region on set', () => {
  const user = initState('t28.user', { name: 'Ada', role: 'admin' })
  mount(
    document.body,
    probe(() => div(user.view((value) => div(`${value.name} (${value.role})`)))),
  )
  expect(document.body.textContent).toEqual('Ada (admin)')
  user.set({ name: 'Grace', role: 'user' })
  expect(document.body.textContent).toEqual('Grace (user)')
})

test('view renders nothing for null or false output', () => {
  const loggedIn = initState('t29.loggedIn', false)
  mount(
    document.body,
    probe(() => div('before', loggedIn.view((value) => value && div('profile')), 'after')),
  )
  expect(document.body.textContent).toEqual('beforeafter')
  loggedIn.set(true)
  expect(document.body.textContent).toEqual('beforeprofileafter')
  loggedIn.set(false)
  expect(document.body.textContent).toEqual('beforeafter')
})

test('view requires a render function', () => {
  const count = initState('t30.count', 0)
  expect(() => count.view(div('static'))).toThrow('view needs a function')
})

test('view works on merged states', () => {
  const todos = initState('t31.todos', ['a', 'b'])
  const summary = mergeStates([todos], (items) => items.length)
  mount(document.body, probe(() => div(summary.view((count) => div(`${count} left`)))))
  expect(document.body.textContent).toEqual('2 left')
  todos.set([])
  expect(document.body.textContent).toEqual('0 left')
})

test('a merged state cannot be updated directly', () => {
  const count = initState('t32.count', 1)
  const doubled = mergeStates([count], (value) => value * 2)
  expect(() => doubled.update((value) => value + 1)).toThrow('read-only')
})

test('a mounted component reacts to page-wide state changes', () => {
  const count = initState('t17.count', 0)
  mount(document.body, probe(() => div({ id: 'child' }, count.text())))
  count.set(5)
  expect(document.querySelector('#child').textContent).toEqual('5')
})

test('subscriptions end when the subscribing component unmounts', async () => {
  const count = initState('t18.count', 0)
  const seen = []
  let node
  mount(
    document.body,
    probe(() => {
      node = count.text()
      count.on((value) => seen.push(value))
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

test('mergeStates combines several states into one', () => {
  const first = initState('t19.first', 'Ada')
  const last = initState('t19.last', 'Lovelace')
  const full = mergeStates([first, last], (firstName, lastName) => `${firstName} ${lastName}`)
  expect(full.get()).toEqual('Ada Lovelace')
  const seen = []
  mount(document.body, probe(() => full.on((value) => seen.push(value))))
  first.set('Grace')
  expect(seen).toEqual(['Ada Lovelace', 'Grace Lovelace'])
})

test('a merged state notifies only when the merged outcome changes', () => {
  const user = initState('t20.user', { name: 'Ada', theme: 'dark' })
  const theme = mergeStates([user], (current) => current.theme)
  const seen = []
  mount(document.body, probe(() => theme.on((value) => seen.push(value))))
  user.set({ ...user.get(), name: 'Grace' })
  expect(seen).toEqual(['dark'])
  user.set({ ...user.get(), theme: 'light' })
  expect(seen).toEqual(['dark', 'light'])
})

test('merged text updates in the DOM and ends with its component', async () => {
  const price = initState('t21.price', 2)
  const quantity = initState('t21.quantity', 3)
  const total = mergeStates([price, quantity], (priceValue, count) => priceValue * count)
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

test('a merged state cannot be set directly', () => {
  const count = initState('t22.count', 1)
  const doubled = mergeStates([count], (value) => value * 2)
  expect(() => doubled.set(4)).toThrow('read-only')
})

test('mergeStates validates its arguments', () => {
  const count = initState('t23.count', 1)
  expect(() => mergeStates([], () => 0)).toThrow('non-empty array of states')
  expect(() => mergeStates([{}], () => 0)).toThrow('non-empty array of states')
  expect(() => mergeStates([count], 'nope')).toThrow('function merging')
})

test('merged states compose', () => {
  const width = initState('t24.width', 1)
  const height = initState('t24.height', 2)
  const area = mergeStates([width, height], (w, h) => w * h)
  const doubledArea = mergeStates([area], (value) => value * 2)
  expect(doubledArea.get()).toEqual(4)
  const seen = []
  mount(document.body, probe(() => doubledArea.on((value) => seen.push(value))))
  width.set(3)
  expect(seen).toEqual([4, 12])
})

test('bindings nested in an each render survive re-renders', () => {
  const items = initState('t33.items', ['a'])
  const label = initState('t33.label', 'L')
  mount(document.body, probe(() => ul(items.each((item) => li(item, label.text())))))
  expect(document.body.textContent).toEqual('aL')
  items.set(['a', 'b'])
  expect(document.body.textContent).toEqual('aLbL')
  label.set('X')
  expect(document.body.textContent).toEqual('aXbX')
})

test('nested bindings are disposed when their region re-renders', () => {
  const items = initState('t34.items', ['a'])
  const label = initState('t34.label', 'L')
  let runs = 0
  mount(
    document.body,
    probe(() =>
      div(items.each((item) => {
        label.on(() => runs++)
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
  expect(document.body.textContent).toEqual('o1i1')
  inner.set('i2')
  expect(document.body.textContent).toEqual('o1i2')
  outer.set('o2')
  expect(document.body.textContent).toEqual('o2i2')
  inner.set('i3')
  expect(document.body.textContent).toEqual('o2i3')
})

test('nested bindings end with the subscribing component', async () => {
  const items = initState('t36.items', ['a'])
  const label = initState('t36.label', 'L')
  const seen = []
  mount(
    document.body,
    probe(() =>
      div(items.each((item) => {
        label.on((value) => seen.push(value))
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
  const [first, second] = document.querySelectorAll('li')
  todos.set([...todos.get(), { id: 3, text: 'c' }])
  const items = [...document.querySelectorAll('li')]
  expect(items.length).toEqual(3)
  expect(items[0] === first).toBeTruthy()
  expect(items[1] === second).toBeTruthy()
  expect(document.body.textContent).toEqual('abc')
})

test('keyed each reorders items without rebuilding them', () => {
  const todos = initState('t39.todos', [{ id: 1, text: 'a' }, { id: 2, text: 'b' }])
  mount(document.body, probe(() => ul(todos.each((todo) => li(todo.text), (todo) => todo.id))))
  const [first, second] = document.querySelectorAll('li')
  todos.set([todos.get()[1], todos.get()[0]])
  const items = [...document.querySelectorAll('li')]
  expect(items[0] === second).toBeTruthy()
  expect(items[1] === first).toBeTruthy()
  expect(document.body.textContent).toEqual('ba')
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
  const [first] = document.querySelectorAll('li')
  todos.set(todos.get().map((todo) => todo.id === 2 ? { ...todo, done: true } : { ...todo }))
  expect(renders).toEqual(3)
  const items = [...document.querySelectorAll('li')]
  expect(items[0] === first).toBeTruthy()
  expect(document.body.textContent).toEqual('ox')
})

test('keyed each disposes nested bindings of removed items only', () => {
  const items = initState('t41.items', [{ id: 1 }, { id: 2 }])
  const label = initState('t41.label', 'L')
  let runs = 0
  mount(
    document.body,
    probe(() =>
      div(items.each((item) => {
        label.on(() => runs++)
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
    expect(document.body.textContent).toEqual('ab')
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
    expect(document.body.textContent).toEqual('ba')
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
      a.on((value) => {
        if (value.n > 0) b.set({ n: value.n + 1 })
      })
      b.on((value) => {
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
        count.on((value) => {
          if (value > 0) throw new Error('subscriber boom')
        })
        count.on((value) => seen.push(value))
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
    expect(document.body.textContent).toEqual('okalso ok')
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
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
  expect(document.body.textContent).toEqual('scoped')
  toggle.set(true)
  expect(document.body.textContent).toEqual('scoped')
})
