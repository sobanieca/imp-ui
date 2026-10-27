# Architecture Decision Records

Each ADR captures one architectural decision. It gives the context that forced the decision, the
choice that somebody made, and the consequences. Every ADR in this folder is the current, accepted
state of that decision. There is no status field. When a decision changes, replace the ADR with a
new one that describes the new decision. When somebody drops a decision, delete its ADR.

These are the conventions:

- **A file name is a short, descriptive slug of the decision**, such as
  `real-dom-no-virtual-dom.md`. There is no number.
- **The format of a record is Context, Decision, Consequences.**
- **Presence means accepted.** Nothing in the folder is a proposal, and nothing is history. The
  folder always reflects what the code does, or what it must do.

## Rendering phase

| ADR                                                             | Decision                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [browser-support-baseline](browser-support-baseline.md)         | Current stable browsers; no polyfills or workarounds                           |
| [real-dom-no-virtual-dom](real-dom-no-virtual-dom.md)           | Real DOM, no virtual DOM                                                       |
| [client-rendered-only](client-rendered-only.md)                 | Client rendering only; no server rendering, prerender or static export         |
| [type-based-argument-dispatch](type-based-argument-dispatch.md) | Type-based argument dispatch                                                   |
| [element-factory-syntax](element-factory-syntax.md)             | Element-factory syntax, no JSX or templates                                    |
| [property-first-prop-model](property-first-prop-model.md)       | Verbatim attribute names, property-first fallback                              |
| [special-prop-namespaces](special-prop-namespaces.md)           | Special prop namespaces: class, style, events                                  |
| [web-component-lifecycle](web-component-lifecycle.md)           | Custom elements; loading/setup/error/onMount/onRemove, resolution through self |
| [shadow-dom-isolation](shadow-dom-isolation.md)                 | Open shadow root per component; styles entry                                   |
| [focus-delegation](focus-delegation.md)                         | Hosts delegate focus to the control they render                                |
| [focus-survives-a-change](focus-survives-a-change.md)           | Focus stays on the acted-on element, or its replacement                        |
| [component-moves-rebind](component-moves-rebind.md)             | Moves keep components; subscriptions rebind                                    |
| [error-boundaries](error-boundaries.md)                         | Error boundaries via events; isolated cleanup                                  |
| [client-side-router](client-side-router.md)                     | Declarative route-table router on view + components                            |
| [route-guards](route-guards.md)                                 | Guards bound per node, nearest wins, synchronous over states, with wait        |
| [application-map](application-map.md)                           | One plain-data map drives the router, the shell and the trail                  |

## State

| ADR                                                   | Decision                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [event-propagated-state](event-propagated-state.md)   | Named state via initState(self)/useState(self) - subtree-scoped by DOM-event bubbling, computed |
| [state-plain-data-values](state-plain-data-values.md) | Plain-data state values: fused validate+structural-compare on set, deep-frozen when stored      |

## Styling

| ADR                                                         | Decision                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [themable-by-default-tokens](themable-by-default-tokens.md) | Themes are plain token modules applied with `applyTheme` - `--imp-*` vars on :root |
| [theme-editor](theme-editor.md)                             | One theme editor, in imp preview and in the dev widget, exports a plain theme file |
| [loader-shape-theme-token](loader-shape-theme-token.md)     | One shared loader, drawn in CSS; the `loader` token selects its shape              |
| [imp-design-system](imp-design-system.md)                   | One design system for the surfaces that imp owns: imp preview and the home page    |

## Internationalization

| ADR                                                             | Decision                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [translatable-by-default](translatable-by-default.md)           | `<html lang>` is the language and `<html dir>` follows it; declared per-language messages, `t()` lookup, app-supplied `imp.` keys |
| [logical-properties-rtl-scope](logical-properties-rtl-scope.md) | Logical properties and units everywhere; LTR and RTL guaranteed, vertical writing modes out of scope                              |

## Components

