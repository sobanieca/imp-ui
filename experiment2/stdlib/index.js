// imp-ui standard library — built entirely on the public kernel API.
// Every component reads --imp-* theme tokens and pipes its own user-facing
// strings through t(). Logical CSS properties only, so RTL mirrors for free.

import { defineMessages } from "../imp/imp.js";

// Built-in strings (apps override per locale with the same keys).
defineMessages("en", {
  "imp.close": "Close",
  "imp.loading": "Loading…",
  "imp.empty": "No data",
  "imp.prev": "Previous",
  "imp.next": "Next",
  "imp.page": "Page {page} of {pages}",
});

export * from "./layout.js";
export * from "./display.js";
export * from "./inputs.js";
export * from "./feedback.js";
export * from "./navigation.js";
export * from "./data.js";
