# Binary distribution - GitHub Releases, compiled per platform

## Context

imp ships as one self-contained binary that `deno compile` produces. A person must be able to
install the binary, update it, and pin it, see `version-pinning-self-delegation.md`. So a release
needs a download URL that is predictable, per version and per platform. It also needs an automated
way to produce that URL. The sibling project `sobanieca/jsonr` already solves this in the same way.
A GitHub Actions workflow compiles the binary for each target on a push to `main`, and attaches the
assets to a tagged release. imp reuses that proven shape, and invents no pipeline of its own.

## Decision

imp builds and publishes its binaries from the `sobanieca/imp-ui` GitHub repository. The mechanism
mirrors the release mechanism of jsonr.

- **The `"version"` field of `deno.json` is the source of truth.** imp puts it into the binary by an
  import, as in `import denoJson from '../../deno.json' with { type: 'json' }`. So `imp --version`,
  and the comparison for self-delegation, read the same value that the release is tagged with. jsonr
  copies its version into a `src/version.js`, and runs a `check-version` job to keep the two the
  same. imp imports `deno.json` directly, so it needs no such check.
- **The CI workflow releases on a push to `main`.** It runs the formatting, lint, test and binary
  size jobs. Then a version job reads the version, and checks whether the tag `v{version}` exists.
  When no tag exists, the build jobs run, and a release job publishes a GitHub Release through
  `softprops/action-gh-release`. A second push with no change of the version does nothing, because
  the guard for an existing tag skips the build and the release. So the pipeline is safe to run on
  every push.
- **Each binary is built and run on its own platform.** A cross-compiled binary that no job runs can
  ship broken. So each target has a build job on a GitHub runner of the same OS and architecture:
  `ubuntu-latest`, `ubuntu-24.04-arm`, `macos-15-intel`, `macos-latest`, `windows-latest` and
  `windows-11-arm`. The job compiles the binary, then runs it as a smoke test. The binary must print
  the release version with `--version`. Then `init`, `build` and `test --unit` must pass in a
  temporary folder. The job uploads the binary and its checksum as a workflow artifact. The release
  job downloads the six artifacts, verifies each checksum, and publishes them.
- **Only one release job runs at a time.** The release job is in the concurrency group `release`,
  and it never cancels a release in progress. It checks for the tag again before it publishes. So
  two pushes of the same version cannot publish twice. GitHub keeps one waiting job per group, so a
  newer waiting release job replaces an older one that waits.
- **There are six targets.** They are `x86_64` and `aarch64` for `linux`, `macos` and `windows`.
  There is no `musl` target, because `deno compile` has none. Each build job compiles its target
  with a command of this form: `tools/compile.js --target <triple> --output <file>`. So a release
  binary has exactly the include set of the binary that the tests ran: the CLI, the library without
  its `public/` fonts, the skills and the licence notices. It also gets the same preparation of the
  prebundled fmt plugins and npm dependencies. imp names an asset `imp-{os}-{arch}`, and adds `.exe`
  on Windows. `{os}` is `linux`, `macos` or `windows`. `{arch}` is `x64` or `arm64`.
- **Windows is tested in CI.** The test job runs `deno task test` on Ubuntu and on Windows. A
  release waits for both. So a change that breaks Windows cannot ship, although no maintainer runs
  Windows day to day.
- **The download URLs follow from that.** For a pinned version, it is
  `https://github.com/sobanieca/imp-ui/releases/download/v{version}/imp-{os}-{arch}`. For the newest
  version, it is `.../releases/latest/download/imp-{os}-{arch}`. imp resolves the latest version
  number from `https://api.github.com/repos/sobanieca/imp-ui/releases/latest`, from `tag_name`, with
  the leading `v` removed.
- **An `install.sh` script detects the OS and the architecture with `uname`.** It downloads the
  matching latest asset, and installs it to `INSTALL_DIR`. The default is `/usr/local/bin`, and the
  script uses `sudo` when it must. That is the one-line install that `docs/cli.md` documents.
- **An `install.ps1` script does the same on Windows, in PowerShell.** It installs
  `imp-windows-x64.exe` as `imp.exe` into `%LOCALAPPDATA%\Programs\imp`, or `INSTALL_DIR`, and adds
  that folder to the `PATH` of the user. It needs no administrator rights.
- **Each asset has a SHA-256 checksum.** imp publishes each binary with an `imp-{os}-{arch}.sha256`
  asset. It holds the hex digest and the asset name, in the format of `sha256sum`. The build job
  computes it with `sha256sum`, or with `shasum -a 256` on macOS. This is the one place where imp
  deliberately differs from jsonr, which ships no checksum. imp owns the release workflow and the
  on-demand download path, see `version-pinning-self-delegation.md`. So it verifies every downloaded
  binary against its published checksum before it installs the binary. A download that is truncated,
  or changed, then fails with a message. It does not run.

## Consequences

- Every release exposes a stable URL that you can construct. That is exactly what the version
  manager needs, to fetch and cache a pinned or a latest binary, with no registry and no index.
- A release is fully automated from one change to the version in `deno.json`. Nobody can forget to
  tag, or to build a platform. A push with no change of the version does not release again by
  mistake.
- Linux with musl, such as Alpine, has no binary. The CLI fails immediately, with a clear message,
  on a platform that has no binary. The e2e tests on Windows use the pinned Chrome build for
  `win64`, on both architectures.
- The CI of every push takes longer, because the tests run twice.
- A release needs six runners, two of them macOS and two of them Windows. When GitHub retires a
  runner image, the build job for that target fails, and no release ships until the workflow names a
  current image.
- imp checks the integrity of a downloaded binary against its published SHA-256. So imp rejects an
  asset that is corrupt or changed, instead of running it. The trade is that imp cannot fetch a
  release that has no `.sha256` asset on demand. The workflow guarantees that this never happens.
