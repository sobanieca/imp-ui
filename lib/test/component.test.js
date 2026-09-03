import { component, mount } from 'imp'
import { div, input, span } from 'imp/html'
import { beforeEach, expect, spy, test } from 'imp/test'
import { nextFrame, renderedText, settled } from './shadow.js'
import { initState, useState } from 'imp/state'

const stateHost = component('c0-state-host', { setup: (self, init) => init(self) })

const hostedState = (name, initialValue) => {
  let state
  mount(document.body, stateHost((self) => (state = initState(self, name, initialValue))))
  return state
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('a component shows its loading content before mounting', () => {
  const card = component('c1-card', {
    loading: () => span('loading'),
    setup: () => div('ready'),
  })
  const host = card()
  expect(host.localName).toEqual('c1-card')
  expect(renderedText(host)).toEqual('loading')
})

test('setup runs on mount and replaces the loading content', () => {
  const card = component('c2-card', {
    loading: () => span('loading'),
    setup: () => div('ready'),
  })
  mount(document.body, card())
  expect(renderedText(document.body)).toEqual('ready')
  expect(document.querySelector('c2-card')).toBeTruthy()
})

test('setup does not run while the component is detached', () => {
  let mounts = 0
  const card = component('c3-card', {
    loading: () => 'waiting',
    setup: () => {
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
    setup: () => {
      order.push('child')
      return span('x')
    },
  })
  const parent = component('c4-parent', {
    setup: () => {
      order.push('parent')
      return div(child())
    },
  })
  mount(document.body, parent())
  expect(order).toEqual(['parent', 'child'])
})

test('call arguments are forwarded to setup verbatim', () => {
  const greet = component('c5-greet', {
    setup: (_self, props, suffix) => div(`${props.name}${suffix}`),
  })
  mount(document.body, greet({ name: 'Ada' }, '!'))
  expect(renderedText(document.body)).toEqual('Ada!')
})

test('an async setup keeps the loading content until it resolves', async () => {
  let resolveData
  const gate = new Promise((resolve) => {
    resolveData = resolve
  })
  const card = component('c6-card', {
    loading: () => 'loading',
    setup: async () => div(await gate),
  })
  mount(document.body, card())
  expect(renderedText(document.body)).toEqual('loading')
  resolveData('data')
  await settled()
  expect(renderedText(document.body)).toEqual('data')
})

test('loading with a synchronous setup warns that it is never seen', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const card = component('c6b-card', {
      loading: () => span('loading'),
      setup: () => div('ready'),
    })
    mount(document.body, card())
    mount(document.body, card())
    expect(warnings.length).toEqual(1)
    expect(warnings[0]).toContain('loading')
    expect(warnings[0]).toContain('never seen')
  } finally {
    console.warn = originalWarn
  }
})

test('loading bound to state warns that it never goes live', () => {
  const label = hostedState('c6h.label', 'initial')
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const card = component('c6h-card', {
      loading: (bound) => span(bound.text()),
      setup: () => Promise.resolve(div('ready')),
    })
    mount(document.body, card(label))
    mount(document.body, card(label))
    expect(warnings.length).toEqual(1)
    expect(warnings[0]).toContain('loading content is bound to state')
  } finally {
    console.warn = originalWarn
  }
})

test('loading with a state-bound prop warns too', () => {
  const title = hostedState('c6i.title', 'tip')
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const card = component('c6i-card', {
      loading: (bound) => span({ title: bound }, 'loading'),
      setup: () => Promise.resolve(div('ready')),
    })
    mount(document.body, card(title))
    expect(warnings.length).toEqual(1)
    expect(warnings[0]).toContain('loading content is bound to state')
  } finally {
    console.warn = originalWarn
  }
})

test('loading of plain content does not warn about bindings', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const card = component('c6j-card', {
      loading: () => span('loading'),
      setup: () => Promise.resolve(div('ready')),
    })
    mount(document.body, card())
    expect(warnings.length).toEqual(0)
  } finally {
    console.warn = originalWarn
  }
})

test('loading with a promise-returning setup does not warn', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const card = component('c6c-card', {
      loading: () => span('loading'),
      setup: () => Promise.resolve(div('ready')),
    })
    mount(document.body, card())
    expect(warnings.length).toEqual(0)
  } finally {
    console.warn = originalWarn
  }
})

