# update - pinning the imp version, and reclaiming disk

```
imp update            resolve the latest release, download it, pin it in imp.json
imp update 1.2.3      pin a specific version instead
imp update --check    report whether a newer release exists; change nothing
imp prune             delete cached versions not run in 30+ days
imp licenses          print the third-party license notices the binary ships
```

## The pin

A project pins the exact imp version it is built against in `imp.json`'s `version` - see
[config](config.md). Once pinned, **any** imp binary runs the project on that version: on startup
imp compares the pin against itself and, on a mismatch, fetches the pinned version (once, cached per
user) and hands off to it. There is nothing to install per project and no version manager -
`imp start`, `imp test`, everything, runs the version the project pins.

`imp update` prints what changed (`imp updated 1.2.3 -> 1.3.0`) and the next command picks it up. It
searches upward for the project, preferring the `imp.json` at the repository root, so it works from
any subdirectory. With no `imp.json` the release is still downloaded and cached, but no pin is
written.

## Rules an agent gets wrong

- **Pins are exact.** `"1.2.3"`, never a range - that is what makes them reproducible. Move the pin
  with `imp update`, do not hand-edit it.
- **A pin that cannot be obtained is a hard error** naming the version (offline, or the release was
  pulled) - imp never silently runs a different one. `IMP_VERSION=system` bypasses the pin
  deliberately, for debugging against the binary you have.
- **Updating imp is not a routine step.** Do it when asked, or when a fix you need requires it -
  never as a reflex before other work, since a version change affects everyone on the project.
- **After upgrading, exercise installed components built for an imp host** - they run on the imp
  version your app provides, not the one their author built against. See
  [dependencies](dependencies.md).
- Downloaded versions are cached per user under `~/.imp/`, each verified against its published
  checksum. `IMP_HOME` moves the cache - useful in CI or a container with a read-only home.
- In an **unpinned** project imp prints a one-line update hint at most once a day when a newer
  release exists; it stays silent when a pin is present. Silence it with `--no-update-check` or
  `IMP_NO_UPDATE_CHECK`.

## `imp prune`

Cached binaries are large and the cache only grows, so imp records when each version last ran and
points out any idle for over 30 days:

```
2 unused imp versions (1.1.0, 1.2.3) have not run in over 30 days - run 'imp prune' to reclaim disk space
```

`imp prune` deletes exactly those. The version currently running is never removed, and anything you
pin again later is re-downloaded on demand - pruning is always safe.

## `imp licenses`

Prints the third-party license notices for everything bundled into the binary - each component, its
version, and the full license text. No arguments, nothing to configure.

**This is the toolchain, not your app.** None of it ships to a user. The notices for the code an app
actually serves are collected by `imp build` into `LICENSES.txt`; see [build](build.md).
