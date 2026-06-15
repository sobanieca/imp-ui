// Canonical todo example. Exercises: signals, when/each (keyed, per-item
// signals for row granularity), events, css``, theme switching, two locales
// with plurals, localStorage persistence via subscribe().

import {
  batch,
  button,
  computed,
  css,
  defineMessages,
  div,
  each,
  h1,
  li,
  locale,
  mount,
  setMode,
  signal,
  span,
  subscribe,
  t,
  theme,
  ul,
  when,
} from "../../imp/imp.js";
import {
  badge,
  card,
  checkbox,
  row,
  selectBox,
  spacer,
  stack,
  textField,
} from "../../stdlib/index.js";

defineMessages("en", {
  title: "Todos",
  placeholder: "What needs doing?",
  add: "Add",
  empty: "Nothing here yet.",
  remaining: {
    zero: "All done!",
    one: "{count} task left",
    other: "{count} tasks left",
  },
  "filter.all": "All",
  "filter.active": "Active",
  "filter.done": "Done",
  "mode.toggle": "Toggle dark mode",
});
defineMessages("pl", {
  title: "Zadania",
  placeholder: "Co trzeba zrobić?",
  add: "Dodaj",
  empty: "Na razie pusto.",
  remaining: {
    zero: "Wszystko zrobione!",
    one: "Zostało {count} zadanie",
    few: "Zostały {count} zadania",
    many: "Zostało {count} zadań",
    other: "Zostało {count} zadania",
  },
  "filter.all": "Wszystkie",
  "filter.active": "Aktywne",
  "filter.done": "Zrobione",
  "mode.toggle": "Przełącz tryb ciemny",
});

// --- state -----------------------------------------------------------------

// Per-item signals (`done`) give row-level granularity: toggling one checkbox
// touches one row's class, not the list.
const makeTodo = ({ id, text, done = false }) => ({
  id,
  text,
  done: signal(done),
});

const stored = JSON.parse(localStorage.getItem("imp-todos") ?? "[]");
const todos = signal(stored.map(makeTodo));
const draft = signal("");
const filter = signal("all");

const remaining = computed(() => todos().filter((todo) => !todo.done()).length);
const visible = computed(() => {
  const f = filter();
  return todos().filter((todo) =>
    f === "all" || (f === "done") === todo.done()
  );
});

const persist = () =>
  localStorage.setItem(
    "imp-todos",
    JSON.stringify(
      todos().map(({ id, text, done }) => ({ id, text, done: done() })),
    ),
  );
subscribe(todos, persist);
subscribe(remaining, persist); // re-save when any row's done flips

const add = () => {
  const text = draft().trim();
  if (!text) return;
  batch(() => {
    todos.update((list) => [...list, makeTodo({ id: Date.now(), text })]);
    draft.set("");
  });
};
const remove = (id) =>
  todos.update((list) => list.filter((todo) => todo.id !== id));

// --- view ------------------------------------------------------------------

const pageCss = css`
  min-block-size: 100vh;
  background: var(--imp-color-bg);
  color: var(--imp-color-text);
  font-family: var(--imp-font-family);
  padding: var(--imp-space-32) var(--imp-space-16);
`;
const shellCss = css`
  max-inline-size: 520px;
  margin-inline: auto;
`;
const listCss = css`
  list-style: none;
  margin: 0;
  padding: 0;
  & > li {
    display: flex;
    align-items: center;
    gap: var(--imp-space-8);
    padding-block: var(--imp-space-8);
    border-block-end: 1px solid var(--imp-color-border);
  }
  & > li:last-child {
    border-block-end: none;
  }
  & > li.done label {
    text-decoration: line-through;
    color: var(--imp-color-text-muted);
  }
`;
const ghostBtnCss = css`
  border: none;
  background: none;
  color: var(--imp-color-text-muted);
  font-size: var(--imp-font-size-md);
  cursor: pointer;
  border-radius: var(--imp-radius-sm);
  padding: 0 var(--imp-space-8);
  &:hover {
    color: var(--imp-color-danger);
    background: var(--imp-color-surface-alt);
  }
`;
const primaryBtnCss = css`
  border: none;
  background: var(--imp-color-primary);
  color: var(--imp-color-on-primary);
  font: inherit;
  font-size: var(--imp-font-size-sm);
  font-weight: var(--imp-font-weight-medium);
  padding: var(--imp-space-8) var(--imp-space-16);
  border-radius: var(--imp-radius-sm);
  cursor: pointer;
  &:hover {
    filter: brightness(1.1);
  }
`;
const filterBtnCss = css`
  border: 1px solid var(--imp-color-border);
  background: var(--imp-color-surface);
  color: var(--imp-color-text-muted);
  font: inherit;
  font-size: var(--imp-font-size-xs);
  padding: var(--imp-space-4) var(--imp-space-12);
  border-radius: var(--imp-radius-full);
  cursor: pointer;
  &.active {
    background: var(--imp-color-primary);
    border-color: var(--imp-color-primary);
    color: var(--imp-color-on-primary);
  }
`;

function todoRow(todo) {
  return li({ class: { done: todo.done } }, [
    checkbox({ label: todo.text, checked: todo.done }),
    spacer(),
    button({
      class: ghostBtnCss,
      "aria-label": () => t("imp.close"),
      events: { click: () => remove(todo.id) },
    }, "×"),
  ]);
}

function filterBar() {
  return row(
    { gap: "sm" },
    ["all", "active", "done"].map((f) =>
      button({
        class: [filterBtnCss],
        "data-filter": f,
        events: { click: () => filter.set(f) },
      }, () => (filter() === f ? "● " : "") + t("filter." + f))
    ),
  );
}

function app() {
  return div(
    { class: pageCss },
    div(
      { class: shellCss },
      stack([
        row([
          h1(() => t("title")),
          spacer(),
          selectBox({
            options: [{ value: "en", label: "EN" }, {
              value: "pl",
              label: "PL",
            }],
            value: locale,
          }),
          button({
            class: ghostBtnCss,
            title: () => t("mode.toggle"),
            events: {
              click: () => setMode(theme().mode === "dark" ? "light" : "dark"),
            },
          }, () => theme().mode === "dark" ? "☀" : "☾"),
        ]),
        card(stack([
          row({ align: "flex-end" }, [
            div(
              { style: { flex: "1" } },
              textField({
                value: draft,
                placeholder: () => t("placeholder"),
                events: {
                  keydown: (e) => {
                    if (e.key === "Enter") add();
                  },
                },
              }),
            ),
            button(
              { class: primaryBtnCss, events: { click: add } },
              () => t("add"),
            ),
          ]),
          filterBar(),
          when(
            () => visible().length === 0,
            (empty) =>
              empty
                ? span(
                  { style: { color: "var(--imp-color-text-muted)" } },
                  () => t("empty"),
                )
                : ul({ class: listCss }, each(visible, todoRow)),
          ),
          row([
            span({
              style: {
                fontSize: "var(--imp-font-size-sm)",
                color: "var(--imp-color-text-muted)",
              },
            }, () => t("remaining", { count: remaining() })),
            spacer(),
            badge({ kind: "secondary" }, () => String(todos().length)),
          ]),
        ])),
      ]),
    ),
  );
}

mount("#app", app);
