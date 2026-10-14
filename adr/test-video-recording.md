# E2E video recording - CDP screencast frames, a native GIF encode, no ffmpeg

## Context

An AI agent that builds a frontend feature drives `imp test` turn by turn, see
`two-level-testing.md`. It needs a visual artifact that a human reviewer can watch, to check that
the feature works and looks correct. The agent must be able to drop that artifact straight into a
GitHub pull request. The only visual capture that imp had was a still PNG screenshot on a failure.
That was a `page.screenshot()` into `.imp/screenshots/`, connected through `--screenshots <dir>`.
Nothing moved.

The obvious path for a moving image is `page.screencast()` of puppeteer. That calls a system
`ffmpeg` to encode WebM. It breaks `native-toolchain.md` twice. It starts an external tool that
is not one of the two approved exceptions of `imp test`. It also depends on a binary on the machine
that imp does not ship. So it would not work offline, inside the self-contained binary.

A WebM encode needs a VP8 or VP9 encoder. The usable ones are libvpx and FFmpeg, which are C
libraries with their own build per platform, or the WebCodecs of a browser. Each one brings back a
native dependency or a second capture path. A GIF encoder is small, and a Rust crate covers it.

## Decision

`imp test` records the browser session of each e2e spec as an **animated GIF**. It captures the
frames over the Chrome DevTools Protocol, and encodes them **in the imp process**, with Rust crates
that the binary compiles in. There is no ffmpeg, no native addon, and no subprocess other than the
browser under test, which is already approved.

- **imp captures over CDP.** The runner page opens a CDP session on the puppeteer page that it
  already drives, with `page.createCDPSession()`. It calls `Page.startScreencast`, which gives JPEG
  frames, and it caps the width with `maxWidth` and `maxHeight`. Chrome streams a
  `Page.screencastFrame` event for each frame. Each event is a base64 JPEG of the viewport, with a
  timestamp. The runner collects those frames, acknowledges each one with
  `Page.screencastFrameAck`, and posts them to the imp process when the spec ends.
  `Page.stopScreencast` ends the capture.
- **imp encodes in the imp process.** imp decodes a collected frame with the `image` crate into
  RGBA, and encodes an animated GIF with the `gif` crate, which quantizes each frame. Both compile
  into the binary, so the encode works offline. imp thins the frames to a
  target frame rate, caps the total duration, and downscales at the moment of capture.
- **The format is GIF, and not WebM.** WebM was the first target, because GitHub embeds it as a
  player. But a self-contained WebM encode is not achievable without a native codec, see the
  Context. GIF is
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
- **The config defaults live in `test.video`.** `config.rs` validates them, beside `test.browser`
  and `test.entry`. They are `enable`, `fps`, `maxDuration` in seconds, `width` in pixels, and
  `quality`. A user edits `imp.json` only.
- **The wiring mirrors `--screenshots`.** The flag travels with the run of each spec file to the
  runner page. imp reuses the browser and the page that it already established for the spec.

This is a real extension of the surface of subprocess exceptions for `imp test`, in
`native-toolchain.md` and `two-level-testing.md`. It adds the capture of a moving image beside the
screenshot of a failure, and it keeps the guarantee of no subprocess. The CDP frames arrive over the
browser connection, and the encode stays in the imp process.

## Consequences

- An agent can produce a clip of a feature at work, and attach it to a pull request, so that a
  person verifies the function and the look and feel. It needs no external tool and no network. The
  clip is a GIF, and it embeds inline in markdown.
- The `gif` crate adds little to the binary, and the `image` crate is already there for
  `imp resize`. There is no dependency on WebCodecs, and no ffmpeg.
- A GIF file is larger than an equivalent WebM, because every frame is a keyframe. The caps on the
  frame rate, the duration and the width keep a review clip small. If somebody ever wants a smaller
  WebM file, that needs an encode in the WebCodecs of the browser under test, which is a different
  capture path. That is deliberately out of scope here.
- Recording adds capture time and encode time to each recorded spec. So it stays a choice. An
  `imp test --e2e` with no flag behaves exactly as before.
