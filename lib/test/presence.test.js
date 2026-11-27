import { component, interval, mount, usePresence } from 'imp'
import { div } from 'imp/html'
import { afterEach, beforeEach, expect, test } from 'imp/test'
import { initState } from 'imp/state'

let visibility = 'visible'

const show = (state) => {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

const touch = (type = 'pointermove') => document.dispatchEvent(new Event(type))

beforeEach(() => {
  document.body.replaceChildren()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  document.body.replaceChildren()
  delete document.visibilityState
})

const host = (name, setup) => {
  const definition = component(name, {
    setup: (self) => {
      setup(self)
      return div('x')
    },
  })
  const element = definition()
  mount(document.body, element)
  return element
}

const catching = (name, call) => {
  let problem = null
  host(name, (self) => {
    try {
      call(self)
    } catch (error) {
      problem = error
    }
  })
  return problem?.message ?? ''
}

test(
  'usePresence is idle after idleAfter without input, active on input, and hidden in a hidden tab',
  async ({ clock }) => {
    let presence = null
    const seen = []
    host('presence-levels', (self) => {
      presence = usePresence(self, { idleAfter: 1000 })
      presence.watch(self, (level) => seen.push(level))
    })
    expect(presence.get()).toEqual('active')
    await clock.tick(600)
    touch()
    await clock.tick(600)
    expect(presence.get()).toEqual('active')
    await clock.tick(400)
    expect(presence.get()).toEqual('idle')
    touch('keydown')
    expect(presence.get()).toEqual('active')
    show('hidden')
    expect(presence.get()).toEqual('hidden')
    await clock.tick(5000)
    expect(presence.get()).toEqual('hidden')
    show('visible')
    expect(presence.get()).toEqual('active')
    expect(seen).toEqual(['active', 'idle', 'active', 'hidden', 'active'])
  },
  { fakeTimers: true },
)

test(
  'usePresence stops following input when its component unmounts',
  async ({ clock }) => {
    let presence = null
    const element = host('presence-unmount', (self) => {
      presence = usePresence(self, { idleAfter: 1000 })
    })
    element.remove()
    await clock.tick(2000)
    expect(presence.get()).toEqual('active')
  },
  { fakeTimers: true },
)

test('usePresence checks its options', () => {
  expect(() => usePresence({}, {})).toThrow('the first argument must be the self')
  expect(catching('presence-bad-key', (self) => usePresence(self, { after: 10 }))).toContain(
    'only { idleAfter }',
  )
  expect(catching('presence-bad-ms', (self) => usePresence(self, { idleAfter: 0 }))).toContain(
    'idleAfter must be a positive number',
  )
})

test(
  'interval with an idle period polls less often while the user is idle, and at once on return',
  async ({ clock }) => {
    let runs = 0
    host('interval-idle-slow', (self) => {
      interval(self, { active: 1000, idle: 5000 }, () => (runs += 1), { idleAfter: 2500 })
    })
    await clock.tick(2000)
    expect(runs).toEqual(2)
    await clock.tick(4999)
    expect(runs).toEqual(2)
    await clock.tick(1)
    expect(runs).toEqual(3)
    await clock.tick(1500)
    touch()
    expect(runs).toEqual(4)
    await clock.tick(1000)
    expect(runs).toEqual(5)
  },
  { fakeTimers: true },
)

test(
  'interval with a hidden period polls less often in a hidden tab',
  async ({ clock }) => {
    let runs = 0
    host('interval-idle-hidden', (self) => {
      interval(self, { active: 1000, hidden: 5000 }, () => (runs += 1))
    })
    await clock.tick(1000)
    expect(runs).toEqual(1)
    show('hidden')
    await clock.tick(4999)
    expect(runs).toEqual(1)
    await clock.tick(1)
    expect(runs).toEqual(2)
    show('visible')
    expect(runs).toEqual(2)
    await clock.tick(1000)
    expect(runs).toEqual(3)
  },
  { fakeTimers: true },
)

test(
  'interval skips ticks at a level that has no period',
  async ({ clock }) => {
    let runs = 0
    host('interval-idle-pause', (self) => {
      interval(self, { active: 1000 }, () => (runs += 1), { idleAfter: 2500 })
    })
    await clock.tick(10_000)
    expect(runs).toEqual(2)
    touch('wheel')
    expect(runs).toEqual(3)
    await clock.tick(1000)
    expect(runs).toEqual(4)
  },
  { fakeTimers: true },
)

test(
  'interval with a when state skips ticks while the state is falsy',
  async ({ clock }) => {
    let runs = 0
    let live = null
    host('interval-when', (self) => {
      live = initState(self, 'test.live', true)
      interval(self, 1000, () => (runs += 1), { when: live })
    })
    await clock.tick(1000)
    expect(runs).toEqual(1)
    live.set(false)
    await clock.tick(5000)
    expect(runs).toEqual(1)
    live.set(true)
    expect(runs).toEqual(2)
    await clock.tick(1000)
    expect(runs).toEqual(3)
  },
  { fakeTimers: true },
)

test('interval checks its periods and options', () => {
  const problem = (name, every, options) =>
    catching(name, (self) => interval(self, every, () => {}, options))
  expect(problem('interval-bad-level', { active: 1000, away: 5000 })).toContain(
    'periods in ms per level',
  )
  expect(problem('interval-no-active', { idle: 5000 })).toContain('periods in ms per level')
  expect(problem('interval-bad-period', { active: 1000, idle: 0 })).toContain(
    'periods in ms per level',
  )
  expect(problem('interval-bad-key', 1000, { visible: true })).toContain('only { idleAfter, when }')
  expect(problem('interval-lone-idle-after', 1000, { idleAfter: 1000 })).toContain(
    'idleAfter needs periods per level',
  )
  expect(problem('interval-bad-when', 1000, { when: true })).toContain('when must be a state')
})
