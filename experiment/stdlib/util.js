// Shared helpers for stdlib components. Stdlib components take
// (props?, ...children) in any order (same dispatch feel as el()); `class`
// in props must be a string and is merged with the component's own class.

import { isPlainObject } from "../imp/imp.js";

export function split(rest) {
  const props = {};
  const children = [];
  for (const arg of rest) {
    if (isPlainObject(arg)) Object.assign(props, arg);
    else children.push(arg);
  }
  return [props, children];
}

export const cx = (...classes) => classes.filter(Boolean).join(" ");

let counter = 0;
export const uid = (prefix = "imp") => `${prefix}-${++counter}`;

export const isSignal = (v) =>
  typeof v === "function" && typeof v.set === "function";

export const read = (v) => typeof v === "function" ? v() : v;
