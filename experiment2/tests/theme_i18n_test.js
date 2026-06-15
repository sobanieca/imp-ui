import { mount, withLocale, withTheme } from "../imp/testing.js";
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  d,
  defineMessages,
  defineTheme,
  div,
  locale,
  n,
  setDirection,
  setLocale,
  setTheme,
  signal,
  span,
  t,
  theme,
} from "../imp/imp.js";

defineMessages("en", {
  greeting: "Hello, {name}!",
  items: { zero: "no items", one: "{count} item", other: "{count} items" },
  "only.en": "english only",
});
defineMessages("pl", {
  greeting: "Cześć, {name}!",
  items: {
    one: "{count} element",
    few: "{count} elementy",
    many: "{count} elementów",
    other: "{count} elementu",
  },
});

Deno.test("theme: setTheme writes --imp-* tokens and mode to :root", () => {
  setTheme("dark");
  const root = document.documentElement;
  assertEquals(root.getAttribute("data-imp-mode"), "dark");
  assert(root.style.getPropertyValue("--imp-color-bg").length > 0);
  const darkBg = root.style.getPropertyValue("--imp-color-bg");
  setTheme("light");
  assertEquals(root.getAttribute("data-imp-mode"), "light");
  assert(root.style.getPropertyValue("--imp-color-bg") !== darkBg);
});

Deno.test("theme: defineTheme starts from its mode defaults, overrides tokens", async () => {
  defineTheme("brand", {
    mode: "dark",
    tokens: { "color-primary": "#ff0066" },
  });
  await withTheme("brand", () => {
    const root = document.documentElement;
    assertEquals(root.style.getPropertyValue("--imp-color-primary"), "#ff0066");
    assertEquals(root.getAttribute("data-imp-mode"), "dark");
    assertEquals(theme().name, "brand");
  });
  assertEquals(theme().name, "light"); // restored
});

Deno.test("theme: direction — explicit and auto from locale", async () => {
  const root = document.documentElement;
  setDirection("rtl");
  setTheme("light"); // re-apply
  assertEquals(root.getAttribute("dir"), "rtl");
  setDirection("auto");
  await withLocale("ar", () => {
    assertEquals(root.getAttribute("dir"), "rtl");
  });
  await withLocale("en", () => {
    assertEquals(root.getAttribute("dir"), "ltr");
  });
  setDirection(null);
});

Deno.test("i18n: interpolation and fallback chain", async () => {
  await withLocale("pl", () => {
    assertEquals(t("greeting", { name: "Ala" }), "Cześć, Ala!");
    assertEquals(t("only.en"), "english only"); // fallback locale
    assertEquals(t("missing.key"), "missing.key"); // key as-is
  });
});

Deno.test("i18n: Intl-based plurals", async () => {
  await withLocale("en", () => {
    assertEquals(t("items", { count: 0 }), "no items");
    assertEquals(t("items", { count: 1 }), "1 item");
    assertEquals(t("items", { count: 5 }), "5 items");
  });
  await withLocale("pl", () => {
    assertEquals(t("items", { count: 1 }), "1 element");
    assertEquals(t("items", { count: 3 }), "3 elementy");
    assertEquals(t("items", { count: 7 }), "7 elementów");
  });
});

Deno.test("i18n: changing locale re-localizes live text nodes", () => {
  setLocale("en");
  const view = mount(() => div(() => t("greeting", { name: "X" })));
  assertEquals(view.el.textContent, "Hello, X!");
  setLocale("pl");
  assertEquals(view.el.textContent, "Cześć, X!");
  setLocale("en");
  view.unmount();
});

Deno.test("i18n: number and date formatting follow the locale", async () => {
  await withLocale("en-US", () => {
    assertEquals(n(1234.5), "1,234.5");
    assert(d(new Date("2026-06-12T12:00:00Z")).includes("2026"));
  });
  await withLocale("de-DE", () => {
    assertEquals(n(1234.5), "1.234,5");
  });
});

Deno.test("theme + i18n: reactive class re-skins without re-render", () => {
  setTheme("light");
  const node = span({ class: { dark: () => theme().mode === "dark" } }, "x");
  assert(!node.classList.contains("dark"));
  setTheme("dark");
  assert(node.classList.contains("dark"));
  setTheme("light");
});

Deno.test("signals as context: components close over shared signals", () => {
  const user = signal({ name: "Ann" });
  const child = () => span(() => user().name);
  const parent = () => div([child()]);
  const view = mount(parent);
  assertEquals(view.el.textContent, "Ann");
  user.set({ name: "Bob" });
  assertEquals(view.el.textContent, "Bob");
  view.unmount();
});