test('a synchronous setup without loading does not warn', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const card = component('c6d-card', { setup: () => div('ready') })
    mount(document.body, card())
    expect(warnings.length).toEqual(0)
  } finally {
    console.warn = originalWarn
  }
})

test('loading that renders nothing with a synchronous setup does not warn', () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)
  try {
    const card = component('c6e-card', {
      loading: (options) => options?.loading ? span('loading') : null,
      setup: () => div('ready'),
    })
    mount(document.body, card({}))
    expect(warnings.length).toEqual(0)
  } finally {
    console.warn = originalWarn
  }
})

test('async output is discarded when the component unmounts before it resolves', async () => {
  let resolveData
  const gate = new Promise((resolve) => {
    resolveData = resolve
  })
  const card = component('c7-card', {
    loading: () => 'loading',
    setup: async () => div(await gate),
  })
  const host = card()
  mount(document.body, host)
  document.body.replaceChildren()
  resolveData('data')
  await settled()
  expect(renderedText(host)).toEqual('')
})

test('unmounting cleans state bindings and runs onRemove with the stop of a watch', async () => {
  const counter = hostedState('c8.count', 0)
  const seen = []
  let unmounts = 0
  let node
  const watcher = component('c8-watcher', {
    setup: (self) => {
      self.stopWatching = counter.watch((value) => seen.push(value))
      node = counter.text()
      return div(node)
    },
    onRemove: (self) => {
      self.stopWatching()
      unmounts++
    },
  })
  mount(document.body, watcher())
  counter.set(1)
  document.body.replaceChildren()
  await settled()
  counter.set(2)
  expect(seen).toEqual([0, 1])
  expect(node.data).toEqual('1')
  expect(unmounts).toEqual(1)
})

