# Architecture Decision Records

Each ADR captures one architectural decision: the context that forced it, the choice made, and the
consequences. Every ADR in this folder is the current, accepted state of that decision — there is no
status field. When a decision changes, replace the ADR with a new one describing the new decision;
when a decision is dropped, delete its ADR.

Conventions:

- **File name** is a short descriptive slug of the decision (`real-dom-no-virtual-dom.md`) — no
  numbering.
- **Format per record:** Context · Decision · Consequences.
- **Presence means accepted.** Nothing in the folder is a proposal or history; the folder always
  reflects what the code does (or must do).

## Rendering phase

| ADR                                                             | Decision                                          |
| --------------------------------------------------------------- | ------------------------------------------------- |
| [real-dom-no-virtual-dom](real-dom-no-virtual-dom.md)           | Real DOM, no virtual DOM                          |
| [type-based-argument-dispatch](type-based-argument-dispatch.md) | Type-based argument dispatch                      |
| [element-factory-syntax](element-factory-syntax.md)             | Element-factory syntax, no JSX or templates       |
| [property-first-prop-model](property-first-prop-model.md)       | Verbatim attribute names, property-first fallback |
| [special-prop-namespaces](special-prop-namespaces.md)           | Special prop namespaces: class, style, events     |
| [web-component-lifecycle](web-component-lifecycle.md)           | Components are custom elements; onMount lifecycle |
| [shadow-dom-isolation](shadow-dom-isolation.md)                 | Open shadow root per component; styles entry      |
| [component-moves-rebind](component-moves-rebind.md)             | Moves keep components; subscriptions rebind       |
| [error-boundaries](error-boundaries.md)                         | onError boundaries via events; isolated teardown  |

## State

| ADR                                                   | Decision                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [event-propagated-state](event-propagated-state.md)   | Named state via initState/useState — subtree-scoped by DOM-event bubbling, auto-cleanup, computed |
| [state-plain-data-values](state-plain-data-values.md) | Plain-data state values: fused validate+structural-compare on set, deep-frozen when stored        |

## Library

| ADR                                   | Decision                                              |
| ------------------------------------- | ----------------------------------------------------- |
| [built-in-logger](built-in-logger.md) | One console-backed logger, level from `IMP_LOG_LEVEL` |

## CLI

| ADR                                                                   | Decision                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| [in-process-toolchain](in-process-toolchain.md)                       | fmt and lint run in-process, no subprocess                     |
| [in-process-dependency-bundling](in-process-dependency-bundling.md)   | Bundle deps in-process via esbuild-wasm + Deno plugin          |
| [vendored-dependencies](vendored-dependencies.md)                     | Vendored, committed deps via imp install; no lockfile          |
| [production-bundling](production-bundling.md)                         | imp build from vendored bundles + baked-in library             |
| [pwa-toolkit](pwa-toolkit.md)                                         | imp build --pwa: manifest, icons, build-graph SW               |
| [raster-image-pipeline](raster-image-pipeline.md)                     | resvg decode+resize, format-preserving encode, no new codec    |
| [transitive-duplication-accepted](transitive-duplication-accepted.md) | No dedupe across vendored bundles — by design                  |
| [two-level-testing](two-level-testing.md)                             | imp test: in-process unit runner, per-spec e2e Chrome          |
| [fake-timers](fake-timers.md)                                         | fakeTimers option: virtual clock for unit tests                |
| [test-video-recording](test-video-recording.md)                       | E2E GIF recording via CDP screencast, in-process, no ffmpeg    |
| [prebundled-npm-dependencies](prebundled-npm-dependencies.md)         | Runtime npm deps pre-bundled at build time                     |
| [third-party-attribution](third-party-attribution.md)                 | Bundled deps ship license notices; THIRD_PARTY_LICENSES        |
| [binary-distribution](binary-distribution.md)                         | GitHub Releases, compiled per platform on push                 |
| [version-pinning-self-delegation](version-pinning-self-delegation.md) | `"version"` pin in imp.json, self-delegating binary            |
| [config-discovery](config-discovery.md)                               | JSONC config, imp.json/imp.jsonc, upward search, safe edits    |
| [environments](environments.md)                                       | Named env files, `$env.` shell refs, one injected `env` global |
