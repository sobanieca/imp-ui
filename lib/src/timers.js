import { endWithMount } from './component.js'
import { impLogger } from './logger.js'

const isAbort = (error) => error?.code === 'aborted' || error?.name === 'AbortError'

const checkArguments = (call, self, ms, { allowZero }) => {
  if (typeof self?.abortSignal?.addEventListener !== 'function') {
    throw new Error(`imp: ${call} - the first argument must be the self that imp passes to setup`)
  }
  const valid = typeof ms === 'number' && Number.isFinite(ms) && (allowZero ? ms >= 0 : ms > 0)
  if (!valid) {
    const range = allowZero ? 'zero or a positive number' : 'a positive number'
    throw new Error(`imp: ${call} - ms must be ${range} of milliseconds`)
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

export function interval(self, ms, run, { whenVisible = false } = {}) {
  const call = 'interval(self, ms, run)'
  checkArguments(call, self, ms, { allowZero: false })
  checkRun(call, run)
  let running = false
  let stopped = false
  let missed = false
  const hidden = () => whenVisible && document.visibilityState === 'hidden'
  const tick = async () => {
    if (running || stopped) return
    if (hidden()) {
      missed = true
      return
    }
    running = true
    await runLogged(self, run, 'an interval run', () => stopped)
    running = false
  }
  let timer = setInterval(() => void tick(), ms)
  const resume = () => {
    if (!missed || hidden()) return
    missed = false
    clearInterval(timer)
    timer = setInterval(() => void tick(), ms)
    void tick()
  }
  if (whenVisible) document.addEventListener('visibilitychange', resume)
  const stop = () => {
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', resume)
  }
  endWithMount(self, call, stop)
  return stop
}

export function delay(self, ms, run) {
  const call = 'delay(self, ms, run)'
  checkArguments(call, self, ms, { allowZero: true })
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
