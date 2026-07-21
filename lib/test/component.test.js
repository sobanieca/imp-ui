import { component, div, initState, input, mount, span, useState } from 'imp'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText, settled } from './shadow.js'

const stateHost = component('c0-state-host', { onMount: (init) => void init() })

const hostedState = (name, initialValue) => {
  let state
  mount(document.body, stateHost(() => (state = initState(name, initialValue))))
  return state
}

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
  expect(renderedText(host)).toEqual('loading')
})

test('onMount runs on mount and replaces the placeholder', () => {
  const card = component('c2-card', {
    placeholder: () => span('loading'),
    onMount: () => div('ready'),
  })
  mount(document.body, card())
  expect(renderedText(document.body)).toEqual('ready')
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
  expect(renderedText(detached)).toEqual('waiting')
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
  expect(renderedText(document.body)).toEqual('Ada!')
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
  expect(renderedText(document.body)).toEqual('loading')
  resolveData('data')
  await settled()
  expect(renderedText(document.body)).toEqual('data')
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
  expect(renderedText(host)).toEqual('loading')
})

test('unmounting cleans state subscriptions and runs onUnmount', async () => {
  const counter = hostedState('c8.count', 0)
  const seen = []
  let unmounts = 0
  const watcher = component('c8-watcher', {
    onMount: () => {
      counter.watch((value) => seen.push(value))
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
  expect(renderedText(target)).toEqual('content')
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
  expect(renderedText(document.body)).toEqual('inside')
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
  expect(renderedText(document.body)).toEqual('ab')
  states[0].set('a2')
  expect(renderedText(document.body)).toEqual('a2b')
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
  expect(renderedText(document.body)).toEqual('innerouter')
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
  let failure = null
  mount(
    document.body,
    stateHost(() => {
      try {
        useState('c17.value')
      } catch (error) {
        failure = error
      }
    }),
  )
  expect(failure?.message).toContain("no state 'c17.value'")
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
  expect(renderedText(host)).toEqual('5')
  host.remove()
  await settled()
  document.body.append(host)
  expect(renderedText(host)).toEqual('0')
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
  first.shadowRoot.querySelector('.slot').append(readerHost)
  expect(renderedText(readerHost)).toEqual('alpha')
  second.shadowRoot.querySelector('.slot').append(readerHost)
  expect(renderedText(readerHost)).toEqual('beta')
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
  const field = host.shadowRoot.querySelector('input')
  field.value = 'buy milk'
  states[0].set('note')
  const target = div()
  document.body.append(target)
  target.append(host)
  await settled()
  expect(host.shadowRoot.querySelector('input') === field).toBeTruthy()
  expect(field.value).toEqual('buy milk')
  expect(renderedText(host)).toEqual('note')
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
  first.shadowRoot.querySelector('.slot').append(writerHost)
  expect(helpers[0].get()).toEqual('one')
  second.shadowRoot.querySelector('.slot').append(writerHost)
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
  first.shadowRoot.querySelector('.slot').append(readerHost)
  const rendered = readerHost.shadowRoot.querySelector('span')
  second.shadowRoot.querySelector('.slot').append(readerHost)
  expect(readerHost.shadowRoot.querySelector('span') === rendered).toBeTruthy()
  expect(renderedText(readerHost)).toEqual('Ada')
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
  first.shadowRoot.querySelector('.slot').append(readerHost)
  const rendered = readerHost.shadowRoot.querySelector('span')
  second.shadowRoot.querySelector('.slot').append(readerHost)
  expect(readerHost.shadowRoot.querySelector('span') !== rendered).toBeTruthy()
  expect(renderedText(readerHost)).toEqual('Grace')
})

test('onError renders a fallback when onMount throws', () => {
  const card = component('c25-card', {
    onMount: () => {
      throw new Error('boom')
    },
    onError: (error) => div(`failed: ${error.message}`),
  })
  mount(document.body, card())
  expect(renderedText(document.body)).toEqual('failed: boom')
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
  expect(renderedText(document.body)).toEqual('loading')
  await settled()
  expect(renderedText(document.body)).toEqual('fetch failed')
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
  expect(renderedText(document.body)).toEqual('inner caught child broke')
})

test('rendering the fallback unmounts the rest of the subtree', async () => {
  const tracker = hostedState('c28.value', 0)
  const seen = []
  const watcher = component('c28-watcher', {
    onMount: () => {
      tracker.watch((value) => seen.push(value))
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
  expect(renderedText(document.body)).toEqual('failed')
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
    expect(renderedText(document.body)).toEqual('first')
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
    expect(renderedText(document.body)).toEqual('placeholder')
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
    const count = hostedState('c31.count', 0)
    const seen = []
    const fragile = component('c31-fragile', {
      placeholder: () => 'down',
      onMount: () => {
        count.watch((value) => seen.push(value))
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
    expect(renderedText(host)).toEqual('down')
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

test('a component renders into its shadow root, not its light DOM', () => {
  const card = component('c33-shadow', { onMount: () => div('inside') })
  const host = card()
  mount(document.body, host)
  expect(host.childNodes.length).toEqual(0)
  expect(host.shadowRoot.textContent).toEqual('inside')
})

test('a component adopts its styles into its shadow root', () => {
  const card = component('c34-styled', {
    styles: '.box { color: red }',
    onMount: () => div({ class: 'box' }, 'styled'),
  })
  const host = card()
  mount(document.body, host)
  const sheets = host.shadowRoot.adoptedStyleSheets
  expect(sheets.length).toEqual(2)
  expect(sheets[1].cssRules[0].cssText.includes('.box')).toBeTruthy()
})

test('every component keeps its host invisible to layout by default', () => {
  const plain = component('c35-plain', { onMount: () => div('x') })
  const host = plain()
  mount(document.body, host)
  const [hostRule] = host.shadowRoot.adoptedStyleSheets[0].cssRules
  expect(hostRule.cssText.includes('display: contents')).toBeTruthy()
})

test('components without styles share the host sheet only', () => {
  const bare = component('c36-bare', { onMount: () => div('y') })
  const host = bare()
  mount(document.body, host)
  expect(host.shadowRoot.adoptedStyleSheets.length).toEqual(1)
})

test('styles must be a CSS string', () => {
  expect(() => component('c37-bad', { onMount: () => div(), styles: 42 })).toThrow(
    "'styles' must be a CSS string",
  )
})

test('bindings nested inside a view rebind on move', () => {
  const flag = hostedState('c22.flag', true)
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
  first.shadowRoot.querySelector('.slot').append(readerHost)
  expect(renderedText(readerHost)).toEqual('L1')
  second.shadowRoot.querySelector('.slot').append(readerHost)
  expect(renderedText(readerHost)).toEqual('L2')
})

test('a resolved async onMount does not replace an earlier error fallback', async () => {
  const boom = component('c38-boom', {
    onMount: () => Promise.reject(new Error('boom')),
  })
  const shell = component('c38-shell', {
    placeholder: () => boom(),
    onMount: async () => {
      await settled()
      return div('late content')
    },
    onError: () => div('fallback'),
  })
  mount(document.body, shell())
  await settled()
  await settled()
  expect(renderedText(document.body)).toEqual('fallback')
})

test('state regions go quiet after an error fallback replaces them', async () => {
  const status = hostedState('c39.status', 'ok')
  const failing = component('c39-failing', {
    onMount: () => Promise.reject(new Error('load failed')),
  })
  const shell = component('c39-shell', {
    onMount: () => [status.view((value) => div(value)), failing()],
    onError: () => div('fallback'),
  })
  const errors = spy(console, 'error', () => {})
  mount(document.body, shell())
  await settled()
  expect(renderedText(document.body)).toEqual('fallback')
  status.set('changed')
  expect(renderedText(document.body)).toEqual('fallback')
  expect(errors.calls.length).toEqual(0)
})

test('an async onMount sets awaited data into state and DOM built before its first await', async () => {
  let resolveData
  const gate = new Promise((resolve) => {
    resolveData = resolve
  })
  const card = component('c41-card', {
    placeholder: () => 'loading',
    onMount: async () => {
      const orders = initState('c41.orders', [])
      const dom = div(orders.each((order) => span(order)))
      orders.set(await gate)
      return dom
    },
  })
  mount(document.body, card())
  expect(renderedText(document.body)).toEqual('loading')
  resolveData(['a', 'b'])
  await settled()
  expect(renderedText(document.body)).toEqual('ab')
})

test('bindings built after an await in an async onMount go live on mount', async () => {
  const orders = hostedState('c42.orders', ['a'])
  const late = component('c42-late', {
    onMount: async () => {
      await Promise.resolve()
      return div(orders.each((order) => span(order)))
    },
  })
  mount(document.body, late())
  await settled()
  expect(renderedText(document.body)).toEqual('a')
  orders.set(['a', 'b'])
  expect(renderedText(document.body)).toEqual('ab')
})

test('a state-bound prop built after an await in an async onMount binds on mount', async () => {
  const busy = hostedState('c44.busy', true)
  let node
  const late = component('c44-late-prop', {
    onMount: async () => {
      await Promise.resolve()
      node = input({ disabled: busy })
      return node
    },
  })
  mount(document.body, late())
  await settled()
  expect(node.disabled).toEqual(true)
  busy.set(false)
  expect(node.disabled).toEqual(false)
})

test('watch after an await in an async onMount is a mount error', async () => {
  const count = hostedState('c43.count', 0)
  const late = component('c43-late', {
    onMount: async () => {
      await Promise.resolve()
      count.watch(() => {})
    },
    onError: (error) => div(error.message),
  })
  mount(document.body, late())
  await settled()
  expect(renderedText(document.body)).toContain('mounting component')
})

test('a throwing placeholder on unmount is contained', async () => {
  let placeholderCalls = 0
  const flaky = component('c40-flaky', {
    placeholder: () => {
      placeholderCalls++
      if (placeholderCalls > 1) throw new Error('placeholder boom')
      return 'loading'
    },
    onMount: () => div('ready'),
  })
  const errors = spy(console, 'error', () => {})
  const host = flaky()
  mount(document.body, host)
  document.body.replaceChildren()
  await settled()
  expect(renderedText(host)).toEqual('')
  expect(errors.calls.length).toEqual(1)
  expect(errors.calls[0][0]).toContain('placeholder failed')
})
