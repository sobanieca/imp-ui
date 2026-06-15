// Structural primitives (essence #12). Each one anchors a slot with a comment
// marker and swaps siblings around it. Every branch/row runs in its own scope,
// so listeners, effects, and fetches inside are disposed together on swap-out.
// The marker is returned inside a DocumentFragment so the first render works
// before the slot is attached; the fragment empties into the parent on insert
// and the marker keeps anchoring the slot from then on.

import { effect, untrack } from "./signals.js";
import {
  createScope,
  disposeScope,
  getScope,
  onDispose,
  runInScope,
} from "./scope.js";

function nodesOf(v) {
  const out = [];
  const push = (x) => {
    if (x === null || x === undefined || x === false || x === true) return;
    if (Array.isArray(x)) {
      for (const c of x) push(c);
      return;
    }
    if (
      typeof DocumentFragment !== "undefined" && x instanceof DocumentFragment
    ) {
      for (const c of [...x.childNodes]) out.push(c);
      return;
    }
    if (x instanceof Node) {
      out.push(x);
      return;
    }
    out.push(document.createTextNode(String(x)));
  };
  push(v);
  return out;
}

function insertAfter(marker, nodes) {
  const parent = marker.parentNode;
  if (!parent) return;
  let ref = marker;
  for (const n of nodes) {
    parent.insertBefore(n, ref.nextSibling);
    ref = n;
  }
}

function slot(name) {
  const frag = document.createDocumentFragment();
  const marker = document.createComment(name);
  frag.appendChild(marker);
  return { frag, marker };
}

// when(cond, render) — re-renders the slot whenever cond() changes.
// render(value) may return a Node, array, string, or null/false (empty slot).
// Signals read inside render are NOT dependencies of the slot — only cond is.
export function when(cond, render) {
  const { frag, marker } = slot("when");
  const owner = getScope();
  let scope = null;
  let nodes = [];
  effect(() => {
    const v = typeof cond === "function" ? cond() : cond;
    if (scope) disposeScope(scope);
    for (const n of nodes) n.remove();
    scope = createScope(owner);
    const out = runInScope(scope, () => untrack(() => render(v)));
    nodes = nodesOf(out);
    insertAfter(marker, nodes);
  });
  return frag;
}

// match(sig, branches) — finite-state branching. The branch key is sig()
// itself, or sig() can be a [key, payload] pair; the branch receives the
// payload (or the key). `_` is the fallback branch.
export function match(sig, branches) {
  const { frag, marker } = slot("match");
  const owner = getScope();
  let scope = null;
  let nodes = [];
  effect(() => {
    const v = typeof sig === "function" ? sig() : sig;
    const [key, payload] = Array.isArray(v) ? v : [v, v];
    const render = branches[key] ?? branches._;
    if (scope) disposeScope(scope);
    for (const n of nodes) n.remove();
    scope = createScope(owner);
    const out = render
      ? runInScope(scope, () => untrack(() => render(payload)))
      : null;
    nodes = nodesOf(out);
    insertAfter(marker, nodes);
  });
  return frag;
}

// each(list, renderItem, getKey) — keyed list. Stable keys keep their DOM
// (focus, input state, animations survive reorders). renderItem runs once per
// key in its own scope; row updates beyond identity belong to signals carried
// by the items themselves.
export function each(list, renderItem, getKey = (item) => item.id) {
  const { frag, marker } = slot("each");
  const owner = getScope();
  const rows = new Map(); // key → { nodes, scope }
  effect(() => {
    const items = (typeof list === "function" ? list() : list) ?? [];
    const parent = marker.parentNode;
    if (!parent) return;
    const seen = new Set();
    let prev = marker;
    let index = 0;
    for (const item of items) {
      const key = getKey(item, index++);
      if (seen.has(key)) {
        console.warn("imp: each() duplicate key, item skipped:", key);
        continue;
      }
      seen.add(key);
      let row = rows.get(key);
      if (!row) {
        const scope = createScope(owner);
        const out = runInScope(scope, () => untrack(() => renderItem(item)));
        row = { nodes: nodesOf(out), scope };
        rows.set(key, row);
      }
      for (const n of row.nodes) {
        if (prev.nextSibling !== n) parent.insertBefore(n, prev.nextSibling);
        prev = n;
      }
    }
    for (const [key, row] of rows) {
      if (!seen.has(key)) {
        disposeScope(row.scope);
        for (const n of row.nodes) n.remove();
        rows.delete(key);
      }
    }
  });
  return frag;
}

// ---------------------------------------------------------------------------
// onMount(node, fn) — fn(node) runs after the node is attached to the
// document (focus, measurement, third-party lib init all work). A returned
// function is the disposer, tied to the scope active at the onMount call.
// Returns the node, so it composes inline: onMount(input(), n => n.focus()).

const pendingMounts = new Set();
let mountObserver = null;

function runEntry(entry) {
  const { node, fn, scope } = entry;
  if (scope?.disposed) return;
  const exec = () => {
    const cleanup = fn(node);
    if (typeof cleanup === "function") onDispose(cleanup);
  };
  try {
    if (scope) runInScope(scope, exec);
    else exec();
  } catch (e) {
    console.error("imp: onMount callback threw", e);
  }
}

function flushConnected() {
  for (const entry of [...pendingMounts]) {
    if (entry.node.isConnected) {
      pendingMounts.delete(entry);
      runEntry(entry);
    }
  }
  if (!pendingMounts.size && mountObserver) {
    mountObserver.disconnect();
    mountObserver = null;
  }
}

export function onMount(node, fn) {
  const entry = { node, fn, scope: getScope() };
  pendingMounts.add(entry);
  onDispose(() => pendingMounts.delete(entry));
  queueMicrotask(() => {
    if (!pendingMounts.has(entry)) return;
    if (entry.node.isConnected) {
      pendingMounts.delete(entry);
      runEntry(entry);
    } else if (!mountObserver) {
      mountObserver = new MutationObserver(flushConnected);
      mountObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  });
  return node;
}

// portal(target, node) — node renders into target (default document.body),
// removed when the calling scope is disposed. Returns a marker comment for
// the logical position.
export function portal(target, node) {
  const host = typeof target === "string"
    ? document.querySelector(target)
    : target ?? document.body;
  host.appendChild(node);
  onDispose(() => node.remove());
  return document.createComment("portal");
}
