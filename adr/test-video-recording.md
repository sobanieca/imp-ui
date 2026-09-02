# E2E video recording - CDP screencast frames, in-process GIF encode, no ffmpeg

## Context

An AI agent that builds a frontend feature drives `imp test` turn by turn, see
`two-level-testing.md`. It needs a visual artifact that a human reviewer can watch, to check that
the feature works and looks correct. The agent must be able to drop that artifact straight into a
GitHub pull request. The only visual capture that imp had was a still PNG screenshot on a failure.
That was a `page.screenshot()` into `.imp/screenshots/`, connected through `--screenshots <dir>`.
Nothing moved.

The obvious path for a moving image is `page.screencast()` of puppeteer. That calls a system
`ffmpeg` to encode WebM. It breaks `in-process-toolchain.md` twice. It starts an external tool that
is not one of the two approved exceptions of `imp test`. It also depends on a binary on the machine
that imp does not ship. So it would not work offline, inside the self-contained binary.

imp investigated a WebM encode fully in process, and rejected it as not feasible. The runtime of imp
is Deno. Deno has **no WebCodecs**, because `VideoEncoder` and `VideoFrame` are absent. Deno also
has **no readable 2D canvas**. So Deno cannot encode video in process, and it cannot even read
decoded pixels there. Mediabunny was the muxer that imp first considered. It needs WebCodecs for the
encode step. Its variant for a server delegates to `node-av`, which is a native N-API addon over
libav and FFmpeg. That addon cannot go into `deno compile`, and it is specific to a platform. So it
brings back exactly the problem of a native binary on the machine. There is no usable VP8 or VP9
encoder, in pure JavaScript or in wasm, that runs in Deno.

## Decision

`imp test` records the browser session of each e2e spec as an **animated GIF**. It captures the
frames over the Chrome DevTools Protocol, and encodes them **fully in process**, with codecs in pure
JavaScript. There is no ffmpeg, no native addon, and no subprocess other than the browser under
test, which is already approved.

- **imp captures over CDP.** imp opens a CDP session on the puppeteer page that it already drives,
  with `page.createCDPSession()`. It calls `Page.startScreencast`, which gives JPEG frames, and it
  caps the width with `maxWidth` and `maxHeight`. Chrome streams a `Page.screencastFrame` event for
  each frame. Each event is a base64 JPEG of the viewport, with a timestamp. imp collects those
  frames in process, and acknowledges each one with `Page.screencastFrameAck`. There is no external
  binary and no subprocess. The frames arrive over the browser connection that imp already holds.
  `Page.stopScreencast` ends the capture.
- **imp encodes in process, in pure JavaScript.** imp decodes a collected frame with `jpeg-js`,
  which is a JPEG decoder in pure JavaScript, into RGBA. It encodes an animated GIF with `gifenc`,
  which is a quantizer and a GIF encoder in pure JavaScript. imp pre-bundles both into
  `cli/src/vendor/video.js`, and versions them by checksum, exactly like happy-dom, puppeteer-core
  and eslint, see `prebundled-npm-dependencies.md`. So the encode runs in the Deno process of imp,
  with no native code, and it works offline inside the compiled binary. imp thins the frames to a
  target frame rate, caps the total duration, and downscales at the moment of capture.
- **The format is GIF, and not WebM.** WebM was the first target, because GitHub embeds it as a
  player. But a self-contained WebM encode inside Deno is not achievable, see the Context. GIF is
  the format that imp _can_ produce, under the guarantees of no subprocess, offline work, and a
  self-contained binary. A GIF also embeds inline in the markdown of a pull request. So a reviewer
  sees the clip and downloads nothing, and that suits the handover from an agent to a reviewer that
  this feature exists for. A GIF holds only keyframes, so it is larger than inter-frame VP8. imp
  therefore keeps a clip short, downscaled, and at a modest frame rate by default. A clip is an aid
  for a review, and not an archive.
- **imp records each spec automatically, and you turn the feature on with a flag or with the
  config.** Recording is off by default. It turns on with `--video <dir>`, which mirrors
  `--screenshots <dir>`, or with a `test.video` block in `imp.json`. When it is on, imp records the
  **whole session of a spec**, and writes one GIF per spec file. imp names the file with the
  existing `slug()` helper, under the given directory. The default is `.imp/videos/`, and git
  ignores it. The spec needs no code, and the flag is enough. A `finally` around the run always
  stops the screencast, and writes whatever frames imp captured. So a spec that crashes still gives
  a clip. A layer that brackets one interaction, to trim the clip, is possible later. It is not part
  of this decision.
- **The config defaults live in `test.video`.** `config.js` validates them, beside `test.browser`
  and `test.entry`. They are `enable`, `fps`, `maxDuration` in seconds, `width` in pixels, and
  `quality`. A user edits `imp.json` only.
- **The wiring mirrors `--screenshots`.** `main.js` parses the flag. imp threads it through
  `runTests`, then through the passthrough arguments of `orchestrate`, and then into `runSpecFile`.
  imp reuses the browser and the page that it already established for the spec.

This is a real extension of the surface of subprocess exceptions for `imp test`, in
`in-process-toolchain.md` and `two-level-testing.md`. It adds the capture of a moving image beside
the screenshot of a failure, and it keeps the guarantee of no subprocess. The CDP frames arrive over
the browser connection, and the encode stays in process.

## Consequences

- An agent can produce a clip of a feature at work, and attach it to a pull request, so that a
  person verifies the function and the look and feel. It needs no external tool and no network. The
  clip is a GIF, and it embeds inline in markdown.
- `jpeg-js` and `gifenc` add a small vendor bundle in pure JavaScript to the binary, of about 30 KB.
  That is small beside the roughly 3 MB of happy-dom and puppeteer. There is no native code, no
  dependency on WebCodecs, and no ffmpeg.
- A GIF file is larger than an equivalent WebM, because every frame is a keyframe. The caps on the
  frame rate, the duration and the width keep a review clip small. If somebody ever wants a smaller
  WebM file, that needs an encode in the WebCodecs of the browser under test, which is a different
  capture path. That is deliberately out of scope here.
- Recording adds capture time and encode time to each recorded spec. So it stays a choice. An
  `imp test --e2e` with no flag behaves exactly as before.
