// Input components. Convention: pass a signal as `value` (or `checked`) and
// the control is two-way bound — it reads the signal reactively and writes
// back on user input. Pass a plain value for an uncontrolled initial value.
// Extra props (placeholder, disabled, events, …) flow through to the element.

import {
  css,
  div,
  form,
  input,
  label,
  option,
  select,
  span,
  textarea,
} from "../imp/imp.js";
import { cx, isSignal, read, split, uid } from "./util.js";

const fieldCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--imp-space-4);
  & > label {
    font-size: var(--imp-font-size-sm);
    font-weight: var(--imp-font-weight-medium);
    color: var(--imp-color-text);
  }
`;
const controlCss = css`
  font: inherit;
  font-size: var(--imp-font-size-sm);
  color: var(--imp-color-text);
  background: var(--imp-color-surface);
  border: 1px solid var(--imp-color-border);
  border-radius: var(--imp-radius-sm);
  padding: var(--imp-space-8) var(--imp-space-12);
  &:focus-visible {
    outline: 2px solid var(--imp-color-primary);
    outline-offset: -1px;
  }
  &:disabled {
    opacity: 0.55;
  }
`;
const hintCss = css`
  font-size: var(--imp-font-size-xs);
  color: var(--imp-color-text-muted);
`;

function wrap(id, lbl, control, hint) {
  if (!lbl && !hint) return control;
  return div({ class: fieldCss }, [
    lbl ? label({ for: id }, lbl) : null,
    control,
    hint ? span({ class: hintCss }, hint) : null,
  ]);
}

export function textField(
  { label: lbl, hint, value, events = {}, class: extra, ...rest } = {},
) {
  const id = rest.id ?? uid("tf");
  const control = input({
    ...rest,
    id,
    class: cx(controlCss, extra),
    value: value ?? "",
    events: isSignal(value)
      ? { input: (e) => value.set(e.target.value), ...events }
      : events,
  });
  return wrap(id, lbl, control, hint);
}

export const datePicker = (props = {}) => textField({ type: "date", ...props });

export function textArea(
  { label: lbl, hint, value, rows = 4, events = {}, class: extra, ...rest } =
    {},
) {
  const id = rest.id ?? uid("ta");
  const control = textarea({
    ...rest,
    id,
    rows,
    class: cx(controlCss, extra),
    value: value ?? "",
    events: isSignal(value)
      ? { input: (e) => value.set(e.target.value), ...events }
      : events,
  });
  return wrap(id, lbl, control, hint);
}

// options: ['a', 'b'] or [{ value, label }]
export function selectBox(
  {
    label: lbl,
    hint,
    options = [],
    value,
    events = {},
    class: extra,
    ...rest
  } = {},
) {
  const id = rest.id ?? uid("sel");
  const control = select(
    {
      ...rest,
      id,
      class: cx(controlCss, extra),
      events: isSignal(value)
        ? { change: (e) => value.set(e.target.value), ...events }
        : events,
    },
    options.map((o) => {
      const [v, text] = typeof o === "object" ? [o.value, o.label] : [o, o];
      return option({
        value: v,
        selected: isSignal(value) ? () => read(value) === v : value === v,
      }, text);
    }),
  );
  return wrap(id, lbl, control, hint);
}

const checkRowCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--imp-space-8);
  font-size: var(--imp-font-size-sm);
  color: var(--imp-color-text);
  cursor: pointer;
  & input {
    accent-color: var(--imp-color-primary);
  }
`;

export function checkbox(
  { label: lbl, checked, events = {}, class: extra, ...rest } = {},
) {
  const box = input({
    ...rest,
    type: "checkbox",
    checked: checked ?? false,
    events: isSignal(checked)
      ? { change: (e) => checked.set(e.target.checked), ...events }
      : events,
  });
  return label({ class: cx(checkRowCss, extra) }, [box, lbl ?? null]);
}

// options: [{ value, label }] · value: signal for the selected option
export function radioGroup(
  { label: lbl, name, options = [], value, events = {}, class: extra } = {},
) {
  const group = name ?? uid("radio");
  return div({ class: cx(fieldCss, extra) }, [
    lbl ? span(lbl) : null,
    options.map((o) => {
      const [v, text] = typeof o === "object" ? [o.value, o.label] : [o, o];
      return label({ class: checkRowCss }, [
        input({
          type: "radio",
          name: group,
          value: v,
          checked: isSignal(value) ? () => read(value) === v : value === v,
          events: isSignal(value)
            ? {
              change: (e) => {
                if (e.target.checked) value.set(v);
              },
              ...events,
            }
            : events,
        }),
        text,
      ]);
    }),
  ]);
}

const switchCss = css`
  appearance: none;
  inline-size: 36px;
  block-size: 20px;
  margin: 0;
  border-radius: var(--imp-radius-full);
  background: var(--imp-color-border);
  position: relative;
  cursor: pointer;
  transition: background 0.15s;
  &::before {
    content: "";
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    inline-size: 16px;
    block-size: 16px;
    border-radius: var(--imp-radius-full);
    background: var(--imp-color-surface);
    transition: translate 0.15s;
  }
  &:checked {
    background: var(--imp-color-primary);
  }
  &:checked::before {
    translate: 16px 0;
  }
`;

export function switchToggle(
  { label: lbl, checked, events = {}, class: extra, ...rest } = {},
) {
  const box = input({
    ...rest,
    type: "checkbox",
    role: "switch",
    class: switchCss,
    checked: checked ?? false,
    events: isSignal(checked)
      ? { change: (e) => checked.set(e.target.checked), ...events }
      : events,
  });
  return label({ class: cx(checkRowCss, extra) }, [box, lbl ?? null]);
}

const sliderCss = css`
  inline-size: 100%;
  accent-color: var(--imp-color-primary);
`;

export function slider(
  {
    label: lbl,
    hint,
    min = 0,
    max = 100,
    step = 1,
    value,
    events = {},
    class: extra,
    ...rest
  } = {},
) {
  const id = rest.id ?? uid("sl");
  const control = input({
    ...rest,
    id,
    type: "range",
    min,
    max,
    step,
    class: cx(sliderCss, extra),
    value: value ?? min,
    events: isSignal(value)
      ? { input: (e) => value.set(Number(e.target.value)), ...events }
      : events,
  });
  return wrap(id, lbl, control, hint);
}

const formCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--imp-space-16);
`;

// formBox({ events: { submit } }, ...fields) — a <form> with stack layout;
// submit is preventDefault-ed for you (SPA default).
export function formBox(...args) {
  const [{ events = {}, class: extra, ...rest }, children] = split(args);
  const { submit, ...restEvents } = events;
  return form({
    ...rest,
    class: cx(formCss, extra),
    events: {
      submit: (e) => {
        e.preventDefault();
        submit?.(e);
      },
      ...restEvents,
    },
  }, children);
}
