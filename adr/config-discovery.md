# Config discovery: JSONC, `imp.json`/`imp.jsonc`, upward search, comment-preserving edits

## Context

The settings of a project live in one file that a person writes, at the project root. Two forces
shaped how imp reads that file, and how it writes it:

- **A monorepo and a subdirectory.** A repository can hold several imp apps. Each one sits in its
  own folder, with its own config and its own `dependencies/`. A developer runs a command from
  wherever they are, and that is often a nested subfolder, not the app root. When imp read the
  config from the current working directory only, a run one level too deep gave an empty config,
  with no error. That dropped the dependencies of the project, the lint and fmt settings, and the
  version pin. Only `imp update` searched upward. No other command did, so the behaviour was
  inconsistent.
- **A config that a person writes needs comments.** Strict JSON forbids a comment and a trailing
  comma. A user reasonably wants both, to note why a dependency is pinned, or why a path is
  excluded. At the same time, `imp install`, `imp uninstall` and the version pin of `imp update`
  rewrite the file from code. A simple serialize and overwrite would discard every comment that the
  user wrote.

## Decision

- **There is one config, and imp discovers it by a search upward.** Every command resolves the
  config by a walk up from its starting directory. It stops at the nearest folder that contains
  `imp.json` or `imp.jsonc`, and at the repository root, which is a directory that contains `.git`.
  So every command behaves the same way from any subfolder, and each app in a monorepo carries its
  own config, which imp discovers on its own. The server root for `imp start` and `imp build` stays
  the directory of the entry file. The discovery affects where imp reads the config, not what imp
  serves or builds.
- **imp parses the config as JSONC.** It tolerates a `//` comment, a `/* */` comment and a trailing
  comma. It uses the vendored `jsonc-parser`, not `JSON.parse`. imp checks `imp.json` first, and
  then `imp.jsonc` in the same directory.
- **An edit from code keeps the comments.** `imp install`, `imp uninstall` and the version pin of
  `imp update` apply targeted `jsonc-parser` edits to the existing text of the file. They touch only
  the keys that they change, and they leave the comments and the formatting around those keys as
  they are. imp inserts a new dependency entry in alphabetical position. It inserts the version pin
  at the top. When no config file exists, these commands create `imp.json`, and never `imp.jsonc`.

## Consequences

- A command works from any subfolder of a project. A monorepo of independent imp apps needs no
  special configuration. imp finds the `imp.json` or `imp.jsonc` of each folder, and its
  `dependencies/`, from where the command runs.
- A user can write a comment and a trailing comma freely, in `imp.json` or in `imp.jsonc`. The edits
  of imp keep those comments. imp does not flatten the file.
- An error message about the config names the file that imp found, which is `imp.json` or
  `imp.jsonc`.
- imp parses and edits the file with the `jsonc-parser` crate, which keeps the concrete syntax tree,
  comments included. See `native-toolchain.md`.
- A trailing comment on a line can sometimes move to the next line, when imp inserts a new sibling
  key beside it. imp never loses a comment, but an edit from code does not guarantee its exact
  place.
