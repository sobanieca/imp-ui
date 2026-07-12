import { component, div, initState, input, mount, span, useState } from 'imp'
import { beforeEach, expect, test } from 'imp/test'

const settled = () => new Promise((resolve) => setTimeout(resolve))

beforeEach(() => {
  document.body.replaceChildren()
})

test('a component shows its placeholder before mounting', () => {
  const card = component('c1-card', {
    placeholder: () => span('loading'),
    onMount: () => div('ready'),
  })
  const host = card()
  expect(host.localName).toEqual('c1-card')
  expect(host.textContent).toEqual('loading')
})

test('onMount runs on mount and replaces the placeholder', () => {
  const card = component('c2-card', {
    placeholder: () => span('loading'),
    onMount: () => div('ready'),
  })
  mount(document.body, card())
  expect(document.body.textContent).toEqual('ready')
  expect(document.querySelector('c2-card')).toBeTruthy()
})

test('onMount does not run while the component is detached', () => {
  let mounts = 0
  const card = component('c3-card', {
    placeholder: () => 'waiting',
    onMount: () => {
      mounts++
      return div('ready')
    },
  })
  const detached = div(card())
  expect(mounts).toEqual(0)
  expect(detached.textContent).toEqual('waiting')
})

test('parents mount before their children', () => {
  const order = []
  const child = component('c4-child', {
    onMount: () => {
      order.push('child')
      return span('x')
    },
  })
  const parent = component('c4-parent', {
    onMount: () => {
      order.push('parent')
      return div(child())
    },
  })
  mount(document.body, parent())
  expect(order).toEqual(['parent', 'child'])
})

test('call arguments are forwarded to onMount verbatim', () => {
  const greet = component('c5-greet', {
    onMount: (props, suffix) => div(`${props.name}${suffix}`),
  })
  mount(document.body, greet({ name: 'Ada' }, '!'))
  expect(document.body.textContent).toEqual('Ada!')
})

test('an async onMount keeps the placeholder until it resolves', async () => {
  let resolveData
  const gate = new Promise((resolve) => {
    resolveData = resolve
  })
  const card = component('c6-card', {
    placeholder: () => 'loading',
    onMount: async () => div(await gate),
  })
  mount(document.body, card())
  expect(document.body.textContent).toEqual('loading')
  resolveData('data')
  await settled()
  expect(document.body.textContent).toEqual('data')
})

test('async output is discarded when the component unmounts before it resolves', async () => {
  let resolveData
  const gate = new Promise((resolve) => {
    resolveData = resolve
  })
  const card = component('c7-card', {
    placeholder: () => 'loading',
    onMount: async () => div(await gate),
  })
  const host = card()
  mount(document.body, host)
  document.body.replaceChildren()
  resolveData('data')
  await settled()
  expect(host.textContent).toEqual('loading')
})

test('unmounting cleans state subscriptions and runs onUnmount', async () => {
  const counter = initState('c8.count', 0)
  const seen = []
  let unmounts = 0
  const watcher = component('c8-watcher', {
    onMount: () => {
      counter.on((value) => seen.push(value))
      return div(counter.text())
    },
    onUnmount: () => unmounts++,
  })
  mount(document.body, watcher())
  counter.set(1)
  document.body.replaceChildren()
  await settled()
  counter.set(2)
  expect(seen).toEqual([0, 1])
  expect(unmounts).toEqual(1)
})

test('moving a mounted component keeps its DOM and does not remount', async () => {
  let mounts = 0
  let unmounts = 0
  const box = component('c9-box', {
    onMount: () => {
      mounts++
      return div('content')
    },
    onUnmount: () => unmounts++,
  })
  const host = box()
  mount(document.body, div(host))
  const target = div()
  document.body.append(target)
  target.append(host)
  await settled()
  expect(mounts).toEqual(1)
  expect(unmounts).toEqual(0)
  expect(target.textContent).toEqual('content')
})

test('remounting after removal runs a fresh mount cycle', async () => {
  let mounts = 0
  let unmounts = 0
  const cycle = component('c10-cycle', {
    onMount: () => {
      mounts++
      return div('v')
    },
    onUnmount: () => unmounts++,
  })
  const host = cycle()
  document.body.append(host)
  host.remove()
  await settled()
  document.body.append(host)
  expect(mounts).toEqual(2)
  expect(unmounts).toEqual(1)
})

test('defining a component twice warns and reuses the first definition', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const first = component('c11-dup', { onMount: () => div('first') })
    const second = component('c11-dup', { onMount: () => div('second') })
    expect(second === first).toBeTruthy()
    expect(warnings.length).toEqual(1)
  } finally {
    console.warn = originalWarn
  }
})

test('component names must be lowercase and dashed', () => {
  const definition = { onMount: () => div() }
  expect(() => component('profile', definition)).toThrow('at least one dash')
  expect(() => component('My-Profile', definition)).toThrow('at least one dash')
  expect(() => component(42, definition)).toThrow('dash-separated string')
  expect(() => component('font-face', definition)).toThrow('reserved')
})