| ADR                                                                                       | Decision                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [standard-component-library](standard-component-library.md)                               | Standard components: `imp-` prefixed, lazily defined, token-driven, closed props    |
| [app-wide-component-defaults](app-wide-component-defaults.md)                             | `init({ defaults })`: one props object per standard component; the call wins        |
| [short-component-catalog](short-component-catalog.md)                                     | One component per job; a prop covers a variant; paging is an infinite scroll        |
| [accessible-by-default-stdlib](accessible-by-default-stdlib.md)                           | One accessibility contract per component; lint, an e2e matcher and a contrast check |
| [joined-control-seam](joined-control-seam.md)                                             | Joined controls square corners through inherited custom properties, not a box       |
| [control-box-per-size](control-box-per-size.md)                                           | Every single-line control has one height per size, from one shared box              |
| [image-upload-client-side-crop](image-upload-client-side-crop.md)                         | `imageUpload` crops and resizes in the browser; the value is a data URL             |
| [responsive-fluid-values-only](responsive-fluid-values-only.md)                           | Fluid theme values only; no per-screen props - an app writes its own media query    |
| [layout-two-flex-primitives](layout-two-flex-primitives.md)                               | Layout is `flex` and `stack` only - CSS flexbox, gap off the theme scale            |
| [app-shell-component](app-shell-component.md)                                             | `shell`: one nav tree drives three surfaces, a signed-in gate; the one breakpoint   |
| [shell-region-components](shell-region-components.md)                                     | `imp/std/shell`: the frame's usual contents as their own group, every picker a menu |
| [app-wide-notification-store](app-wide-notification-store.md)                             | One app-wide store of plain notifications; `notify` feeds the popups and the bell   |
| [overlay-top-layer](overlay-top-layer.md)                                                 | Overlays promoted in place; shared seam of plain functions, no portal               |
| [state-driven-forms](state-driven-forms.md)                                               | Form values are named state; controls bind one field by dot path                    |
| [bundled-icon-set](bundled-icon-set.md)                                                   | Lucide in the binary; one export per icon, drawn by `icon`                          |
| [map-bundled-world](map-bundled-world.md)                                                 | `map`: Natural Earth in the bundle, drawn as SVG, no tile server                    |
| [code-block-syntax-highlighting](code-block-syntax-highlighting.md)                       | `codeBlock`: imp's own scanner, theme-mixed colours, line links in the fragment     |
| [code-editor-textarea-mirror](code-editor-textarea-mirror.md)                             | `codeEditor`: a native textarea over a highlighted mirror, and three keys           |
| [rich-text-editor-contenteditable-markdown](rich-text-editor-contenteditable-markdown.md) | `richTextEditor`: a contenteditable box with a toolbar, whose value is markdown     |
| [markdown-renderer-one-reader](markdown-renderer-one-reader.md)                           | `markdown`: one parser and one prose stylesheet under the renderer and the editor   |

## Library

| ADR                                                       | Decision                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [built-in-logger](built-in-logger.md)                     | One console-backed logger, level from `IMP_LOG_LEVEL`                                      |
| [library-import-namespaces](library-import-namespaces.md) | Per-subject specifiers: imp, imp/html, imp/state, imp/router, imp/theme, imp/i18n, imp/log |
| [tree-shakeable-library](tree-shakeable-library.md)       | Nothing runs at module scope; unused library code is dropped from app bundles              |
| [http-client](http-client.md)                             | Component-scoped HTTP client: retries, interceptors, bindable request state                |
| [product-analytics](product-analytics.md)                 | imp counts pages, zones, outcomes and errors as records; the app forwards them via a sink  |
| [imp-aly-sink](imp-aly-sink.md)                           | `imp/analytics/aly` sends the records to imp-aly servers, one server per visit             |

## CLI

