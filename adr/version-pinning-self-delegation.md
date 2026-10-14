# Version pinning and self-delegation - `"version"` in `imp.json`

## Context

A project must build and test against a specific imp version. Everyone who touches the project must
use that version, whichever imp they happen to have installed. The exact pins for a dependency in
`imp.json` already give that reproducibility for a third-party package, and it must extend to imp
itself. imp bakes the library source that it serves under `/@imp/` into the binary, see
`production-bundling.md`. So a pin of the CLI version also pins the version of the runtime library,
and one field can govern both.

The install mechanisms, see `binary-distribution.md`, give a download URL that is predictable per
version. That makes it possible to fetch a pinned version on demand, and not to ask a user to manage
a version by hand.

## Decision

`imp.json` can carry a `"version"` field, which holds an exact imp version. Every imp binary
enforces that field, and hands the run to the pinned version. That is the model of corepack and of
`"packageManager"`. There is no shim, and there is no change to the `PATH`. Every binary ships the
launcher logic.

- **imp delegates at startup.** Before it dispatches a command, imp walks up from the current
  directory to find `imp.json`, and reads its `"version"`. With no pin, or with a pin equal to the
  version that the running binary carries, imp runs the command as it is. That is the hot path, and
  it costs one read of a file. When the two differ, imp resolves the pinned binary at
  `~/.imp/versions/<version>/imp`. When that binary is absent, imp downloads it from GitHub
  Releases, and verifies it against the published SHA-256 checksum of the release before it caches
  it, see `binary-distribution.md`. imp then runs that binary again, with the original arguments and
  the inherited stdio, and exits with its status.
- **The pin is exact**, as in `"1.2.3"`, and never a range. A range would force a check over the
  network, or a policy about staleness, on every run. Both defeat reproducibility. `config.js`
  validates that `"version"`, when it is present, is an exact version string, such as `"1.2.3"`.
- **`imp update`** resolves the latest release, downloads and caches it, and rewrites the
  `"version"` pin in the `imp.json` of the project. It finds that file by a walk up from the current
  directory, and it prefers the `imp.json` at the root of the git repository. So the command behaves
  the same way from any subdirectory. With no `imp.json`, imp still caches the download, and writes
  no pin. `imp update <version>` pins a specific version. `imp update --check` only reports whether
  a newer release exists. `imp --version` prints the version that the running binary carries.
- **imp reports an available update.** On an interactive terminal, imp checks whether a newer
  release exists, at most once a day, and caches the answer in `~/.imp/update-check.json`. When one
  exists, imp prints a hint of one line about `imp update`, after the command. The check is best
  effort, and it does not block. imp discards any failure. imp suppresses the check when stdout is
  not a terminal, with `--no-update-check`, with `IMP_NO_UPDATE_CHECK`, and when the `imp.json` of
  the project pins a `"version"`. A pinned project chose its version deliberately, and it moves that
  version with `imp update`. So a hint that nobody asked for would be noise. The hint is therefore
  limited to a project with no pin, where nothing enforces a version. That keeps the hint away from
  a script, from CI, and from captured output.
- **imp fails immediately, and never falls back.** When imp cannot obtain a pinned version, because
  the machine is offline or because somebody removed the release, imp exits with a non-zero code,
  and the error names the version. A pin that nobody enforces is not a pin. The error points at the
  `IMP_VERSION=system` escape hatch.
- **There are escape hatches.** `IMP_VERSION=system` runs the current binary, whatever the pin says.
  `IMP_CACHE_DIR` moves the cache folder of imp, and the store with it. imp sets `IMP_DELEGATED=1`
  on the child that it runs again, so a download that is corrupt, or that carries the wrong version,
  runs once, and does not fork forever. The child removes `IMP_DELEGATED` from its own environment
  as it starts. So a process that the child starts, such as an imp in another pinned project, does
  its own delegation. A pin that equals the version of the running binary runs in place.
- **The store lives in the cache folder of imp, `~/.imp/` by default.** A cached version sits at
  `~/.imp/versions/<version>/imp`, or `imp.exe` on Windows, and the timestamp of the update check
  sits beside it. `IMP_CACHE_DIR` moves the whole folder, which also holds the e2e browser, see
  `two-level-testing.md`. Both live per user, and never inside a project, see
  `vendored-dependencies.md`.
- **imp tracks usage, and prunes.** Each cached version records when it last ran, in a
  `~/.imp/versions/<version>/lastUsed` marker. imp writes that marker on every delegation, and on
  every direct run of a cached binary. When the marker is missing, imp falls back to the file
  timestamp of the binary. A version is old when it has not run for 30 days. The cache only grows,
  because a large binary accumulates as a project pins and updates. So imp reports the old versions
  whenever it downloads a new one. The version that imp just installed is exempt. When another
  version is old, imp prints a notice of one line that suggests `imp prune`. **`imp prune`** deletes
  every old version, and reports the space that it freed. It never removes the version that runs
  now. When you pin a pruned version again, imp downloads it again. So a prune is always safe.

## Consequences

- A project that pins `"version"` runs in the same way for everyone. The first command on an imp
  that does not match pays a download once. Every command after that takes the cheap hot path. There
  is no install per project, and there is no external version manager.
- A pin of one field pins the CLI and the served library. So a project cannot drift between the
  version of the tool and the version of the runtime.
- `imp update` is the one verb that moves a project forward. It fetches, caches and pins again, in
  one step, and the next command runs the new version. It has no relation to an update of a
  dependency, which stays part of `imp install`, see `vendored-dependencies.md`.
- The delegation happens before imp dispatches a command. So in a pinned project, `imp --version`,
  and every other command, report and run the pinned version, and not the binary that the user
  started. That is the effective version, which is the intended behaviour. It can surprise a person
  who expects the binary on their `PATH`.
- The design depends on the URL scheme of `binary-distribution.md`, and on a version that imp bakes
  in at compile time. A platform with no published binary fails immediately, and imp does not
  delegate.
