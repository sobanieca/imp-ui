import { endWithMount } from './component.js'
import { impLogger } from './logger.js'
import { DEFAULT_IDLE_AFTER, followPresence, idleAfterProblem } from './presence.js'
import { isStateShaped } from './render.js'

const isAbort = (error) => error?.code === 'aborted' || error?.name === 'AbortError'

const isPositiveMs = (ms) => typeof ms === 'number' && Number.isFinite(ms) && ms > 0

const checkSelf = (call, self) => {
  if (typeof self?.abortSignal?.addEventListener !== 'function') {
    throw new Error(`imp: ${call} - the first argument must be the self that imp passes to setup`)
  }
}

const checkRun = (call, run) => {
  if (typeof run !== 'function') {
    throw new Error(`imp: ${call} - run must be a function, and it can be async`)
  }
}

const runLogged = async (self, run, what, stopped) => {
  try {
    await run()
  } catch (error) {
    if (!(stopped() && isAbort(error))) {
      impLogger.error(`<${self.host.localName}>: ${what} failed`, error)
    }
  }
}

const LEVELS = ['active', 'idle', 'hidden']

const isPlainOptions = (value, keys) =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).every((key) => keys.includes(key))

const readPeriods = (call, every) => {
  if (isPositiveMs(every)) return null
  const valid =
    isPlainOptions(every, LEVELS)
    && every.active !== undefined
    && Object.values(every).every(isPositiveMs)
  if (!valid) {
    throw new Error(
      `imp: ${call} - every must be a positive number of milliseconds, or periods in ms per level, like { active: 15_000, idle: 120_000 }`,
    )
  }
  return every
}

const readIntervalOptions = (call, options, periods) => {
  if (!isPlainOptions(options, ['idleAfter', 'when'])) {
    throw new Error(`imp: ${call} - options takes only { idleAfter, when }`)
  }
  const { idleAfter, when } = options
  if (idleAfter !== undefined) {
    const problem = idleAfterProblem(idleAfter)
    if (problem) throw new Error(`imp: ${call} - ${problem}`)
    if (periods === null) {
      throw new Error(
        `imp: ${call} - idleAfter needs periods per level, like { active: 15_000, idle: 120_000 }`,
      )
    }
  }
  if (when !== undefined && !isStateShaped(when)) {
    throw new Error(`imp: ${call} - when must be a state; the interval runs while it is truthy`)
  }
  return { idleAfter: idleAfter ?? DEFAULT_IDLE_AFTER, when }
}

export function interval(self, every, run, options = {}) {
  const call = 'interval(self, every, run)'
  checkSelf(call, self)
  const periods = readPeriods(call, every)
  checkRun(call, run)
  const { idleAfter, when } = readIntervalOptions(call, options, periods)
  endWithMount(self, call, () => stop())
  let running = false
  let stopped = false
  let timer = null
  let lastStart = Date.now()
  let presence = null

  const periodNow = () => {
    if (when && !when.get()) return null
    if (periods === null) return every
    return periods[presence.level()] ?? null
  }

  const schedule = ({ afterRun = false } = {}) => {
    clearTimeout(timer)
    timer = null
    if (stopped || running) return
    const period = periodNow()
    if (period === null) return
    const elapsed = Date.now() - lastStart
    if (!afterRun && elapsed >= period) {
      void tick()
      return
    }
    timer = setTimeout(() => void tick(), period - (elapsed % period))
  }

  const tick = async () => {
    timer = null
    if (stopped || running) return
    running = true
    lastStart = Date.now()
    await runLogged(self, run, 'an interval run', () => stopped)
    running = false
    schedule({ afterRun: true })
  }

  if (periods !== null) presence = followPresence(idleAfter, () => schedule())
  const unwatchWhen = when?.watch(() => schedule())
  schedule()

  const stop = () => {
    stopped = true
    clearTimeout(timer)
    presence?.stop()
    unwatchWhen?.()
  }
  return stop
}

export function delay(self, ms, run) {
  const call = 'delay(self, ms, run)'
  checkSelf(call, self)
  if (!(isPositiveMs(ms) || ms === 0)) {
    throw new Error(`imp: ${call} - ms must be zero or a positive number of milliseconds`)
  }
  checkRun(call, run)
  let stopped = false
  const timer = setTimeout(() => void runLogged(self, run, 'a delayed run', () => stopped), ms)
  const stop = () => {
    stopped = true
    clearTimeout(timer)
  }
  endWithMount(self, call, stop)
  return stop
}