test('component definitions are validated', () => {
  expect(() => component('c13-bad', {})).toThrow('onMount function')
  expect(() => component('c13-worse', { onMount: () => div(), placeholder: 'x' })).toThrow(
    "'placeholder' must be a function",
  )
})

test('a component-scoped state is found by its descendants', () => {
  const label = component('c14-label', {
    onMount: () => span(useState('c14.value').text()),
  })
  const owner = component('c14-owner', {
    onMount: () => {
      initState('c14.value', 'inside')
      return div(label())
    },
  })
  mount(document.body, owner())
  expect(document.body.textContent).toEqual('inside')
})

test('sibling components own independent states under the same name', () => {
  const states = []
  const widget = component('c15-widget', {
    onMount: (initial) => {
      const value = initState('c15.value', initial)
      states.push(value)
      return span(value.text())
    },
  })
  mount(document.body, div(widget('a'), widget('b')))
  expect(document.body.textContent).toEqual('ab')
  states[0].set('a2')
  expect(document.body.textContent).toEqual('a2b')
})

test('a component state shadows an ancestor state with the same name', () => {
  const reader = component('c16-reader', {
    onMount: () => span(useState('c16.value').text()),
  })
  const inner = component('c16-inner', {
    onMount: () => {
      initState('c16.value', 'inner')
      return div(reader())
    },
  })
  const outer = component('c16-outer', {
    onMount: () => {
      initState('c16.value', 'outer')
      return div(inner(), reader())
    },
  })
  mount(document.body, outer())
  expect(document.body.textContent).toEqual('innerouter')
})

test('a component-scoped state is released on unmount', async () => {
  const holder = component('c17-holder', {
    onMount: () => {
      initState('c17.value', 'x')
      return div()
    },
  })
  mount(document.body, holder())
  document.body.replaceChildren()
  await settled()
  expect(() => useState('c17.value')).toThrow("no state 'c17.value'")
})

test('remounting reinitializes component-scoped state', async () => {
  const states = []
  const counter = component('c18-counter', {
    onMount: () => {
      const count = initState('c18.count', 0)
      states.push(count)
      return div(count.text())
    },
  })
  const host = counter()
  document.body.append(host)
  states[0].set(5)
  expect(host.textContent).toEqual('5')
  host.remove()
  await settled()
  document.body.append(host)
  expect(host.textContent).toEqual('0')
})

test('a moved component rebinds to the providers at its new position', () => {
  let mounts = 0
  const reader = component('c19-reader', {
    onMount: () => {
      mounts++
      return span(useState('c19.sort').text())
    },
  })
  const column = component('c19-column', {
    onMount: (sort) => {
      initState('c19.sort', sort)
      return div({ class: 'slot' })
    },
  })
  const first = column('alpha')
  const second = column('beta')
  mount(document.body, div(first, second))
  const readerHost = reader()
  first.querySelector('.slot').append(readerHost)
  expect(readerHost.textContent).toEqual('alpha')
  second.querySelector('.slot').append(readerHost)
  expect(readerHost.textContent).toEqual('beta')
  expect(mounts).toEqual(1)
})

test('a move keeps the component DOM and its component-scoped state', async () => {
  const states = []
  const card = component('c20-card', {
    onMount: () => {
      const draft = initState('c20.draft', '')
      states.push(draft)
      return div(input(), span(draft.text()))
    },
  })
  const host = card()
  mount(document.body, host)
  const field = host.querySelector('input')
  field.value = 'buy milk'
  states[0].set('note')
  const target = div()
  document.body.append(target)
  target.append(host)
  await settled()
  expect(host.querySelector('input') === field).toBeTruthy()
  expect(field.value).toEqual('buy milk')
  expect(host.textContent).toEqual('note')
})

test('setting through a captured helper targets the provider at the current position', () => {
  const helpers = []
  const columnStates = []
  const writer = component('c21-writer', {
    onMount: () => {
      helpers.push(useState('c21.sort'))
      return span()
    },
  })
  const column = component('c21-column', {
    onMount: (initial) => {
      columnStates.push(initState('c21.sort', initial))
      return div({ class: 'slot' })
    },
  })
  const first = column('one')
  const second = column('two')
  mount(document.body, div(first, second))
  const writerHost = writer()
  first.querySelector('.slot').append(writerHost)
  expect(helpers[0].get()).toEqual('one')
  second.querySelector('.slot').append(writerHost)
  expect(helpers[0].get()).toEqual('two')
  helpers[0].set('changed')
  expect(columnStates[1].get()).toEqual('changed')
  expect(columnStates[0].get()).toEqual('one')
})

test('a view keeps its DOM when the moved-to provider holds a structurally equal value', () => {
  const reader = component('c23-reader', {
    onMount: () => useState('c23.user').view((user) => span(user.name)),
  })
  const zone = component('c23-zone', {
    onMount: (user) => {
      initState('c23.user', user)
      return div({ class: 'slot' })
    },
  })
  const first = zone({ name: 'Ada', tags: ['admin'] })
  const second = zone({ name: 'Ada', tags: ['admin'] })
  mount(document.body, div(first, second))
  const readerHost = reader()
  first.querySelector('.slot').append(readerHost)
  const rendered = readerHost.querySelector('span')
  second.querySelector('.slot').append(readerHost)
  expect(readerHost.querySelector('span') === rendered).toBeTruthy()
  expect(readerHost.textContent).toEqual('Ada')
})