| ADR                                                                         | Decision                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [project-scaffold](project-scaffold.md)                                     | imp init: one non-interactive scaffold, tests included                               |
| [native-toolchain](native-toolchain.md)                                     | One Rust binary: oxc fmt and lint, rolldown, QuickJS; no subprocess                  |
| [project-wide-dead-code](project-wide-dead-code.md)                         | imp lint walks the module graph: unreachable modules, dead exports                   |
| [dependency-bundling-with-rolldown](dependency-bundling-with-rolldown.md)   | Bundle deps with rolldown and imp's own npm resolver                                 |
| [vendored-dependencies](vendored-dependencies.md)                           | Vendored, committed deps via imp install; no lockfile                                |
| [vendored-dependency-manifest](vendored-dependency-manifest.md)             | Each vendored bundle records its packages, versions, licenses; npm integrity checked |
| [dependency-audit](dependency-audit.md)                                     | imp audit: OSV check of the manifests, CycloneDX bill of materials                   |
| [license-policy-gate](license-policy-gate.md)                               | 'licenses' in imp.json; install and build refuse a violation                         |
| [production-bundling](production-bundling.md)                               | imp build from vendored bundles + baked-in library                                   |
| [public-folder-static-assets](public-folder-static-assets.md)               | public/ is the site root; IMP_BASEPATH prefixes built URLs                           |
| [pwa-toolkit](pwa-toolkit.md)                                               | imp build --pwa: manifest, icons, build-graph SW                                     |
| [raster-image-pipeline](raster-image-pipeline.md)                           | resvg for icons, image crate for resize, format-preserving encode                    |
| [transitive-duplication-accepted](transitive-duplication-accepted.md)       | No dedupe across vendored bundles - by design                                        |
| [two-level-testing](two-level-testing.md)                                   | imp test: unit tests in a blank page, specs against the app, both in Chrome          |
| [dev-server-mocks](dev-server-mocks.md)                                     | Mocks from *.mock.js files, run by imp start, reached through the worker             |
| [service-worker-dev-mode](service-worker-dev-mode.md)                       | Dev mode is startDevMode() in any worker; a project keeps its own                    |
| [fake-timers](fake-timers.md)                                               | fakeTimers option: virtual clock for unit tests                                      |
| [test-video-recording](test-video-recording.md)                             | E2E GIF recording via CDP screencast, native encode, no ffmpeg                       |
| [component-preview](component-preview.md)                                   | imp preview: *.preview.js scenarios, their code and manual, on one page              |
| [preview-export](preview-export.md)                                         | imp preview --output: the gallery as one element that any page embeds                |
| [in-page-review-capture](in-page-review-capture.md)                         | One capture engine: dev review files and the bugReport component                     |
| [browser-modules-as-function-source](browser-modules-as-function-source.md) | Injected browser code is a module; the CLI injects the source of its function        |
| [vendored-browser-driver](vendored-browser-driver.md)                       | Browser build of puppeteer-core, vendored and embedded, runs in the runner page      |
| [third-party-attribution](third-party-attribution.md)                       | THIRD-PARTY-LICENSES records every crate and package; xtask generates it             |
| [built-app-license-notices](built-app-license-notices.md)                   | imp build writes LICENSES.txt, imp's own notice included; scripts point at it        |
| [agent-skills](agent-skills.md)                                             | imp skill: skills/ + *.skill.md sidecars as agent manuals                            |
| [binary-distribution](binary-distribution.md)                               | GitHub Releases for Linux, macOS and Windows, compiled on push                       |
| [release-policy](release-policy.md)                                         | No guarantee before 1.0; semantic versioning and a deprecation window from 1.0       |
| [version-pinning-self-delegation](version-pinning-self-delegation.md)       | `"version"` pin in imp.json, self-delegating binary                                  |
| [config-discovery](config-discovery.md)                                     | JSONC config, imp.json/imp.jsonc, upward search, safe edits                          |
| [environments](environments.md)                                             | Named env files, `$env.` shell refs, one injected `env` global                       |
| [build-flags](build-flags.md)                                               | `flags` declared in imp.json, `flag()` folded out by the build                       |
| [development-checks](development-checks.md)                                 | Checks behind `globalThis.__IMP_DEV__`, folded out by the build                      |
