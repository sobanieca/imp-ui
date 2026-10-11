const FRAME_MS = 16
const MAX_TIMER_STEPS = 100_000

export function createClock(options) {
  const native = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    Date: globalThis.Date,
    performance: globalThis.performance,
  }

  const resolveStart = () => {
    const value = options?.now
    if (value === undefined) return native.Date.now()
    if (typeof value === 'number') return value
    return new native.Date(value).getTime()
  }

  let currentTime = resolveStart()
  let nextId = 1
  let installed = false
  const scheduled = new Map()
  const realPerformanceNow = native.performance?.now

  class FakeDate extends native.Date {
    constructor(...args) {
      super(...(args.length === 0 ? [currentTime] : args))
    }
    static now() {
      return currentTime
    }
  }

  const schedule = (callback, delay, args, { interval = null, raf = false } = {}) => {
    const id = nextId++
    const wait = raf ? FRAME_MS : Math.max(0, Number(delay) || 0)
    scheduled.set(id, {
      id,
      callback,
      args,
      raf,
      time: currentTime + wait,
      interval: interval === null ? null : Math.max(0, Number(interval) || 0),
    })
    return id
  }

  const nextDue = (limit) => {
    let candidate = null
    for (const entry of scheduled.values()) {
      if (limit !== undefined && entry.time > limit) continue
      if (
        candidate === null ||
        entry.time < candidate.time ||
        (entry.time === candidate.time && entry.id < candidate.id)
      ) candidate = entry
    }
    return candidate
  }

  const fire = (entry) => {
    currentTime = entry.time
    if (entry.interval === null) scheduled.delete(entry.id)
    else entry.time = currentTime + entry.interval
    return entry.raf ? entry.callback(currentTime) : entry.callback(...entry.args)
  }

  const guard = (steps, method) => {
    if (steps > MAX_TIMER_STEPS) {
      throw new Error(
        `clock.${method}() exceeded ${MAX_TIMER_STEPS} timers - an unbounded interval is rescheduling without end`,
      )
    }
  }

  const flushPromises = () => new Promise((resolve) => native.setTimeout.call(globalThis, resolve, 0))

  const setPerformanceNow = (fn) => {
    if (!native.performance || !realPerformanceNow) return
    try {
      if (fn === realPerformanceNow) delete native.performance.now
      else native.performance.now = fn
    } catch { /* performance.now is not writable in this runtime */ }
  }

  const clock = {
    get now() {
      return currentTime
    },
    async tick(ms = 0) {
      const limit = currentTime + Math.max(0, Number(ms) || 0)
      let steps = 0
      let entry
      await flushPromises()
      while ((entry = nextDue(limit))) {
        guard(++steps, 'tick')
        await fire(entry)
        await flushPromises()
      }
      currentTime = limit
    },
    async runAll() {
      let steps = 0
      let entry
      await flushPromises()
      while ((entry = nextDue())) {
        guard(++steps, 'runAll')
        await fire(entry)
        await flushPromises()
      }
    },
    restore() {
      if (!installed) return
      installed = false
      globalThis.setTimeout = native.setTimeout
      globalThis.clearTimeout = native.clearTimeout
      globalThis.setInterval = native.setInterval
      globalThis.clearInterval = native.clearInterval
      globalThis.Date = native.Date
      if (native.requestAnimationFrame) {
        globalThis.requestAnimationFrame = native.requestAnimationFrame
        globalThis.cancelAnimationFrame = native.cancelAnimationFrame
      }
      setPerformanceNow(realPerformanceNow)
    },
  }

  globalThis.setTimeout = (callback, delay, ...args) => schedule(callback, delay, args)
  globalThis.clearTimeout = (id) => scheduled.delete(id)
  globalThis.setInterval = (callback, delay, ...args) =>
    schedule(callback, delay, args, { interval: delay })
  globalThis.clearInterval = (id) => scheduled.delete(id)
  globalThis.Date = FakeDate
  if (native.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (callback) => schedule(callback, 0, [], { raf: true })
    globalThis.cancelAnimationFrame = (id) => scheduled.delete(id)
  }
  setPerformanceNow(() => currentTime)
  installed = true

  return clock
}