test('a view rebuilds when the moved-to provider holds a different value', () => {
  const reader = component('c24-reader', {
    onMount: () => useState('c24.user').view((user) => span(user.name)),
  })
  const zone = component('c24-zone', {
    onMount: (user) => {
      initState('c24.user', user)
      return div({ class: 'slot' })
    },
  })
  const first = zone({ name: 'Ada' })
  const second = zone({ name: 'Grace' })
  mount(document.body, div(first, second))
  const readerHost = reader()
  first.querySelector('.slot').append(readerHost)
  const rendered = readerHost.querySelector('span')
  second.querySelector('.slot').append(readerHost)
  expect(readerHost.querySelector('span') !== rendered).toBeTruthy()
  expect(readerHost.textContent).toEqual('Grace')
})

test('onError renders a fallback when onMount throws', () => {
  const card = component('c25-card', {
    onMount: () => {
      throw new Error('boom')
    },
    onError: (error) => div(`failed: ${error.message}`),
  })
  mount(document.body, card())
  expect(document.body.textContent).toEqual('failed: boom')
})

test('onError catches an async onMount rejection', async () => {
  const card = component('c26-card', {
    placeholder: () => 'loading',
    onMount: async () => {
      await Promise.resolve()
      throw new Error('fetch failed')
    },
    onError: (error) => div(error.message),
  })
  mount(document.body, card())
  expect(document.body.textContent).toEqual('loading')
  await settled()
  expect(document.body.textContent).toEqual('fetch failed')
})

test('a child mount error is handled by the nearest ancestor boundary', () => {
  const broken = component('c27-broken', {
    onMount: () => {
      throw new Error('child broke')
    },
  })
  const inner = component('c27-inner', {
    onMount: () => div(broken()),
    onError: (error) => span(`inner caught ${error.message}`),
  })
  const outer = component('c27-outer', {
    onMount: () => div(inner()),
    onError: () => span('outer caught'),
  })
  mount(document.body, outer())
  expect(document.body.textContent).toEqual('inner caught child broke')
})

test('rendering the fallback unmounts the rest of the subtree', async () => {
  const tracker = initState('c28.value', 0)
  const seen = []
  const watcher = component('c28-watcher', {
    onMount: () => {
      tracker.on((value) => seen.push(value))
      return span('watching')
    },
  })
  const broken = component('c28-broken', {
    onMount: async () => {
      await Promise.resolve()
      throw new Error('late failure')
    },
  })
  const boundary = component('c28-boundary', {
    onMount: () => div(watcher(), broken()),
    onError: () => span('failed'),
  })
  mount(document.body, boundary())
  tracker.set(1)
  await settled()
  expect(document.body.textContent).toEqual('failed')
  await settled()
  tracker.set(2)
  expect(seen).toEqual([0, 1])
})

test('a boundary handles one error per mounted period', async () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const failing = component('c29-failing', {
      onMount: async (message) => {
        await Promise.resolve()
        throw new Error(message)
      },
    })
    const boundary = component('c29-boundary', {
      onMount: () => div(failing('first'), failing('second')),
      onError: (error) => span(error.message),
    })
    mount(document.body, boundary())
    await settled()
    expect(document.body.textContent).toEqual('first')
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('an unhandled mount error logs and keeps the placeholder', () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const broken = component('c30-broken', {
      placeholder: () => 'placeholder',
      onMount: () => {
        throw new Error('no boundary')
      },
    })
    mount(document.body, broken())
    expect(document.body.textContent).toEqual('placeholder')
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('a throwing onUnmount does not break teardown', async () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const count = initState('c31.count', 0)
    const seen = []
    const fragile = component('c31-fragile', {
      placeholder: () => 'down',
      onMount: () => {
        count.on((value) => seen.push(value))
        return div('up')
      },
      onUnmount: () => {
        throw new Error('cleanup boom')
      },
    })
    const host = fragile()
    mount(document.body, host)
    document.body.replaceChildren()
    await settled()
    count.set(1)
    expect(seen).toEqual([0])
    expect(host.textContent).toEqual('down')
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('onError must be a function', () => {
  expect(() => component('c32-bad', { onMount: () => div(), onError: 'x' })).toThrow(
    "'onError' must be a function",
  )
})

test('bindings nested inside a view rebind on move', () => {
  const flag = initState('c22.flag', true)
  const reader = component('c22-reader', {
    onMount: () => flag.view(() => span(useState('c22.label').text())),
  })
  const zone = component('c22-zone', {
    onMount: (labelValue) => {
      initState('c22.label', labelValue)
      return div({ class: 'slot' })
    },
  })
  const first = zone('L1')
  const second = zone('L2')
  mount(document.body, div(first, second))
  const readerHost = reader()
  first.querySelector('.slot').append(readerHost)
  expect(readerHost.textContent).toEqual('L1')
  second.querySelector('.slot').append(readerHost)
  expect(readerHost.textContent).toEqual('L2')
})
