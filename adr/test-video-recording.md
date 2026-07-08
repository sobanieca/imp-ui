# E2E video recording — CDP screencast frames, in-process GIF encode, no ffmpeg

## Context

An AI agent building a frontend feature drives `imp test` turn by turn (`two-level-testing.md`) and
needs a visual artifact a human reviewer can watch to double-check that a feature works and looks
right, dropped straight into a GitHub PR. The only visual capture imp had was a still PNG screenshot
on failure (`page.screenshot()` into `.imp/screenshots/`, wired through `--screenshots <dir>`) —
nothing moving.

The obvious moving-image path, puppeteer's `page.screencast()`, shells out to a system `ffmpeg` to
encode WebM. That breaks `in-process-toolchain.md` twice: it spawns an external tool that is not one
of the two sanctioned `imp test` exceptions, and it depends on an ambient binary imp does not ship,
so it would not work offline inside the self-contained binary.

A pure-in-process WebM encode was investigated and rejected on feasibility. imp's runtime is Deno,
which has **no WebCodecs** (`VideoEncoder`/`VideoFrame` are absent) and **no readable 2D canvas**,
so it cannot encode video or even read decoded pixels in-process. Mediabunny — the muxer originally
considered — needs WebCodecs for the encode step; its server variant delegates to `node-av`, a
native libav/FFmpeg N-API addon that cannot embed in `deno compile` and is platform-specific,
reintroducing exactly the ambient-native-binary problem. There is no usable pure-JS/WASM VP8/VP9
encoder that runs in Deno.

## Decision

`imp test` records each e2e spec's browser session as an **animated GIF**, captured over the Chrome
DevTools Protocol and encoded **entirely in-process** with pure-JavaScript codecs — no ffmpeg, no
native addon, no subprocess beyond the already-sanctioned browser-under-test.

- **Capture over CDP.** imp opens a CDP session on the puppeteer page it already drives
  (`page.createCDPSession()`) and calls `Page.startScreencast` (JPEG frames, capped width via
  `maxWidth`/`maxHeight`). Chrome streams `Page.screencastFrame` events — each a base64 JPEG of the
  viewport with a timestamp — which imp collects in-process and acknowledges with
  `Page.screencastFrameAck`. No external binary, no subprocess: the frames arrive over the browser
  connection imp already holds. `Page.stopScreencast` ends capture.
- **Encode in-process, pure JS.** Collected frames are decoded with `jpeg-js` (a pure-JS JPEG
  decoder) to RGBA and encoded to an animated GIF with `gifenc` (a pure-JS quantizer + GIF encoder).
  Both are pre-bundled into `cli/src/vendor/video.js` and checksum-versioned exactly like happy-dom,
  puppeteer-core, and eslint (`prebundled-npm-dependencies.md`), so encoding runs in imp's own Deno
  process with zero native code and works offline inside the compiled binary. Frames are thinned to
  a target frame rate, capped at a maximum duration, and downscaled at capture time.
- **GIF, not WebM.** WebM was the original target because GitHub embeds it as a player, but a
  self-contained in-Deno WebM encode is not achievable (see Context). GIF is the format that _can_
  be produced under the no-subprocess / offline / self-contained-binary guarantees, and it embeds
  inline in PR markdown — a reviewer sees the clip without downloading it, which suits the
  agent-to-reviewer handoff this feature exists for. All-keyframe GIF is larger than inter-frame
  VP8, so clips are kept short, downscaled, and modest-fps by default — review aids, not archives.
- **Automatic per-spec recording, opt-in by flag or config.** Recording is off by default and turns
  on with `--video <dir>` (mirroring `--screenshots <dir>`) or a `test.video` block in `imp.json`.
  When on, imp records the **whole spec session** and writes one GIF per spec file, named with the
  existing `slug()` helper, under the given directory (default `.imp/videos/`, gitignored). Zero
  code in the spec — the flag is enough. A `finally` around the run always stops the screencast and
  flushes whatever frames were captured, so a crashing spec still yields a clip. Explicit
  bracket-the-interaction trimming is a possible future layer, not part of this decision.
- **Config defaults** live in `test.video` (`config.js`, validated beside `test.browser`/
  `test.entry`): `enable`, `fps`, `maxDuration` (seconds), `width` (px), `quality`. Users only ever
  edit `imp.json`.
- **Wiring** mirrors `--screenshots`: parsed in `main.js`, threaded through `runTests` →
  `orchestrate` passthrough args → `runSpecFile`, reusing the resolved browser and page already
  established for the spec.

This is a genuine extension of the `imp test` subprocess-exception surface in
`in-process-toolchain.md` and `two-level-testing.md`: it adds moving-image capture next to the
failure screenshot while keeping the no-subprocess guarantee intact — CDP frames arrive over the
browser connection and encoding stays in-process.

## Consequences

- An agent can produce a watchable clip of a feature working and attach it to a PR for a human to
  verify functionality and look-and-feel, with no external tooling and no network. The clip is a
  GIF, embeddable inline in markdown.
- `jpeg-js` + `gifenc` add a small pure-JS vendor bundle (~30 KB) to the binary — negligible next to
  happy-dom/puppeteer's ~3 MB. No native code, no WebCodecs dependency, no ffmpeg.
- GIF files are larger than an equivalent WebM because every frame is a keyframe; the fps/duration/
  width caps keep review clips small. If a smaller-file WebM is ever wanted, it would require
  encoding in the browser-under-test's own WebCodecs (a different capture path) — deliberately out
  of scope here.
- Recording adds capture and encode time to each recorded spec, so it stays opt-in; an un-flagged
  `imp test --e2e` behaves exactly as before.
