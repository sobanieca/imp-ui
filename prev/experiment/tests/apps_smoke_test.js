import { fire, tick } from "../imp/testing.js";
import { assert, assertEquals } from "jsr:@std/assert@^1";

document.body.innerHTML = '<div id="app"></div>';

Deno.test("todo example app boots and works", async () => {
  await import("../examples/todo/app.js");
  await tick();
  const app = document.querySelector("#app");
  assert(app.textContent.includes("Todos"), "title rendered");
  const input = app.querySelector('input[type="text"], input:not([type])');
  input.value = "write smoke test";
  fire(input, "input");
  fire(input, "keydown", { key: "Enter" });
  assert(app.textContent.includes("write smoke test"), "todo added");
  assert(app.textContent.includes("1 task left"), "plural counter");
  const checkbox = app.querySelector('li input[type="checkbox"]');
  checkbox.checked = true;
  fire(checkbox, "change");
  assert(app.textContent.includes("All done!"), "zero-form plural");
  assertEquals(
    JSON.parse(localStorage.getItem("imp-todos")).length,
    1,
    "persisted",
  );
});

Deno.test("showcase app boots with every stdlib component", async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await import("../showcase/app.js");
  await tick();
  const app = document.querySelector("#app");
  assert(app.textContent.includes("imp showcase"), "title");
  assert(app.querySelector('[role="progressbar"]'), "progressBar");
  assert(app.querySelector('[role="tablist"]'), "tabs");
  assert(app.querySelector("table"), "dataTable");
  assert(
    app.querySelectorAll('input[type="color"]').length >= 8,
    "theme editor rows",
  );
  // theme switch via editor segment
  const dark = [...app.querySelectorAll("button")].find((b) =>
    b.textContent === "dark"
  );
  fire(dark, "click");
  assertEquals(document.documentElement.getAttribute("data-imp-mode"), "dark");
});
