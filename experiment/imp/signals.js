// Solid-style fine-grained signals (essence #10). Updates are synchronous;
// `batch` coalesces multiple sets into one flush. Effects created inside a
// scope are disposed with it (scope.js). A throwing effect is reported and
// skipped — it does not break the rest of the graph. Circular dependencies
// are not detected (accepted trade-off: you get the stack overflow).

import { onDispose } from "./scope.js";

let observer = null;
let batching = 0;
const queued = new Set();

export function signal(initial) {
  let value = initial;
  const subs = new Set();

  function read() {
    if (observer) {
      subs.add(observer);
      observer.deps.add(subs);
    }
    return value;
  }
  read.set = (next) => {
    if (Object.is(value, next)) return;
    value = next;
    if (batching) {
      for (const sub of subs) queued.add(sub);
    } else {
      for (const sub of [...subs]) sub();
    }
  };
  read.update = (fn) => read.set(fn(value));
  read.peek = () => value;
  return read;
}

// Runs once now, re-runs when any signal read inside changes.
// Returns a stop function; also stops automatically when the owning
// scope is disposed. Dependencies are re-tracked on every run.
export function effect(fn) {
  const run = () => {
    if (run.disposed) return;
    for (const subs of run.deps) subs.delete(run);
    run.deps.clear();
    const prev = observer;
    observer = run;
    try {
      fn();
    } catch (e) {
      console.error("imp: effect threw", e);
    } finally {
      observer = prev;
    }
  };
  run.deps = new Set();
  run.disposed = false;
  const stop = () => {
    run.disposed = true;
    for (const subs of run.deps) subs.delete(run);
    run.deps.clear();
  };
  onDispose(stop);
  run();
  return stop;
}

// Derived read-only signal (eager).
export function computed(fn) {
  const s = signal();
  effect(() => s.set(fn()));
  const read = () => s();
  read.peek = s.peek;
  return read;
}

// Read signals without subscribing the current effect to them.
export function untrack(fn) {
  const prev = observer;
  observer = null;
  try {
    return fn();
  } finally {
    observer = prev;
  }
}

// Coalesce updates: subscribers of every signal set inside fn run once,
// after fn returns.
export function batch(fn) {
  batching++;
  try {
    return fn();
  } finally {
    batching--;
    if (!batching && queued.size) {
      const subs = [...queued];
      queued.clear();
      for (const sub of subs) sub();
    }
  }
}

// Raw change notifications for third-party code (charts, storage, …).
// fn(value) runs on every change, not on subscribe. Returns unsubscribe.
export function subscribe(sig, fn) {
  let first = true;
  return effect(() => {
    const v = sig();
    if (!first) untrack(() => fn(v));
    first = false;
  });
}
