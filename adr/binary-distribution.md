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
- **A `Release` workflow runs on a push to `main`.** It runs the formatting checks and the lint
  checks. Then, when no tag for the current version exists, it compiles the binary and publishes a
  GitHub Release, tagged `v{version}`, through `softprops/action-gh-release`. A second push with no
  change of the version does nothing, because the guard for an existing tag skips the release. So
  the pipeline is safe to run on every push.
- **There are four targets, and no Windows.** That matches jsonr. The targets are `x86_64` and
  `aarch64`, across `linux` and `macos`. imp compiles them with the same
  `--include cli/src --include lib/src`, and with the same preparation of the prebundled fmt plugins
  and npm dependencies, as `deno task compile`. imp names an asset `imp-{os}-{arch}`. `{os}` is
  `linux` or `macos`. `{arch}` is `x64` or `arm64`.
- **The download URLs follow from that.** For a pinned version, it is
  `https://github.com/sobanieca/imp-ui/releases/download/v{version}/imp-{os}-{arch}`. For the newest
  version, it is `.../releases/latest/download/imp-{os}-{arch}`. imp resolves the latest version
  number from `https://api.github.com/repos/sobanieca/imp-ui/releases/latest`, from `tag_name`, with
  the leading `v` removed.
- **An `install.sh` script detects the OS and the architecture with `uname`.** It downloads the
  matching latest asset, and installs it to `INSTALL_DIR`. The default is `/usr/local/bin`, and the
  script uses `sudo` when it must. That is the one-line install that `docs/cli.md` documents.
- **Each asset has a SHA-256 checksum.** imp publishes each binary with an `imp-{os}-{arch}.sha256`
  asset, which holds the output of `sha256sum`. This is the one place where imp deliberately differs
  from jsonr, which ships no checksum. imp owns the release workflow and the on-demand download
  path, see `version-pinning-self-delegation.md`. So it verifies every downloaded binary against its
  published checksum before it installs the binary. A download that is truncated, or changed, then
  fails with a message. It does not run.

## Consequences

- Every release exposes a stable URL that you can construct. That is exactly what the version
  manager needs, to fetch and cache a pinned or a latest binary, with no registry and no index.
- A release is fully automated from one change to the version in `deno.json`. Nobody can forget to
  tag, or to build a platform. A push with no change of the version does not release again by
  mistake.
- A Windows user is unsupported until somebody adds a Windows target to the workflow, and to the map
  of platform names. The CLI already fails immediately, with a clear message, on an unsupported
  platform.
- imp checks the integrity of a downloaded binary against its published SHA-256. So imp rejects an
  asset that is corrupt or changed, instead of running it. The trade is that imp cannot fetch a
  release that has no `.sha256` asset on demand. The workflow guarantees that this never happens.
