# Config discovery: JSONC, `imp.json`/`imp.jsonc`, upward search, comment-preserving edits

## Context

A project's settings live in a single hand-authored file at the project root. Two forces shaped how
imp reads and writes it:

- **Monorepos and subdirectories.** A repository may hold several imp apps, each in its own folder
  with its own config and `dependencies/`. Commands are run from wherever the developer happens to
  be - often a nested subfolder, not the app root. Reading config only from the current working
  directory silently yielded an empty config when run one level too deep, dropping the project's
  dependencies, lint/fmt settings, and version pin with no error. Only `imp update` searched upward;
  every other command did not, so behavior was inconsistent.
- **Hand-authored config wants comments.** Strict JSON forbids comments and trailing commas, which
  users reasonably want for annotating why a dependency is pinned or a path is excluded. At the same
  time, `imp install`, `imp uninstall`, and the `imp update` version pin rewrite the file
  programmatically; a naive serialize-and-overwrite discards any comments the user wrote.

## Decision

- **One config, discovered by upward search.** Every command resolves the config by walking up from
  its starting directory to the nearest folder containing `imp.json` or `imp.jsonc`, stopping at the
  repository root (a directory containing `.git`). This makes all commands behave the same from any
  subfolder, and lets each app in a monorepo carry its own config discovered independently. The
  dev/build server root for `imp start` / `imp build` stays the entry file's directory - discovery
  affects where config is read, not what is served or built.
- **JSONC parsing.** Config is parsed as JSONC (`//` and `/* */` comments and trailing commas
  tolerated) via the vendored `jsonc-parser`, not `JSON.parse`. `imp.json` is checked first, then
  `imp.jsonc` in the same directory.
- **Comment-preserving edits.** Programmatic writes (`imp install`, `imp uninstall`, the
  `imp update` version pin) apply targeted `jsonc-parser` edits to the existing file text, touching
  only the keys they change and leaving surrounding comments and formatting intact. New dependency
  entries are inserted in alphabetical position; the version pin is inserted at the top. When no
  config file exists, these commands create `imp.json` (never `imp.jsonc`).

## Consequences

- Commands work from any subfolder of a project, and a monorepo of independent imp apps needs no
  special configuration - each folder's `imp.json`/`imp.jsonc` and `dependencies/` are found based
  on where the command runs.
- Users can comment and trailing-comma their config freely, in either `imp.json` or `imp.jsonc`, and
  imp's own edits preserve those comments rather than flattening the file.
- Config error messages name the actual file found (`imp.json` or `imp.jsonc`).
- `jsonc-parser` is pre-bundled into the binary like every other runtime npm dependency (see
  [prebundled-npm-dependencies](prebundled-npm-dependencies.md)).
- Inline trailing comments can occasionally shift to an adjacent line when a new sibling key is
  inserted next to them - comments are never lost, but their exact placement is not guaranteed
  across a programmatic edit.
