// Element-factory core (essence #7–#9, #15). el(tag, ...args) returns a real
// DOM node. Args are dispatched by type, not position:
//   array → children · string/number → text · plain object → props ·
//   Node → child · function → reactive · null/undefined/false → skipped
// Prop keys are HTML attribute names verbatim (class, for, data-*).

import { effect } from "./signals.js";
import { createScope, disposeScope, runInScope, scopeSignal } from "./scope.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Attributes whose IDL property is read-only or detached from the attribute —
// these must go through setAttribute (review.md §5).
const FORCE_ATTR = new Set(["list", "form"]);

export function isPlainObject(v) {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// Escape hatch for the "function means reactive" rule: raw(fn) assigns fn
// as-is (callback property on a custom element, etc.).
const RAW = Symbol("imp.raw");
export function raw(value) {
  return { [RAW]: true, value };
}
const isRaw = (v) => v !== null && typeof v === "object" && v[RAW] === true;

function normalize(args) {
  let props = null;
  const children = [];
  const push = (v) => {
    if (v === null || v === undefined || v === false || v === true) return;
    if (Array.isArray(v)) {
      for (const c of v) push(c);
      return;
    }
    if (v instanceof Node) {
      children.push(v);
      return;
    }
    if (typeof v === "function") {
      children.push(v);
      return;
    }
    if (
      typeof v === "string" || typeof v === "number" || typeof v === "bigint"
    ) {
      children.push(String(v));
    }
    // anything else at child position is dropped
  };
  for (const a of args) {
    if (isPlainObject(a)) props = Object.assign(props ?? {}, a);
    else push(a);
  }
  return { props, children };
}

function setAttr(node, k, v) {
  if (v === null || v === undefined || v === false) node.removeAttribute(k);
  else node.setAttribute(k, v === true ? "" : String(v));
}

// Property-first fallthrough: handles booleans (disabled/checked), live form
// state (value/selected/indeterminate), and custom-element properties in one
// path. Names not exposed as JS properties (class, for, data-*, aria-*) fall
// to setAttribute. SVG always uses attributes (properties are read-only).
function setProp(node, k, v) {
  if (node.namespaceURI === SVG_NS || FORCE_ATTR.has(k)) {
    return setAttr(node, k, v);
  }
  if (k in node) {
    try {
      node[k] = v === null || v === undefined ? "" : v;
      return;
    } catch { /* read-only property — fall through to attribute */ }
  }
  setAttr(node, k, v);
}

// events: { click: fn } or { click: [fn, { once: true }] } — native DOM event
// names, attached with the owning scope's AbortSignal so framework-driven
// unmount detaches everything in one abort (essence #13, #15).
function applyEvents(node, events) {
  const signal = scopeSignal();
  for (const name in events) {
    const entry = events[name];
    const [fn, opts] = Array.isArray(entry) ? entry : [entry, null];
    if (typeof fn !== "function") continue;
    node.addEventListener(name, fn, opts ? { signal, ...opts } : { signal });
  }
}

const styleKey = (k) =>
  k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

function setStyleEntry(node, k, v) {
  if (v === null || v === undefined || v === false) {
    node.style.removeProperty(styleKey(k));
  } else node.style.setProperty(styleKey(k), String(v));
}

function applyStyle(node, style) {
  if (typeof style === "string") {
    node.setAttribute("style", style);
    return;
  }
  if (typeof style === "function") {
    effect(() => {
      const v = style();
      node.style.cssText = typeof v === "string" ? v : "";
      if (v && typeof v === "object") {
        for (const k in v) setStyleEntry(node, k, v[k]);
      }
    });
    return;
  }
  if (!style || typeof style !== "object") return;
  for (const k in style) {
    const v = style[k];
    if (typeof v === "function") effect(() => setStyleEntry(node, k, v()));
    else setStyleEntry(node, k, v);
  }
}

// class: "card" · ["card", extra] · () => names() · { active: isSelected }
// (object values may be signals — reactive per-entry toggling, essence-style
// state variants).
function applyClass(node, cls) {
  if (typeof cls === "string") {
    node.setAttribute("class", cls);
    return;
  }
  if (typeof cls === "function") {
    effect(() => node.setAttribute("class", cls() ?? ""));
    return;
  }
  if (Array.isArray(cls)) {
    node.setAttribute(
      "class",
      cls.filter((c) => typeof c === "string" && c).join(" "),
    );
    return;
  }
  if (!cls || typeof cls !== "object") return;
  for (const name in cls) {
    const v = cls[name];
    if (typeof v === "function") {
      effect(() => node.classList.toggle(name, !!v()));
    } else node.classList.toggle(name, !!v);
  }
}

function applyProps(node, props) {
  for (const k in props) {
    const v = props[k];
    if (k === "events") {
      if (v && typeof v === "object") applyEvents(node, v);
      continue;
    }
    if (k === "style") {
      applyStyle(node, v);
      continue;
    }
    if (k === "class") {
      applyClass(node, v);
      continue;
    }
    if (isRaw(v)) {
      node[k] = v.value;
      continue;
    } // forced property assignment
    if (typeof v === "function") {
      effect(() => setProp(node, k, v()));
      continue;
    }
    setProp(node, k, v);
  }
}

function appendChildren(node, children) {
  for (const c of children) {
    if (typeof c === "function") {
      // Reactive child → live text node. Structural changes belong to
      // when/each/match, so a Node coming out of a function child is almost
      // always a forgotten call: div(userMenu) instead of div(userMenu()).
      const t = document.createTextNode("");
      effect(() => {
        const v = c();
        if (v instanceof Node) {
          console.warn(
            "imp: function child returned a DOM node — call the component (comp()), or use when()/each() for reactive structure",
            node,
          );
          t.textContent = "";
          return;
        }
        t.textContent = v === null || v === undefined || v === false
          ? ""
          : String(v);
      });
      node.appendChild(t);
    } else if (typeof c === "string") {
      node.appendChild(document.createTextNode(c));
    } else {
      node.appendChild(c);
    }
  }
}

export function el(tag, ...args) {
  const node = document.createElement(tag);
  const { props, children } = normalize(args);
  if (props) applyProps(node, props);
  appendChildren(node, children);
  return node;
}

// svg.circle({ r: 40 }) — any SVG tag via proxy; attributes set verbatim
// (case-sensitive names like viewBox round-trip through setAttribute).
export const svg = new Proxy({}, {
  get: (_, tag) => (...args) => {
    const node = document.createElementNS(SVG_NS, tag);
    const { props, children } = normalize(args);
    if (props) applyProps(node, props);
    appendChildren(node, children);
    return node;
  },
});

const TAGS = [
  "div",
  "p",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "a",
  "button",
  "input",
  "label",
  "textarea",
  "select",
  "option",
  "optgroup",
  "datalist",
  "output",
  "progress",
  "section",
  "header",
  "main",
  "footer",
  "nav",
  "aside",
  "article",
  "img",
  "picture",
  "source",
  "pre",
  "code",
  "strong",
  "em",
  "small",
  "hr",
  "br",
  "b",
  "i",
  "u",
  "sub",
  "sup",
  "mark",
  "kbd",
  "abbr",
  "time",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "col",
  "colgroup",
  "form",
  "fieldset",
  "legend",
  "dialog",
  "details",
  "summary",
  "blockquote",
  "figure",
  "figcaption",
  "canvas",
  "video",
  "audio",
  "iframe",
  "address",
  "menu",
];

export const {
  div,
  p,
  span,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  ul,
  ol,
  li,
  dl,
  dt,
  dd,
  a,
  button,
  input,
  label,
  textarea,
  select,
  option,
  optgroup,
  datalist,
  output,
  progress,
  section,
  header,
  main,
  footer,
  nav,
  aside,
  article,
  img,
  picture,
  source,
  pre,
  code,
  strong,
  em,
  small,
  hr,
  br,
  b,
  i,
  u,
  sub,
  sup,
  mark,
  kbd,
  abbr,
  time,
  table,
  thead,
  tbody,
  tfoot,
  tr,
  th,
  td,
  caption,
  col,
  colgroup,
  form,
  fieldset,
  legend,
  dialog,
  details,
  summary,
  blockquote,
  figure,
  figcaption,
  canvas,
  video,
  audio,
  iframe,
  address,
  menu,
} = Object.fromEntries(TAGS.map((t) => [t, (...args) => el(t, ...args)]));

// Render into a server-emitted placeholder or the app root (essence #19).
// view: a component function (run in a fresh root scope) or a built Node.
// Returns an unmount function that disposes the scope and clears the target.
export function mount(target, view) {
  const host = typeof target === "string"
    ? document.querySelector(target)
    : target;
  if (!host) throw new Error("imp: mount target not found: " + target);
  const scope = createScope(null);
  const out = typeof view === "function" ? runInScope(scope, view) : view;
  host.replaceChildren();
  for (const n of Array.isArray(out) ? out : [out]) {
    if (n) {
      host.appendChild(typeof n === "string" ? document.createTextNode(n) : n);
    }
  }
  return () => {
    disposeScope(scope);
    host.replaceChildren();
  };
}

// Trusted raw HTML → DocumentFragment. Never pass user input through this.
export function html(str) {
  const tpl = document.createElement("template");
  tpl.innerHTML = str;
  return tpl.content;
}
