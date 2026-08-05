# Version pinning and self-delegation - `"version"` in `imp.json`

## Context

A project needs to build and test against a specific imp version, and everyone touching it should
use that version regardless of which imp they happen to have installed - the reproducibility that
`imp.json`'s exact dependency pins already give for third-party packages should extend to imp
itself. Because the library source served under `/@imp/` is baked into the binary
(`production-bundling.md`), pinning the CLI version pins the runtime library version too, so a
single field can govern both.

The available install mechanisms (`binary-distribution.md`) give predictable per-version download
URLs, which makes it possible to fetch a pinned version on demand rather than asking users to manage
versions by hand.

## Decision

`imp.json` may carry a `"version"` field holding an exact imp version, and every imp binary enforces
it by transparently handing off to the pinned version - the corepack / `"packageManager"` model. No
shims, no PATH manipulation: the launcher logic ships inside every binary.

- **Startup self-delegation.** Before dispatching a command, imp walks up from the current directory
  to find `imp.json` and read its `"version"`. No pin, or a pin equal to the running binary's
  baked-in version, runs as-is (the hot path, one file read). On a mismatch imp resolves the pinned
  binary at `~/.imp/versions/<version>/imp`, downloading it from GitHub Releases if absent -
  verifying it against the release's published SHA-256 checksum before caching it
  (`binary-distribution.md`) - then re-executes it with the original arguments and inherited stdio
  and exits with its status.
- **The pin is exact** (`"1.2.3"`), never a range - ranges would force a network check or staleness
  policy on every run and defeat reproducibility. `config.js` validates that `"version"`, when
  present, is a string.
- **`imp update`** resolves the latest release, downloads and caches it, and rewrites the
  `"version"` pin in the project's `imp.json` - located by walking up from the current directory,
  preferring the `imp.json` at the git repository root so the command behaves the same from any
  subdirectory. With no `imp.json` it still caches the download but writes no pin.
  `imp update <version>` pins a specific version; `imp update --check` only reports whether a newer
  release exists. `imp --version` prints the running binary's baked-in version.
- **Update awareness.** On interactive terminals, imp checks (at most once a day, cached under
  `~/.imp/update-check.json`) whether a newer release exists and, if so, prints a one-line
  `imp update` hint after the command. The check is best-effort and non-blocking - any failure is
  swallowed - and is suppressed when stdout is not a terminal, with `--no-update-check`, with
  `IMP_NO_UPDATE_CHECK`, or when the project's `imp.json` pins a `"version"` - a pinned project has
  deliberately chosen its version and moves it with `imp update`, so an unsolicited hint would be
  noise. The hint is thus limited to unpinned projects, where no version is enforced. This keeps it
  from ever affecting scripts, CI, or captured output.
- **Fail fast, never fall back.** If a pinned version cannot be obtained (offline, removed release),
  imp exits non-zero with an error naming the version - a pin that is not enforced is not a pin -
  and points at the `IMP_VERSION=system` escape hatch.
- **Escape hatches.** `IMP_VERSION=system` runs the current binary regardless of the pin; `IMP_HOME`
  overrides the per-user store location; `IMP_DELEGATED=1` is set on the re-executed child so a
  corrupted or wrong-versioned download runs once instead of forking forever; and running from
  source (detected by `Deno.execPath()` being `deno` rather than a compiled `imp`) skips delegation
  entirely, so developing imp inside a pinned project is not maddening.
- **The store lives under `~/.imp/`.** Cached versions (`~/.imp/versions/<version>/imp`) and the
  update-check timestamp live per-user, never inside a project (`vendored-dependencies.md`).
- **Usage tracking and pruning.** Each cached version records when it was last run in a
  `~/.imp/versions/<version>/lastUsed` marker (written on every delegation and every direct run of a
  cached binary; a missing marker falls back to the binary's file timestamp). A version is
  considered stale once it has not run for 30 days. Because the cache only grows - large binaries
  accumulate as projects pin and update - imp surfaces stale versions whenever it downloads a new
  one: the freshly installed version is exempt, and if any others are stale it prints a one-line
  notice suggesting `imp prune`. **`imp prune`** deletes every stale version and reports the space
  freed; it never removes the version currently running, and any pruned version is transparently
  re-downloaded if pinned again, so pruning is always safe.

## Consequences

- A project that pins `"version"` runs identically for everyone: the first command on a mismatched
  imp pays a one-time download, every command after that is the cheap hot path, and no per-project
  install or external version manager is involved.
- Pinning one field pins both the CLI and the served library, so a project cannot drift between the
  tool version and the runtime version.
- `imp update` is the single verb for moving a project forward: it fetches, caches, and re-pins in
  one step, and the next command transparently runs the new version. This is unrelated to dependency
  updates, which remain folded into `imp install` (`vendored-dependencies.md`).
- Because delegation happens before command dispatch, `imp --version` and every other command in a
  pinned project report and run the pinned version, not the binary the user launched - the effective
  version, which is the intended behavior but can surprise someone expecting the binary on their
  PATH.
- The design depends on `binary-distribution.md`'s URL scheme and on the version being baked in at
  compile time; a platform with no published binary fails fast rather than delegating.
