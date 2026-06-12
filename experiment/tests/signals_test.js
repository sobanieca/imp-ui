// Signals are DOM-free — tested without the polyfill.
import { assertEquals, assertThrows } from 'jsr:@std/assert@^1'
import { batch, computed, effect, signal, subscribe, untrack } from '../imp/signals.js'
import { createScope, disposeScope, onDispose, runInScope } from '../imp/scope.js'

Deno.test('signal: read, set, update, peek', () => {
  const count = signal(1)
  assertEquals(count(), 1)
  count.set(5)
  assertEquals(count(), 5)
  count.update((v) => v + 1)
  assertEquals(count.peek(), 6)
})

Deno.test('effect: runs once, re-runs on change, skips equal sets', () => {
  const count = signal(0)
  let runs = 0
  effect(() => {
    count()
    runs++
  })
  assertEquals(runs, 1)
  count.set(1)
  assertEquals(runs, 2)
  count.set(1) // Object.is-equal → no notify
  assertEquals(runs, 2)
})

Deno.test('effect: returned stop function unsubscribes', () => {
  const count = signal(0)
  let runs = 0
  const stop = effect(() => {
    count()
    runs++
  })
  stop()
  count.set(1)
  assertEquals(runs, 1)
})

Deno.test('effect: dynamic dependencies re-track per run', () => {
  const which = signal(true)
  const a = signal('a')
  const b = signal('b')
  let runs = 0
  effect(() => {
    which() ? a() : b()
    runs++
  })
  assertEquals(runs, 1)
  b.set('b2') // not a dependency yet
  assertEquals(runs, 1)
  which.set(false)
  assertEquals(runs, 2)
  a.set('a2') // no longer a dependency
  assertEquals(runs, 2)
  b.set('b3')
  assertEquals(runs, 3)
})

Deno.test('computed: derives and updates', () => {
  const items = signal([1, 2, 3])
  const total = computed(() => items().reduce((s, x) => s + x, 0))
  assertEquals(total(), 6)
  items.set([10, 20])
  assertEquals(total(), 30)
})

Deno.test('batch: coalesces multiple sets into one flush', () => {
  const a = signal(1)
  const b = signal(2)
  let runs = 0
  effect(() => {
    a()
    b()
    runs++
  })
  batch(() => {
    a.set(10)
    b.set(20)
    assertEquals(runs, 1) // nothing flushed yet
  })
  assertEquals(runs, 2)
})

Deno.test('untrack: reads without subscribing', () => {
  const tracked = signal(0)
  const ignored = signal(0)
  let runs = 0
  effect(() => {
    tracked()
    untrack(() => ignored())
    runs++
  })
  ignored.set(1)
  assertEquals(runs, 1)
  tracked.set(1)
  assertEquals(runs, 2)
})

Deno.test('subscribe: fires on change only, unsubscribes', () => {
  const count = signal(0)
  const seen = []
  const stop = subscribe(count, (v) => seen.push(v))
  assertEquals(seen, []) // not on subscribe
  count.set(1)
  count.set(2)
  assertEquals(seen, [1, 2])
  stop()
  count.set(3)
  assertEquals(seen, [1, 2])
})

Deno.test('scope: disposing a scope stops effects created inside it', () => {
  const count = signal(0)
  let runs = 0
  const scope = createScope(null)
  runInScope(scope, () =>
    effect(() => {
      count()
      runs++
    }))
  count.set(1)
  assertEquals(runs, 2)
  disposeScope(scope)
  count.set(2)
  assertEquals(runs, 2)
})

Deno.test('scope: disposal cascades to child scopes and runs disposers', () => {
  const parent = createScope(null)
  let disposed = []
  runInScope(parent, () => {
    onDispose(() => disposed.push('parent'))
    const child = createScope()
    runInScope(child, () => onDispose(() => disposed.push('child')))
  })
  disposeScope(parent)
  assertEquals(disposed.sort(), ['child', 'parent'])
})

Deno.test('effect: a throwing effect is contained', () => {
  const count = signal(0)
  let after = 0
  effect(() => {
    if (count() === 1) throw new Error('boom')
  })
  effect(() => {
    count()
    after++
  })
  count.set(1) // first effect throws, second still runs
  assertEquals(after, 2)
})
