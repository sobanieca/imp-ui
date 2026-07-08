# Binary distribution — GitHub Releases, compiled per platform

## Context

imp ships as a single self-contained binary produced by `deno compile`. For the binary to be
installable, updatable, and pinnable (`version-pinning-self-delegation.md`), releases need
predictable, per-version, per-platform download URLs and an automated way to produce them. The
sibling project `sobanieca/jsonr` already solves this the same way — a GitHub Actions workflow that
compiles the binary for each target on push to `main` and attaches the assets to a tagged release —
and reusing that proven shape avoids inventing a bespoke pipeline.

## Decision

imp binaries are built and published from the `sobanieca/imp-ui` GitHub repository, mirroring
jsonr's release mechanism.

- **Version source of truth is `deno.json`'s `"version"` field.** It is baked into the binary by
  importing it (`import denoJson from '../../deno.json' with { type: 'json' }`), so `imp --version`
  and the self-delegation comparison read the same value the release is tagged with. Unlike jsonr —
  which duplicates the version into a `src/version.js` and runs a `check-version` job to keep the
  two in sync — imp imports `deno.json` directly, so no consistency check is needed.
- **A `Release` workflow on push to `main`** runs formatting/lint checks, then, when a tag for the
  current version does not already exist, compiles the binary and publishes a GitHub Release tagged
  `v{version}` via `softprops/action-gh-release`. Re-pushing without bumping the version is a no-op
  (the existing-tag guard skips the release), so the pipeline is safe to run on every push.
- **Four targets, no Windows** (matching jsonr): `x86_64`/`aarch64` × `linux`/`macos`, compiled with
  the same `--include cli/src --include lib/src` and prebundled fmt-plugin / npm-dependency prep
  that `deno task compile` uses. Assets are named `imp-{os}-{arch}` with `{os}` ∈ `linux`, `macos`
  and `{arch}` ∈ `x64`, `arm64`.
- **Download URLs** are therefore
  `https://github.com/sobanieca/imp-ui/releases/download/v{version}/imp-{os}-{arch}` for a pinned
  version and `.../releases/latest/download/imp-{os}-{arch}` for the newest; the latest version
  number resolves from `https://api.github.com/repos/sobanieca/imp-ui/releases/latest` (`tag_name`,
  leading `v` stripped).
- **An `install.sh`** detects OS/arch via `uname`, downloads the matching latest asset, and installs
  it to `INSTALL_DIR` (default `/usr/local/bin`, using `sudo` when needed) — the one-line install
  documented in `docs/cli.md`.
- **Per-asset SHA-256 checksums.** Each binary is published alongside an `imp-{os}-{arch}.sha256`
  asset (`sha256sum` output). This is the one place imp deliberately diverges from jsonr, which
  ships no checksums: because imp owns both the release workflow and the on-demand download path
  (`version-pinning-self-delegation.md`), it verifies every downloaded binary against its published
  checksum before installing it, so a truncated or tampered download fails loudly instead of
  running.

## Consequences

- Every release exposes stable, guessable URLs, which is exactly what the version manager needs to
  fetch and cache a pinned or latest binary without a registry or index.
- Releasing is fully automated from a single `deno.json` version bump; forgetting to tag or to build
  a platform cannot happen, and an unbumped push does not spuriously re-release.
- Windows users are unsupported until a Windows target is added to the workflow and the
  platform-slug map; the CLI already fails fast with a clear message on unsupported platforms.
- Downloaded binaries are integrity-checked against their published SHA-256, so a corrupted or
  tampered asset is rejected rather than executed; the trade-off is that a release missing its
  `.sha256` asset cannot be fetched on demand, which the workflow guarantees never happens.
