// imp showcase — gallery of every stdlib component with a live theme editor,
// mode/direction toggles, and a locale switcher. Built with imp itself: the
// editor writes tokens through defineTheme/setTheme, and the whole page
// re-skins with no re-render (essence #17, #20).

import {
  button,
  code,
  css,
  d,
  defineMessages,
  defineTheme,
  div,
  h1,
  h2,
  input,
  locale,
  mount,
  n,
  p,
  setDirection,
  setLocale,
  setMode,
  setTheme,
  signal,
  span,
  t,
  theme,
} from "../imp/imp.js";
import {
  alert,
  avatar,
  badge,
  breadcrumbs,
  card,
  checkbox,
  container,
  dataTable,
  datePicker,
  drawer,
  formBox,
  grid,
  listView,
  menuList,
  modal,
  pagination,
  progressBar,
  radioGroup,
  row,
  selectBox,
  slider,
  spacer,
  spinner,
  stack,
  switchToggle,
  tabs,
  tag,
  textArea,
  textField,
  toast,
  tooltip,
  tree,
} from "../stdlib/index.js";

defineMessages("en", {
  "sc.title": "imp showcase",
  "sc.intro":
    "Every stdlib component, live. Edit the theme on the right — everything re-skins instantly, no re-render.",
  "sc.theme": "Theme editor",
  "sc.export": "Copy as defineTheme(…)",
  "sc.exported": "Theme copied to clipboard",
  "sc.sample": "Formatting sample: {sample}",
});
defineMessages("pl", {
  "sc.title": "imp — galeria",
  "sc.intro":
    "Wszystkie komponenty stdlib na żywo. Edytuj motyw po prawej — całość zmienia skórkę natychmiast, bez ponownego renderowania.",
  "sc.theme": "Edytor motywu",
  "sc.export": "Skopiuj jako defineTheme(…)",
  "sc.exported": "Motyw skopiowany do schowka",
  "sc.sample": "Przykład formatowania: {sample}",
  "imp.close": "Zamknij",
  "imp.loading": "Wczytywanie…",
  "imp.empty": "Brak danych",
  "imp.prev": "Poprzednia",
  "imp.next": "Następna",
  "imp.page": "Strona {page} z {pages}",
});

// --- theme editor state ------------------------------------------------------

// Edits accumulate as overrides on top of the active base mode; every change
// re-registers a 'custom' theme and activates it.
const overrides = signal({});
const baseMode = () => theme().mode;

function editToken(key, value) {
  overrides.update((o) => ({ ...o, [key]: value }));
  defineTheme("custom", { mode: baseMode(), tokens: overrides.peek() });
  setTheme("custom");
}

function pickMode(mode) {
  overrides.set({});
  setMode(mode);
}

const EDITABLE_COLORS = [
  "color-bg",
  "color-surface",
  "color-text",
  "color-primary",
  "color-accent",
  "color-danger",
  "color-success",
  "color-border",
];

// --- layout ------------------------------------------------------------------

const pageCss = css`
  min-block-size: 100vh;
  background: var(--imp-color-bg);
  color: var(--imp-color-text);
  font-family: var(--imp-font-family);
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--imp-space-24);
  padding: var(--imp-space-24);
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;
const panelCss = css`
  position: sticky;
  inset-block-start: var(--imp-space-24);
  align-self: start;
  max-block-size: calc(100vh - 48px);
  overflow: auto;
`;
const tokenRowCss = css`
  display: flex;
  align-items: center;
  gap: var(--imp-space-8);
  font-size: var(--imp-font-size-xs);
  & input[type="color"] {
    inline-size: 28px;
    block-size: 22px;
    padding: 0;
    border: 1px solid var(--imp-color-border);
    border-radius: var(--imp-radius-sm);
    background: none;
  }
  & code {
    color: var(--imp-color-text-muted);
  }
`;
const segCss = css`
  display: flex;
  border: 1px solid var(--imp-color-border);
  border-radius: var(--imp-radius-sm);
  overflow: hidden;
  & > button {
    border: none;
    background: var(--imp-color-surface);
    color: var(--imp-color-text-muted);
    font: inherit;
    font-size: var(--imp-font-size-xs);
    padding: var(--imp-space-4) var(--imp-space-12);
    cursor: pointer;
  }
  & > button.on {
    background: var(--imp-color-primary);
    color: var(--imp-color-on-primary);
  }
