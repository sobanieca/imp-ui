# CLAUDE.md

## `prev/` folder

The `prev/` folder stores previous brainstorming ideas and experiments. **Always ignore it** during
normal work — do not read, search, edit, or reference its contents unless I explicitly ask you to
review specific code there.

## Code style

**Do not add comments to code.** Write self-explanatory code instead — use clear, descriptive names
for functions, variables, and constants so the intent is obvious without comments. Reserve prose
explanations for the docs (`docs/`) and ADRs (`adr/`), not inline in source files.

**Use modern JavaScript syntax (ES2017 / ES7 and newer).** This project targets modern browsers and
Deno only — there is no transpilation or legacy support, so write current idiomatic JS. Prefer
`const`/`let` over `var`; arrow functions and rest/spread params over `function`/`arguments`;
template literals over string concatenation; destructuring, `for...of`, optional chaining (`?.`),
nullish coalescing (`??`), `async`/`await`, and other current language features. This applies to
browser-targeted code too, including scripts emitted as strings (e.g. injected client and service
worker code).
