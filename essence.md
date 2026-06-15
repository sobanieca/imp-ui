# imp-ui — Essence

The essential assumptions behind the framework. Everything else is derived from
these.

1. **Buildless.** Plain ES modules running directly in the browser — no compile
   step, no transpilation, ever.

2. **Vanilla JavaScript, not TypeScript.** Saves tokens for AI agents; one less
   toolchain layer.

3. **AI agents are the primary author.** The framework assumes no hand-written
   boilerplate; everything must be simple and regular enough for an agent to
   generate whole components in one pass, with terse, machine-ingestible docs.

4. **Simplicity over capability.** Usable without studying long documentation.
   Boring on purpose — no novel rendering algorithm, no new paradigm, no perf
   claims.

5. **All-in-one toolkit.** Rendering, signals, routing, CLI/runtime, theming,
   i18n, testing, and a standard component library in one place — no
   stack-assembly exercise before product work starts.

6. **80% is the target, not 100%.** Full answer for dashboards, CRUD apps,
   internal tools, product UIs. Heavy data viz, native mobile, collaborative
   editing are explicitly out of scope — and missing pieces should be simple
   enough for an agent to write from scratch instead of adding a dependency.

7. **Element-factory syntax.** DOM expressed as JS function calls —
   `el(tag, ...)` plus per-tag shortcuts (`div`, `p`, `button`). No JSX, no
   string templates.

8. **Real DOM, no virtual DOM.** `render` produces actual DOM nodes you can hold
   and mutate; no diffing of markup, no reconciliation.

9. **Type-based argument dispatch.** Factory args identified by type, not
   position: array → children, string → text, object → props, function →
   reactive. Prop keys are the HTML attribute names verbatim (`class`, `for`,
   `data-*`) — no aliases.

10. **Solid-style fine-grained signals.** Components run once to build DOM;
    signals surgically update specific nodes/attributes thereafter. A
    function-valued prop or child is reactive; plain values are static.

11. **Reactivity is opt-in.** Signals are a tool, not a religion — direct
    imperative DOM manipulation is a supported path; nothing forces a signal to
    exist.

12. **Structural changes via marker primitives.** `when`, `each` (keyed),
    `match` anchor a slot with a comment node and swap siblings around it. ~90%
    of apps need only `when`, `each`, `onMount`.

13. **Automatic cleanup on framework-driven unmount.** Effects, event listeners,
    and fetches are disposed together (AbortController-unified) when a subtree
    is swapped out — no manual `removeEventListener`.

14. **Components are just lowercase functions.** No framework component concept,
    no special syntax, no JSX-style capitalization — one naming rule,
    lint-enforced.

15. **Events under one `events: {...}` prop.** Native DOM event names (`click`,
    not `onClick`), uniform for spec and custom events, auto-detached on
    unmount.

16. **Buildless co-located CSS.** `` css`...` `` tagged template →
    content-hashed class injected once via `adoptedStyleSheets`, leaning on
    native CSS nesting. Shared statics in `css`, per-instance dynamics inline —
    one file, one mental model.

17. **Themable by default.** Design tokens as `--imp-*` CSS variables driven by
    a reactive `theme` signal (colors, radius, shadow, spacing, typography,
    light/dark mode, ltr/rtl direction). Swapping the theme re-skins the whole
    app instantly with no re-render; every stdlib component consumes tokens.

18. **Translatable by default.** A `locale` signal plus reactive `t()` (with
    Intl-based plurals, number/date formatting); changing locale re-localizes
    only the affected text nodes live.

19. **SPA-first, but coexists with server HTML.** Client rendering with
    static/CDN deploys and JSON backends is the default. A server can emit plain
    HTML with imp mount points (`mount()`) or imp components exposed as web
    components (`wc()` / `wc.define`) — islands, but no SSR of imp components
    and no hydration.

20. **Deno-powered `imp` CLI as the runtime.** One compiled binary: `dev`
    (static server, live reload, browser→CLI telemetry so agents can read
    console/network from the terminal), `lint`, `fmt`, `test` (DOM-polyfilled
    `deno test`), `build`, and `showcase` (component gallery with live
    theme/locale editor) — thin wrappers over Deno's native tooling.
