import { endWithMount } from './component.js'
import { impLogger } from './logger.js'

const isAbort = (error) => error?.code === 'aborted' || error?.name === 'AbortError'

export function interval(self, ms, run) {
  if (typeof self?.abortSignal?.addEventListener !== 'function') {
    throw new Error(
      'imp: interval(self, ms, run) - the first argument must be the self that imp passes to setup',
    )
  }
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    throw new Error('imp: interval(self, ms, run) - ms must be a positive number of milliseconds')
  }
  if (typeof run !== 'function') {
    throw new Error('imp: interval(self, ms, run) - run must be a function, and it can be async')
  }
  let running = false
  let stopped = false
  const tick = async () => {
    if (running || stopped) return
    running = true
    try {
      await run()
    } catch (error) {
      if (!(stopped && isAbort(error))) {
        impLogger.error(`<${self.host.localName}>: an interval run failed`, error)
      }
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => void tick(), ms)
  const stop = () => {
    stopped = true
    clearInterval(timer)
  }
  endWithMount(self, 'interval(self, ms, run)', stop)
  return stop
}