test('moving a mounted component keeps its DOM and does not remount', async () => {
  let mounts = 0
  let unmounts = 0
  const box = component('c9-box', {
    setup: () => {
      mounts++
      return div('content')
    },
    onRemove: () => unmounts++,
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
    setup: () => {
      mounts++
      return div('v')
    },
    onRemove: () => unmounts++,
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
    const first = component('c11-dup', { setup: () => div('first') })
    const second = component('c11-dup', { setup: () => div('second') })
    expect(second === first).toBeTruthy()
    expect(warnings.length).toEqual(1)
  } finally {
    console.warn = originalWarn
  }
})

test('component names must be lowercase and dashed', () => {
  const definition = { setup: () => div() }
  expect(() => component('profile', definition)).toThrow('at least one dash')
  expect(() => component('My-Profile', definition)).toThrow('at least one dash')
  expect(() => component(42, definition)).toThrow('dash-separated string')
  expect(() => component('font-face', definition)).toThrow('reserved')
})

test('component definitions are validated', () => {
  expect(() => component('c13-bad', {})).toThrow('setup function')
  expect(() => component('c13-worse', { setup: () => div(), loading: 'x' })).toThrow(
    "'loading' must be a function",
  )
  expect(() => component('c13-worst', { setup: () => div(), onMount: 'x' })).toThrow(
    "'onMount' must be a function",
  )
})

test('a component-scoped state is found by its descendants', () => {
  const label = component('c14-label', {
    setup: (self) => span(useState(self, 'c14.value').text()),
  })
  const owner = component('c14-owner', {
    setup: (self) => {
      initState(self, 'c14.value', 'inside')
      return div(label())
    },
  })
  mount(document.body, owner())
  expect(renderedText(document.body)).toEqual('inside')
})

test('sibling components own independent states under the same name', () => {
  const states = []
  const widget = component('c15-widget', {
    setup: (self, initial) => {
      const value = initState(self, 'c15.value', initial)
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
    setup: (self) => span(useState(self, 'c16.value').text()),
  })
  const inner = component('c16-inner', {
    setup: (self) => {
      initState(self, 'c16.value', 'inner')
      return div(reader())
    },
  })
  const outer = component('c16-outer', {
    setup: (self) => {
      initState(self, 'c16.value', 'outer')
      return div(inner(), reader())
    },
  })
  mount(document.body, outer())
  expect(renderedText(document.body)).toEqual('innerouter')
})

test('a component-scoped state is released on unmount', async () => {
  const holder = component('c17-holder', {
    setup: (self) => {
      initState(self, 'c17.value', 'x')
      return div()
    },
  })
  mount(document.body, holder())
  document.body.replaceChildren()
  await settled()
  let failure = null
  mount(
    document.body,
    stateHost((self) => {
      try {
        useState(self, 'c17.value')
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
    setup: (self) => {
      const count = initState(self, 'c18.count', 0)
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
    setup: (self) => {
      mounts++
      return span(useState(self, 'c19.sort').text())
    },
  })
  const column = component('c19-column', {
    setup: (self, sort) => {
      initState(self, 'c19.sort', sort)
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
    setup: (self) => {
      const draft = initState(self, 'c20.draft', '')
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
    setup: (self) => {
      helpers.push(useState(self, 'c21.sort'))
      return span()
    },
  })
  const column = component('c21-column', {
    setup: (self, initial) => {
      columnStates.push(initState(self, 'c21.sort', initial))
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
    setup: (self) => useState(self, 'c23.user').view((user) => span(user.name)),
  })
  const zone = component('c23-zone', {
    setup: (self, user) => {
      initState(self, 'c23.user', user)
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
    setup: (self) => useState(self, 'c24.user').view((user) => span(user.name)),
  })
  const zone = component('c24-zone', {
    setup: (self, user) => {
      initState(self, 'c24.user', user)
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

test('error renders the error view when setup throws', () => {
  const card = component('c25-card', {
    setup: () => {
      throw new Error('boom')
    },
    error: (_self, error) => div(`failed: ${error.message}`),
  })
  mount(document.body, card())
  expect(renderedText(document.body)).toEqual('failed: boom')
})

test('error catches an async setup rejection', async () => {
  const card = component('c26-card', {
    loading: () => 'loading',
    setup: async () => {
      await Promise.resolve()
      throw new Error('fetch failed')
    },
    error: (_self, error) => div(error.message),
  })
  mount(document.body, card())
  expect(renderedText(document.body)).toEqual('loading')
  await settled()
  expect(renderedText(document.body)).toEqual('fetch failed')
})

test('a child mount error is handled by the nearest ancestor boundary', () => {
  const broken = component('c27-broken', {
    setup: () => {
      throw new Error('child broke')
    },
  })
  const inner = component('c27-inner', {
    setup: () => div(broken()),
    error: (_self, error) => span(`inner caught ${error.message}`),
  })
  const outer = component('c27-outer', {
    setup: () => div(inner()),
    error: () => span('outer caught'),
  })
  mount(document.body, outer())
  expect(renderedText(document.body)).toEqual('inner caught child broke')
})

test('rendering the error view unmounts the rest of the subtree', async () => {
  const tracker = hostedState('c28.value', 0)
  const seen = []
  const watcher = component('c28-watcher', {
    setup: (self) => {
      tracker.watch(self, (value) => seen.push(value))
      return span('watching')
    },
  })
  const broken = component('c28-broken', {
    setup: async () => {
      await Promise.resolve()
      throw new Error('late failure')
    },
  })
  const boundary = component('c28-boundary', {
    setup: () => div(watcher(), broken()),
    error: () => span('failed'),
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
      setup: async (_self, message) => {
        await Promise.resolve()
        throw new Error(message)
      },
    })
    const boundary = component('c29-boundary', {
      setup: () => div(failing('first'), failing('second')),
      error: (_self, error) => span(error.message),
    })
    mount(document.body, boundary())
    await settled()
    expect(renderedText(document.body)).toEqual('first')
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('an unhandled mount error logs and keeps the loading content', () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const broken = component('c30-broken', {
      loading: () => 'placeholder',
      setup: () => {
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

test('a throwing onRemove does not break the unmount', async () => {
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args)
  try {
    const count = hostedState('c31.count', 0)
    const seen = []
    const fragile = component('c31-fragile', {
      loading: () => 'down',
      setup: (self) => {
        self.stop = count.watch((value) => seen.push(value))
        return div('up')
      },
      onRemove: (self) => {
        self.stop()
        throw new Error('cleanup boom')
      },
    })
    const host = fragile()
    mount(document.body, host)
    document.body.replaceChildren()
    await settled()
    count.set(1)
    expect(seen).toEqual([0])
    expect(renderedText(host)).toEqual('')
    expect(errors.length).toEqual(1)
  } finally {
    console.error = originalError
  }
})

test('error must be a function', () => {
  expect(() => component('c32-bad', { setup: () => div(), error: 'x' })).toThrow(
    "'error' must be a function",
  )
})

test('a component renders into its shadow root, not its light DOM', () => {
  const card = component('c33-shadow', { setup: () => div('inside') })
  const host = card()
  mount(document.body, host)
  expect(host.childNodes.length).toEqual(0)
  expect(host.shadowRoot.textContent).toEqual('inside')
})

test('a component adopts its styles into its shadow root', () => {
  const card = component('c34-styled', {
    styles: '.box { color: red }',
    setup: () => div({ class: 'box' }, 'styled'),
  })
  const host = card()
  mount(document.body, host)
  const sheets = host.shadowRoot.adoptedStyleSheets
  expect(sheets.length).toEqual(2)
  expect(sheets[1].cssRules[0].cssText.includes('.box')).toBeTruthy()
})

test('every component keeps its host invisible to layout by default', () => {
  const plain = component('c35-plain', { setup: () => div('x') })
  const host = plain()
  mount(document.body, host)
  const [hostRule] = host.shadowRoot.adoptedStyleSheets[0].cssRules
  expect(hostRule.cssText.includes('display: contents')).toBeTruthy()
})

test('components without styles share the host sheet only', () => {
  const bare = component('c36-bare', { setup: () => div('y') })
  const host = bare()
  mount(document.body, host)
  expect(host.shadowRoot.adoptedStyleSheets.length).toEqual(1)
})

test('styles must be a CSS string', () => {
  expect(() => component('c37-bad', { setup: () => div(), styles: 42 })).toThrow(
    "'styles' must be a CSS string",
  )
})

test('bindings nested inside a view rebind on move', () => {
  const flag = hostedState('c22.flag', true)
  const reader = component('c22-reader', {
    setup: (self) => flag.view(() => span(useState(self, 'c22.label').text())),
  })
  const zone = component('c22-zone', {
    setup: (self, labelValue) => {
      initState(self, 'c22.label', labelValue)
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

test('a resolved async setup does not replace an earlier error view', async () => {
  const boom = component('c38-boom', {
    setup: () => Promise.reject(new Error('boom')),
  })
  const shell = component('c38-shell', {
    loading: () => boom(),
    setup: async () => {
      await settled()
      return div('late content')
    },
    error: () => div('fallback'),
  })
  mount(document.body, shell())
  await settled()
  await settled()
  expect(renderedText(document.body)).toEqual('fallback')
})

test('state regions go quiet after an error view replaces them', async () => {
  const status = hostedState('c39.status', 'ok')
  const failing = component('c39-failing', {
    setup: () => Promise.reject(new Error('load failed')),
  })
  const shell = component('c39-shell', {
    setup: () => [status.view((value) => div(value)), failing()],
    error: () => div('fallback'),
  })
  const errors = spy(console, 'error', () => {})
  mount(document.body, shell())
  await settled()
  expect(renderedText(document.body)).toEqual('fallback')
  status.set('changed')
  expect(renderedText(document.body)).toEqual('fallback')
  expect(errors.calls.length).toEqual(0)
})

test('an async setup sets awaited data into state and DOM built before its first await', async () => {
  let resolveData
  const gate = new Promise((resolve) => {
    resolveData = resolve
  })
  const card = component('c41-card', {
    loading: () => 'loading',
    setup: async (self) => {
      const orders = initState(self, 'c41.orders', [])
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

test('bindings built after an await in an async setup go live on mount', async () => {
  const orders = hostedState('c42.orders', ['a'])
  const late = component('c42-late', {
    setup: async () => {
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

test('a state-bound prop built after an await in an async setup binds on mount', async () => {
  const busy = hostedState('c44.busy', true)
  let node
  const late = component('c44-late-prop', {
    setup: async () => {
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

test('a state resolves through self after an await in an async setup', async () => {
  const late = component('c43-late', {
    setup: async (self) => {
      await Promise.resolve()
      const count = useState(self, 'c43.count')
      return div(count.text())
    },
  })
  let count
  mount(
    document.body,
    stateHost((self) => {
      count = initState(self, 'c43.count', 1)
      return late()
    }),
  )
  await settled()
  expect(renderedText(document.body)).toEqual('1')
  count.set(2)
  expect(renderedText(document.body)).toEqual('2')
})

test('a state resolved after the component left the page throws', async () => {
  let failure = null
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const late = component('c43b-late', {
    setup: async (self) => {
      await gate
      try {
        useState(self, 'c43b.count')
      } catch (error) {
        failure = error
      }
      return div('late')
    },
  })
  const host = late()
  mount(
    document.body,
    stateHost((self) => {
      initState(self, 'c43b.count', 1)
      return host
    }),
  )
  host.remove()
  await settled()
  release()
  await settled()
  expect(failure?.message).toContain('has left the page')
  expect(failure?.message).toContain('resolve it in setup')
})

test('the error view receives self and can bind a state', () => {
  const card = component('c43c-card', {
    setup: () => {
      throw new Error('boom')
    },
    error: (self, error) => div(useState(self, 'c43c.label').text(), ': ', error.message),
  })
  let label
  mount(
    document.body,
    stateHost((self) => {
      label = initState(self, 'c43c.label', 'failed')
      return card()
    }),
  )
  expect(renderedText(document.body)).toEqual('failed: boom')
  label.set('broken')
  expect(renderedText(document.body)).toEqual('broken: boom')
})

test('a throwing loading on remount is contained', async () => {
  let loadingCalls = 0
  const flaky = component('c40-flaky', {
    loading: () => {
      loadingCalls++
      if (loadingCalls > 1) throw new Error('loading boom')
      return 'loading'
    },
    setup: () => div('ready'),
  })
  const errors = spy(console, 'error', () => {})
  const host = flaky()
  mount(document.body, host)
  host.remove()
  await settled()
  document.body.append(host)
  await settled()
  expect(renderedText(host)).toEqual('ready')
  expect(errors.calls.length).toEqual(1)
  expect(errors.calls[0][0]).toContain('loading failed')
})

test('an unmount does not rebuild the loading content', async () => {
  let loadingCalls = 0
  const card = component('c54-remove-loading', {
    loading: () => {
      loadingCalls++
      return span('loading')
    },
    setup: () => Promise.resolve(div('ready')),
  })
  const host = card()
  expect(loadingCalls).toEqual(1)
  mount(document.body, host)
  await settled()
  expect(renderedText(host)).toEqual('ready')
  host.remove()
  await settled()
  expect(loadingCalls).toEqual(1)
  expect(renderedText(host)).toEqual('')
})

test('a remount rebuilds the loading content at connect time', async () => {
  let loadingCalls = 0
  let resolveGate
  const card = component('c55-remount-ph', {
    loading: () => {
      loadingCalls++
      return span('loading')
    },
    setup: () => new Promise((resolve) => (resolveGate = resolve)).then(() => div('ready')),
  })
  const host = card()
  expect(loadingCalls).toEqual(1)
  mount(document.body, host)
  resolveGate()
  await settled()
  expect(renderedText(host)).toEqual('ready')
  host.remove()
  await settled()
  expect(loadingCalls).toEqual(1)
  document.body.append(host)
  expect(loadingCalls).toEqual(2)
  expect(renderedText(host)).toEqual('loading')
  resolveGate()
  await settled()
  expect(renderedText(host)).toEqual('ready')
})

test('an async onRemove can detect a remount superseded it via self.abortSignal', async () => {
  const events = []
  let sharedOpen = false
  const editor = component('c56-cancel', {
    setup: () => {
      sharedOpen = true
      return div('editor')
    },
    onRemove: async (self) => {
      await Promise.resolve()
      if (self.abortSignal.aborted) {
        events.push('bailed')
        return
      }
      sharedOpen = false
      events.push('closed')
    },
  })
  const host = editor()
  document.body.append(host)
  host.remove()
  await Promise.resolve()
  document.body.append(host)
  await settled()
  expect(events).toEqual(['bailed'])
  expect(sharedOpen).toEqual(true)
})

test('a permanent async onRemove sees an unaborted self.abortSignal and runs to the end', async () => {
  const events = []
  let sharedOpen = false
  const editor = component('c57-cancel-clean', {
    setup: () => {
      sharedOpen = true
      return div('editor')
    },
    onRemove: async (self) => {
      await Promise.resolve()
      if (self.abortSignal.aborted) {
        events.push('bailed')
        return
      }
      sharedOpen = false
      events.push('closed')
    },
  })
  const host = editor()
  document.body.append(host)
  host.remove()
  await settled()
  expect(events).toEqual(['closed'])
  expect(sharedOpen).toEqual(false)
})

test('self.abortSignal is live during mount and aborts when the component is removed', async () => {
  let mountSignal
  const probe = component('c58-abort-mount', {
    setup: (self) => {
      mountSignal = self.abortSignal
      return div('up')
    },
  })
  const host = probe()
  document.body.append(host)
  await settled()
  expect(mountSignal.aborted).toEqual(false)
  host.remove()
  await settled()
  expect(mountSignal.aborted).toEqual(true)
})

test('setup and onRemove receive the same self.abortSignal, unaborted while onRemove runs', async () => {
  let mountSignal
  let unmountSignal
  let abortedDuringUnmount
  const probe = component('c59-abort-shared', {
    setup: (self) => {
      mountSignal = self.abortSignal
      return div('up')
    },
    onRemove: (self) => {
      unmountSignal = self.abortSignal
      abortedDuringUnmount = self.abortSignal.aborted
    },
  })
  const host = probe()
  document.body.append(host)
  await settled()
  host.remove()
  await settled()
  expect(unmountSignal === mountSignal).toEqual(true)
  expect(abortedDuringUnmount).toEqual(false)
  expect(mountSignal.aborted).toEqual(true)
})

test('a remount aborts the previous mount abortSignal', async () => {
  let firstSignal
  let secondSignal
  const probe = component('c60-abort-remount', {
    setup: (self) => {
      firstSignal ??= self.abortSignal
      secondSignal = self.abortSignal
      return div('up')
    },
  })
  const host = probe()
  document.body.append(host)
  await settled()
  host.remove()
  await settled()
  document.body.append(host)
  await settled()
  expect(firstSignal.aborted).toEqual(true)
  expect(secondSignal.aborted).toEqual(false)
  expect(firstSignal === secondSignal).toEqual(false)
})

test('setup receives self, which exposes the host element', () => {
  let seen
  const probe = component('c45-self', {
    setup: (self) => {
      seen = self
      return div('x')
    },
  })
  const host = probe()
  mount(document.body, host)
  expect(seen.host === host).toBeTruthy()
  expect(seen.host.shadowRoot.textContent).toEqual('x')
})

test('onMount runs after the returned DOM is placed and connected', async () => {
  let connectedWhenRun = null
  const probe = component('c46b-after', {
    setup: (self) => {
      self.field = input()
      return div(self.field)
    },
    onMount: (self) => {
      connectedWhenRun = self.field.isConnected
    },
  })
  mount(document.body, probe())
  expect(connectedWhenRun).toEqual(null)
  await nextFrame()
  expect(connectedWhenRun).toEqual(true)
})

test('onMount sees a node that an async setup made after an await', async () => {
  let focusedValue
  const probe = component('c46c-after-async', {
    loading: () => 'loading',
    setup: async (self) => {
      const name = await Promise.resolve('Ada')
      self.field = input({ value: name })
      return div(self.field)
    },
    onMount: (self) => {
      focusedValue = self.field.isConnected ? self.field.value : null
    },
  })
  mount(document.body, probe())
  await settled()
  await nextFrame()
  expect(focusedValue).toEqual('Ada')
})

test('onMount can query the shadow root', async () => {
  let found
  const probe = component('c46d-after-query', {
    setup: () => div(span({ class: 'label' }, 'inside')),
    onMount: (self) => {
      found = self.host.shadowRoot.querySelector('.label')?.textContent
    },
  })
  mount(document.body, probe())
  await nextFrame()
  expect(found).toEqual('inside')
})

test('onMount does not run when the component unmounts before the frame', async () => {
  let ran = false
  const probe = component('c46e-after-cancel', {
    setup: () => div('x'),
    onMount: () => {
      ran = true
    },
  })
  const host = probe()
  mount(document.body, host)
  host.remove()
  await settled()
  await nextFrame()
  expect(ran).toEqual(false)
})

test('a throwing onMount reaches the nearest error boundary', async () => {
  let caught
  const child = component('c46f-after-throw', {
    setup: () => div('child'),
    onMount: () => {
      throw new Error('boom')
    },
  })
  const boundary = component('c46f-boundary', {
    setup: () => div(child()),
    error: (_self, error) => {
      caught = error
      return div('error view')
    },
  })
  mount(document.body, boundary())
  await nextFrame()
  expect(caught?.message).toEqual('boom')
  expect(renderedText(document.body)).toEqual('error view')
})

test('onMount does not run after the error view replaced the content', async () => {
  let ran = false
  const probe = component('c46g-after-error', {
    setup: () => {
      throw new Error('boom')
    },
    onMount: () => {
      ran = true
    },
    error: () => div('error view'),
  })
  mount(document.body, probe())
  await nextFrame()
  expect(ran).toEqual(false)
})

test('data stashed on self travels from setup to onRemove', async () => {
  let mountInstance
  let unmountInstance
  const probe = component('c47-carry', {
    setup: (self) => {
      self.token = 'abc'
      mountInstance = self
      return div('x')
    },
    onRemove: (self) => {
      unmountInstance = self
    },
  })
  const host = probe()
  mount(document.body, host)
  host.remove()
  await settled()
  expect(unmountInstance === mountInstance).toBeTruthy()
  expect(unmountInstance.token).toEqual('abc')
})

test('each mount carries its own self - no cross-mount clobbering', async () => {
  const cleared = []
  const timer = component('c48-timer', {
    setup: (self, id) => {
      self.id = id
      return div(id)
    },
    onRemove: (self) => cleared.push(self.id),
  })
  const first = timer('a')
  const second = timer('b')
  mount(document.body, div(first, second))
  first.remove()
  second.remove()
  await settled()
  expect([...cleared].sort()).toEqual(['a', 'b'])
})

test('self survives a move - the same object reaches onRemove, no remount', async () => {
  let mounts = 0
  let mountInstance
  let unmountInstance
  const box = component('c49-move', {
    setup: (self) => {
      mounts++
      mountInstance = self
      return div('content')
    },
    onRemove: (self) => {
      unmountInstance = self
    },
  })
  const host = box()
  mount(document.body, div(host))
  const target = div()
  document.body.append(target)
  target.append(host)
  await settled()
  expect(mounts).toEqual(1)
  host.remove()
  await settled()
  expect(unmountInstance === mountInstance).toBeTruthy()
})

test('an async onRemove is awaited before the unmount settles', async () => {
  const steps = []
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const probe = component('c50-async-unmount', {
    setup: () => div('x'),
    onRemove: async () => {
      steps.push('start')
      await gate
      steps.push('done')
    },
  })
  const host = probe()
  mount(document.body, host)
  host.remove()
  await settled()
  expect(steps).toEqual(['start'])
  release()
  await settled()
  expect(steps).toEqual(['start', 'done'])
})

test('a rejected async onRemove is contained and still empties the shadow', async () => {
  const errors = spy(console, 'error', () => {})
  const probe = component('c51-async-unmount-error', {
    loading: () => 'down',
    setup: () => div('up'),
    onRemove: async () => {
      await Promise.resolve()
      throw new Error('async cleanup boom')
    },
  })
  const host = probe()
  mount(document.body, host)
  host.remove()
  await settled()
  expect(renderedText(host)).toEqual('')
  expect(errors.calls.length).toEqual(1)
  expect(errors.calls[0][0]).toContain('onRemove failed')
})

test('a remount during an async onRemove is not clobbered by the outgoing onRemove', async () => {
  let mounts = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const probe = component('c52-remount-race', {
    loading: () => 'placeholder',
    setup: () => {
      mounts++
      return div(`mount ${mounts}`)
    },
    onRemove: () => gate,
  })
  const host = probe()
  document.body.append(host)
  expect(mounts).toEqual(1)
  host.remove()
  await settled()
  document.body.append(host)
  expect(mounts).toEqual(2)
  expect(renderedText(host)).toEqual('mount 2')
  release()
  await settled()
  expect(renderedText(host)).toEqual('mount 2')
})
