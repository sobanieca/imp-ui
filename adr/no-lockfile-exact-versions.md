# No lock file, no generated project files — exact versions in source

## Context

imp's all-in-one pitch includes keeping the user's repository clean: an imp app should be able to be
`index.html` plus a few modules and nothing else. The CLI previously created two artifacts in the
project: `.imp/` (a derived internal config consumed by the dev server's dependency loader) and
`imp.lock` (dependency version pins). Both exist in other toolchains for good reasons, but both are
files the user never wanted to think about.

## Decision

imp never writes files or directories into the user's project.

- **No `.imp/`, and no derived config anywhere.** The dev server's dependency loader turned out to
  need no config file at all (verified: `npm:`/`jsr:` bundling works without one and creates no
  lockfile), so the CLI writes nothing to disk beyond the user's own files it is asked to format.
  Longer-lived storage (dependency caches, toolchains) belongs in per-user locations under
  `~/.imp/`.
- **No `imp.lock`.** Reproducibility comes from the source code itself: dependency specifiers must
  pin exact versions (`npm:mitt@3.0.1`). The always-on `exact-dependency-versions` lint rule
  enforces this for static imports, dynamic imports, and `imp.json` `imports` aliases — ranges and
  missing versions are lint errors. The rationale: a lock file exists to freeze what ranges leave
  open; with ranges forbidden at the source level, the code itself is the record of what the app
  depends on, and there is nothing left for a lock file to add for direct dependencies. What an
  exact top-level pin cannot freeze is the package's own dependency ranges — so this decision rests
  on an explicit assumption: **the packages an imp app uses are well-behaved about their transitive
  dependencies** (compatible ranges, no breakage across the releases they admit). imp targets small
  browser apps built on small, self-contained packages, where that assumption holds; packages with
  fragile transitive graphs are a poor fit for imp regardless.
- The only file imp recognizes in a project is the optional, user-authored `imp.json`.

## Consequences

- A fresh clone is the whole app; `git status` is never polluted by toolchain artifacts, and there
  is no lock file to commit, review, or resolve conflicts in.
- Exact top-level pins make resolution highly stable, but transitive dependencies declared as ranges
  by package authors can still drift over time. This is an accepted trade-off; if it ever bites,
  resolved-graph pinning can be added inside `imp.json` without introducing a second file.
- The lint rule makes version discipline a default rather than a convention — code review sees the
  exact dependency change because the version lives in the import line.
