// Web-component interop (essence #19). Two directions:
//   consume: const chart = wc('my-chart'); chart({ data, events: {...} })
//   expose:  wc.define('todo-app', todoApp) → <todo-app> in any HTML
//
// Light DOM by default so --imp-* theme variables inherit for free; shadow is
// an opt-in flag for hard isolation (the shared css`` sheet is adopted into
// the shadow root). Attributes present on the host element are passed to the
// component as string props, snapshotted at connect time.

import { el } from "./render.js";
import { adoptStyles } from "./styles.js";
import { createScope, disposeScope, runInScope } from "./scope.js";

export function wc(tagName) {
  return (...args) => el(tagName, ...args);
}

wc.define = (tagName, component, { shadow = false } = {}) => {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback() {
        if (this._impScope) return; // moved within the document — keep as-is
        const props = {};
        for (const attr of this.attributes) props[attr.name] = attr.value;
        this._impScope = createScope(null);
        const node = runInScope(this._impScope, () => component(props));
        if (shadow) {
          const root = this.attachShadow({ mode: "open" });
          adoptStyles(root);
          if (node) root.append(node);
        } else if (node) {
          this.append(node);
        }
      }
      disconnectedCallback() {
        // Defer: a same-tick re-insert (e.g. appendChild move) is not removal.
        queueMicrotask(() => {
          if (this.isConnected || !this._impScope) return;
          disposeScope(this._impScope);
          this._impScope = null;
          (this.shadowRoot ?? this).replaceChildren();
        });
      }
    },
  );
};