`;
const btnCss = css`
  border: 1px solid var(--imp-color-border);
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
  font: inherit;
  font-size: var(--imp-font-size-sm);
  padding: var(--imp-space-8) var(--imp-space-12);
  border-radius: var(--imp-radius-sm);
  cursor: pointer;
  &:hover {
    background: var(--imp-color-surface-alt);
  }
`;

const segment = (options, isOn, pick) =>
  div(
    { class: segCss },
    options.map((o) =>
      button(
        { class: { on: () => isOn(o) }, events: { click: () => pick(o) } },
        o,
      )
    ),
  );

function themePanel() {
  const radius = signal(8);
  return div(
    { class: panelCss },
    card(
      { title: () => t("sc.theme") },
      stack({ gap: "sm" }, [
        row([
          span("mode"),
          spacer(),
          segment(
            ["light", "dark", "system"],
            (m) =>
              theme().name === m ||
              (m !== "system" && theme().mode === m &&
                theme().name === "custom"),
            pickMode,
          ),
        ]),
        row([
          span("dir"),
          spacer(),
          segment(
            ["ltr", "rtl", "auto"],
            () => false,
            (dir) => setDirection(dir),
          ),
        ]),
        row([
          span("locale"),
          spacer(),
          segment(["en", "pl", "ar"], (l) => locale() === l, setLocale),
        ]),
        div({ style: { borderBlockEnd: "1px solid var(--imp-color-border)" } }),
        ...EDITABLE_COLORS.map((key) =>
          div({ class: tokenRowCss }, [
            input({
              type: "color",
              value: () => theme().tokens[key],
              events: {
                input: (e) => editToken(key, e.target.value),
              },
            }),
            code("--imp-" + key),
          ])
        ),
        button({
          class: btnCss,
          events: {
            click: async () => {
              const snippet =
                `defineTheme('custom', {\n  mode: '${baseMode()}',\n  tokens: ${
                  JSON.stringify(overrides.peek(), null, 2)
                },\n})`;
              try {
                await navigator.clipboard.writeText(snippet);
              } catch {
                console.log(snippet);
              }
              toast(t("sc.exported"), { kind: "success" });
            },
          },
        }, () => t("sc.export")),
        slider({
          label: "radius-md",
          min: 0,
          max: 24,
          value: radius,
          events: {
            input: (e) => editToken("radius-md", e.target.value + "px"),
          },
        }),
      ]),
    ),
  );
}

// --- gallery sections ---------------------------------------------------------

const demo = (title, node) => card({ title }, node);

function gallery() {
  const open = signal(false);
  const drawerOpen = signal(false);
  const progress = signal(40);
  const page = signal(1);
  const switches = signal(true);
  const pick = signal("b");
  const tableRows = signal([
    { id: 1, name: "apples", qty: 12, price: 2.5 },
    { id: 2, name: "bananas", qty: 5, price: 1.2 },
    { id: 3, name: "cherries", qty: 130, price: 8.9 },
    { id: 4, name: "dates", qty: 40, price: 6.1 },
    { id: 5, name: "elderberries", qty: 8, price: 12.0 },
  ]);

  return stack([
    h1(() => t("sc.title")),
    p(() => t("sc.intro")),
    p(
      { style: { color: "var(--imp-color-text-muted)" } },
      () => t("sc.sample", { sample: `${n(1234567.89)} · ${d(new Date())}` }),
    ),

    h2("layout"),
    grid({ cols: 2 }, [
      demo(
        "stack + row",
        stack({ gap: "sm" }, [
          row([
            badge("one"),
            badge({ kind: "accent" }, "two"),
            spacer(),
            tag("end"),
          ]),
          row([
            badge({ kind: "success" }, "three"),
            badge({ kind: "danger" }, "four"),
          ]),
        ]),
      ),
      demo(
        "grid",
        grid(
          { cols: 3, gap: "sm" },
          [1, 2, 3, 4, 5, 6].map((i) =>
            div({
              style: {
                background: "var(--imp-color-surface-alt)",
                borderRadius: "var(--imp-radius-sm)",
                padding: "var(--imp-space-8)",
                textAlign: "center",
              },
            }, String(i))
          ),
        ),
      ),
    ]),

    h2("display"),
    grid({ cols: 2 }, [
      demo(
        "badge / tag / avatar",
        row({ wrap: true }, [
          badge("primary"),
          badge({ kind: "secondary" }, "secondary"),
          badge({ kind: "warning" }, "warning"),
          tag("v2.0"),
          avatar({ name: "Grace Hopper" }),
          avatar({ name: "Alan Turing", size: 28 }),
        ]),
      ),
      demo(
        "tooltip",
        row([
          tooltip(
            { text: "I am a tooltip" },
            button({ class: btnCss }, "hover me"),
          ),
        ]),
      ),
    ]),

    h2("inputs"),
    grid({ cols: 2 }, [
      demo(
        "text fields",
        formBox([
          textField({ label: "Name", placeholder: "Jane Doe" }),
          textField({ label: "Email", type: "email", hint: "We never spam." }),
          datePicker({ label: "Date" }),
          textArea({ label: "Notes", rows: 2 }),
        ]),
      ),
      demo(
        "choices",
        stack({ gap: "sm" }, [
          selectBox({ label: "Fruit", options: ["apple", "banana", "cherry"] }),
          radioGroup({ label: "Size", options: ["s", "m", "l"], value: pick }),
          checkbox({ label: "Accept terms", checked: switches }),
          switchToggle({ label: "Notifications", checked: switches }),
          slider({ label: "Volume", value: progress }),
        ]),
      ),
    ]),

    h2("feedback"),
    grid({ cols: 2 }, [
      demo(
        "alerts",
        stack({ gap: "sm" }, [
          alert("Heads-up: this is informational."),
          alert({ kind: "success" }, "Saved successfully."),
          alert({ kind: "warning" }, "Disk almost full."),
          alert({ kind: "danger" }, "Build failed."),
        ]),
      ),
      demo(
        "progress / spinner / toast / modal",
        stack({ gap: "sm" }, [
          row([progressBar({ value: progress }), span(() => progress() + "%")]),
          row([
            spinner({ size: 20 }),
            button(
              {
                class: btnCss,
                events: { click: () => toast("Hello from a toast") },
              },
              "toast",
            ),
            button(
              {
                class: btnCss,
                events: { click: () => toast("Boom", { kind: "danger" }) },
              },
              "error toast",
            ),
            button(
              { class: btnCss, events: { click: () => open.set(true) } },
              "modal",
            ),
            button({
              class: btnCss,
              events: { click: () => drawerOpen.set(true) },
            }, "drawer"),
          ]),
          modal(
            { open, title: "A modal" },
            p("Escape, ×, or the backdrop closes me. I close my own `open` signal."),
          ),
          drawer(
            { open: drawerOpen, title: "A drawer" },
            p("Side panel content."),
          ),
        ]),
      ),
    ]),

    h2("navigation"),
    grid({ cols: 2 }, [
      demo(
        "tabs",
        tabs({
          tabs: [
            {
              id: "a",
              label: "First",
              content: () => p("First tab content (built lazily)."),
            },
            {
              id: "b",
              label: "Second",
              content: () => p("Second tab content."),
            },
          ],
        }),
      ),
      demo(
        "breadcrumbs + pagination",
        stack([
          breadcrumbs({
            items: [{ label: "Home", href: "/" }, {
              label: "Products",
              href: "/p",
            }, {
              label: "Showcase",
            }],
          }),
          pagination({ page, pages: 5 }),
        ]),
      ),
      demo(
        "menuList",
        menuList({
          items: [
            { id: "inbox", label: "Inbox" },
            { id: "sent", label: "Sent" },
            { id: "trash", label: "Trash" },
          ],
          active: signal("inbox"),
        }),
      ),
    ]),

    h2("data"),
    demo(
      "dataTable (sortable, paginated)",
      dataTable({
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "qty", label: "Qty", sortable: true },
          {
            key: "price",
            label: "Price",
            render: (r) => n(r.price, { style: "currency", currency: "USD" }),
          },
        ],
        rows: tableRows,
        pageSize: 3,
      }),
    ),
    grid({ cols: 2 }, [
      demo(
        "listView",
        listView({
          items: ["real DOM", "signals", "no build step"],
          render: (x) => row([badge({ kind: "accent" }, "✓"), span(x)]),
        }),
      ),
      demo(
        "tree",
        tree({
          nodes: [{
            id: 1,
            label: "src",
            children: [
              {
                id: 2,
                label: "imp",
                children: [{ id: 3, label: "render.js" }, {
                  id: 4,
                  label: "signals.js",
                }],
              },
              { id: 5, label: "stdlib" },
            ],
          }],
        }),
      ),
    ]),
  ]);
}

mount("#app", () =>
  div({ class: pageCss }, [
    container(gallery()),
    themePanel(),
  ]));
