# Version manager — `"version"` pin in `imp.json`

Let a project pin the imp version it is built against:

```json
{
  "version": "2.4.5"
}
```

Every imp binary transparently detects the pin, fetches that version if needed, and re-executes into
it — the corepack / `"packageManager"` model. No shims, no shell hooks, no PATH manipulation: imp is
a single self-contained binary, so the launcher logic ships inside every release.

## Startup flow

Runs before command dispatch in `src/cli/main.js`:

1. **Read the pin.** Walk up from cwd to find `imp.json` (walking up matters — `imp lint src/` from
   a subdirectory must honor the project pin). No file or no `"version"` field → run as-is.
2. **Compare** the pin against the version embedded in the running binary. Match → run as-is. This
   is the hot path; it costs one file read that `prepareConfig` already performs.
3. **On mismatch, resolve** the requested binary at `~/.imp/versions/<version>/imp` (`imp.exe` on
   Windows; root overridable via `IMP_HOME`). If absent, download it:
   - fetch the release asset for `Deno.build.os` / `Deno.build.arch`
   - verify its checksum against the published `.sha256`
   - write to a temp file, `chmod +x`, atomically rename into place
   - print one imp-branded status line, e.g. `imp 2.4.5 (pinned by imp.json) — downloading…`
4. **Re-exec:** spawn the resolved binary with the original `Deno.args`, stdio inherited, and exit
   with its code.

Recursion cannot loop in the normal case (the delegated binary sees its own version matches the
pin), but set a guard env var (`IMP_DELEGATED=1`) so a corrupted download errors out instead of
forking forever.

## Failure behavior — fail fast

If the pinned version cannot be obtained (offline, yanked release, checksum mismatch), **exit
non-zero with a clear error** naming the pinned version and the reason. Do not fall back to the
current binary — a pin that is not enforced is not a pin. The error message points at the
`IMP_VERSION=system` escape hatch for deliberate overrides.

## Embedded version

- Add `"version"` to the root `deno.json` (imp's internal manifest — stays behind the translation
  layer, users never see it).
- Import it where needed: `import denoJson from '../../deno.json' with { type: 'json' }`;
  `deno compile` bakes it in.
- Gives `imp --version` for free — add that flag as part of this work.

## Escape hatches

- **Dev mode:** when running from source (`deno task imp`), skip delegation entirely — otherwise
  developing imp inside a project that pins a version is maddening. Detect via `Deno.execPath()`
  ending in `deno` rather than `imp`.
- **`IMP_VERSION=system`:** run the binary on PATH regardless of the pin, for debugging.
- **`IMP_HOME`:** override the version-store location.

## Version store

- Global store at `~/.imp/versions/<version>/imp` — everything imp stores lives under the per-user
  `~/.imp/`, never inside a project (`adr/no-lockfile-exact-versions.md`).

## Download source

Gated on `binary-hosting.md`. GitHub Releases with a predictable scheme:

```
.../releases/download/v{version}/imp-{os}-{arch}
.../releases/download/v{version}/imp-{os}-{arch}.sha256
```

HTTPS only; checksum verification is mandatory.

## Pin semantics

- **Exact version only** (`"2.4.5"`), at least initially. Ranges (`"^2.4"`) would force a network
  check or a staleness policy on every run; exact pins give reproducibility, which is the point.
  Ranges can be added later without breaking exact pins.

## User-facing commands (cheap once the plumbing exists)

- `imp use <version>` — write the pin into `imp.json` and pre-download the binary.
- `imp versions` — list cached versions in `~/.imp/versions/`.

## Notes

- Because the library source served at `/@imp/` is baked into the binary, pinning the CLI version
  pins the runtime library version too — one field controls both.
- Once implemented, record the decision as an ADR (e.g. `version-pinning-self-delegation.md`) and
  document the `"version"` field in `docs/cli.md` under the `imp.json` section.
