# Binary distribution - GitHub Releases, compiled per platform

## Context

imp ships as one self-contained binary that `cargo build --release` produces. A person must be able to
install the binary, update it, and pin it, see `version-pinning-self-delegation.md`. So a release
needs a download URL that is predictable, per version and per platform. It also needs an automated
way to produce that URL. The sibling project `sobanieca/jsonr` already solves this in the same way.
A GitHub Actions workflow compiles the binary for each target on a push to `main`, and attaches the
assets to a tagged release. imp reuses that proven shape, and invents no pipeline of its own.

## Decision

imp builds and publishes its binaries from the `sobanieca/imp-ui` GitHub repository. The mechanism
mirrors the release mechanism of jsonr.

- **The `version` of `[workspace.package]` in the root `Cargo.toml` is the source of truth.** The
  CLI crate inherits it, and the compiler puts it into the binary through `CARGO_PKG_VERSION`. So
  `imp --version`, and the comparison for self-delegation, read the same value that the release is
  tagged with, and no check keeps two copies the same.
- **The CI workflow releases on a push to `main`.** It runs the check, test and binary size jobs.
  Then a version job reads the version from `cargo metadata`, and checks whether the tag `v{version}` exists.
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
  There is no `musl` target. Each build job compiles its target with
  `cargo build --release --package imp --target <triple>`. So a release binary embeds exactly what
  the binary that the tests ran embeds: the library without its `public/` fonts, the browser
  modules, the templates, the browser driver, the skills and the licence notices, see
  `cli/build.rs`. The release profile turns on link-time optimization and strips the symbols. imp
  names an asset `imp-{os}-{arch}`, and adds `.exe`
  on Windows. `{os}` is `linux`, `macos` or `windows`. `{arch}` is `x64` or `arm64`.
- **Windows is tested in CI.** The test job runs the library unit tests, the library e2e tests and
  the CLI tests on Ubuntu and on Windows. Each suite runs in its own job, at the same time as the
  other suites. A release waits for all of them. So a change that breaks Windows cannot ship,
  although no maintainer runs Windows day to day.
- **The download URLs follow from that.** For a pinned version, it is
  `https://github.com/sobanieca/imp-ui/releases/download/v{version}/imp-{os}-{arch}`. For the newest
  version, it is `.../releases/latest/download/imp-{os}-{arch}`. imp resolves the latest version
  number from `https://api.github.com/repos/sobanieca/imp-ui/releases/latest`, from `tag_name`, with
  the leading `v` removed.
- **An `install.sh` script detects the OS and the architecture with `uname`.** It resolves the tag
  of the latest release once. Then it downloads the matching asset and its checksum from that same
  tag, so a release published during the install cannot mix the two. It installs the binary to
  `INSTALL_DIR`, which must be a folder on the `PATH`. The default is `/usr/local/bin`. The script
  never calls `sudo` itself: when it cannot write to the default folder, it stops with an error
  that says to run it with `sudo` or to set `INSTALL_DIR`. That is
  the one-line install that `docs/cli.md` documents.
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
- A release is fully automated from one change to the version in the root `Cargo.toml`. Nobody can forget to
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
