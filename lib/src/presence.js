import { endWithMount } from './component.js'
import { createState, readableState } from './state.js'

export const DEFAULT_IDLE_AFTER = 300_000

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove']

const LISTENER_OPTIONS = { capture: true, passive: true }

let tracker = null

const isHidden = () => globalThis.document.visibilityState === 'hidden'

const levelAt = (watcher, now) => {
  if (isHidden()) return 'hidden'
  return now - tracker.lastInput >= watcher.idleAfter ? 'idle' : 'active'
}

const update = (watcher) => {
  clearTimeout(watcher.timer)
  watcher.timer = null
  const now = Date.now()
  const level = levelAt(watcher, now)
  if (level === 'active') {
    const remaining = watcher.idleAfter - (now - tracker.lastInput)
    watcher.timer = setTimeout(() => update(watcher), remaining)
  }
  if (level === watcher.level) return
  const changed = watcher.level !== null
  watcher.level = level
  if (changed) watcher.onChange(level)
}

const onInput = () => {
  tracker.lastInput = Date.now()
  for (const watcher of [...tracker.watchers]) {
    if (watcher.level === 'idle') update(watcher)
  }
}

const onVisibility = () => {
  if (!isHidden()) tracker.lastInput = Date.now()
  for (const watcher of [...tracker.watchers]) update(watcher)
}

const startTracker = () => {
  tracker = { lastInput: Date.now(), watchers: new Set() }
  const { document } = globalThis
  for (const type of INPUT_EVENTS) document.addEventListener(type, onInput, LISTENER_OPTIONS)
  document.addEventListener('visibilitychange', onVisibility)
}

const stopTracker = () => {
  const { document } = globalThis
  for (const type of INPUT_EVENTS) document.removeEventListener(type, onInput, LISTENER_OPTIONS)
  document.removeEventListener('visibilitychange', onVisibility)
  tracker = null
}

export const followPresence = (idleAfter, onChange) => {
  if (tracker === null) startTracker()
  const watcher = { idleAfter, onChange, level: null, timer: null }
  tracker.watchers.add(watcher)
  update(watcher)
  let stopped = false
  return {
    level: () => watcher.level,
    stop: () => {
      if (stopped) return
      stopped = true
      clearTimeout(watcher.timer)
      tracker.watchers.delete(watcher)
      if (tracker.watchers.size === 0) stopTracker()
    },
  }
}

export const idleAfterProblem = (idleAfter) =>
  typeof idleAfter === 'number' && Number.isFinite(idleAfter) && idleAfter > 0
    ? null
    : 'idleAfter must be a positive number of milliseconds'

const readIdleAfter = (call, options) => {
  const known =
    options !== null
    && typeof options === 'object'
    && !Array.isArray(options)
    && Object.keys(options).every((key) => key === 'idleAfter')
  if (!known) throw new Error(`imp: ${call} - options takes only { idleAfter }`)
  const idleAfter = options.idleAfter ?? DEFAULT_IDLE_AFTER
  const problem = idleAfterProblem(idleAfter)
  if (problem) throw new Error(`imp: ${call} - ${problem}`)
  return idleAfter
}

export function usePresence(self, options = {}) {
  const call = 'usePresence(self, { idleAfter })'
  let stop = () => {}
  endWithMount(self, call, () => stop())
  const idleAfter = readIdleAfter(call, options)
  let state = null
  const presence = followPresence(idleAfter, (level) => state.set(level))
  state = createState('imp.presence', presence.level())
  stop = presence.stop
  return readableState(state.name, () => state)
}
