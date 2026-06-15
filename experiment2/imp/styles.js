// Buildless co-located CSS (essence #16). css`...` returns a content-hashed
// class name; the rule is injected once into one shared constructable
// stylesheet. Native CSS nesting handles &:hover / @media — no parsing here.
// Per-instance dynamic values belong in inline `style`, not in css``.

let sheet = null;
let fallbackEl = null;
const pendingRules = [];

function inject(text) {
  if (typeof document === "undefined") {
    pendingRules.push(text);
    return;
  }
  if (!sheet && !fallbackEl) {
    try {
      sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch {
      fallbackEl = document.createElement("style");
      document.head.appendChild(fallbackEl);
    }
  }
  if (sheet) {
    try {
      sheet.insertRule(text, sheet.cssRules.length);
      return;
    } catch { /* polyfill or browser rejected the rule — fall back */ }
  }
  if (!fallbackEl) {
    fallbackEl = document.createElement("style");
    document.head.appendChild(fallbackEl);
  }
  fallbackEl.textContent += "\n" + text;
}

// Injects rules queued before a DOM existed (used by imp/testing.js).
export function flushStyles() {
  const rules = pendingRules.splice(0);
  for (const text of rules) inject(text);
}

const classByText = new Map();
const usedNames = new Set();

// FNV-1a, 32-bit. Math.imul keeps the multiply in integer range;
// >>> 0 reinterprets as unsigned before base36 encoding.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function css(strings, ...values) {
  for (const v of values) {
    if (typeof v === "function") {
      throw new Error(
        "css``: function interpolation is not allowed — " +
          "reactive/per-instance values go in inline `style`, not shared rules",
      );
    }
  }
  const text = String.raw({ raw: strings }, ...values);

  let name = classByText.get(text);
  if (name) return name;

  name = "imp-" + fnv1a(text);
  while (usedNames.has(name)) name += "_";
  usedNames.add(name);

  inject(`.${name} { ${text} }`);
  classByText.set(text, name);
  return name;
}

// Top-level rules that can't live inside a class block (@keyframes,
// @font-face). One rule per call, injected once per unique text.
const globalRules = new Set();
css.global = (strings, ...values) => {
  const text = String.raw({ raw: strings }, ...values);
  if (globalRules.has(text)) return;
  globalRules.add(text);
  inject(text);
};

// Adopt the shared sheet into a shadow root (for wc.define({ shadow: true })).
export function adoptStyles(shadowRoot) {
  if (sheet) {
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
  }
}
