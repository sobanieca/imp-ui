# update - pinning the imp version, and reclaiming disk

```
imp update            resolve the latest release, download it, pin it in imp.json
imp update 1.2.3      pin a specific version instead
imp update --check    report whether a newer release exists; change nothing
imp prune             delete cached versions not run in 30+ days
imp licenses          print the third-party license notices the binary ships
```

## The pin

A project pins the exact imp version that it is built against. The pin is the `version` key in
`imp.json`, see [config](config.md). After you pin a version, **any** imp binary runs the project on
that version. At startup, imp compares the pin against itself. If the two differ, imp fetches the
pinned version and hands the run to it. imp fetches the version once and caches it per user. There
is nothing to install per project, and there is no version manager. Every command, such as
`imp start` and `imp test`, runs the version that the project pins.

`imp update` prints what changed, for example `imp updated 1.2.3 -> 1.3.0`. The next command uses
the new version. The command searches upward for the project, and prefers the `imp.json` at the
repository root. So it works from any subdirectory. With no `imp.json`, imp still downloads and
caches the release, but it writes no pin.

## Rules an agent gets wrong

- **A pin is exact.** Write `"1.2.3"`, never a range. The exact value is what makes a build
  reproducible. To move the pin, run `imp update`. Do not edit the pin by hand.
- **A pin that imp cannot obtain is a hard error**, and the error names the version. This happens
  when the machine is offline, or when the release is withdrawn. imp never runs a different version
  in silence. To bypass the pin on purpose, set `IMP_VERSION=system`. Use it to debug against the
  binary that you have.
- **An imp update is not a routine step.** Update when a user asks for it, or when you need a fix
  that a new version contains. Do not update as a reflex before other work. A version change affects
  everyone on the project.
- **After an update, exercise the installed components that are built for an imp host.** They run on
  the imp version that your app provides, not on the version that their author built against. See
  [dependencies](dependencies.md).
- imp caches a downloaded version per user under `~/.imp/`, and verifies each one against its
  published checksum. `IMP_HOME` moves the cache. This helps in CI, or in a container that has a
  read-only home directory.
- In a project with **no pin**, imp prints a one-line update hint when a newer release exists, at
  most once a day. imp stays silent when a pin is present. To stop the hint, use `--no-update-check`
  or `IMP_NO_UPDATE_CHECK`.

## `imp prune`

A cached binary is large, and the cache only grows. So imp records when each version last ran, and
reports any version that is idle for more than 30 days:

```
2 unused imp versions (1.1.0, 1.2.3) have not run in over 30 days - run 'imp prune' to reclaim disk space
```

`imp prune` deletes exactly those versions. imp never removes the version that runs now. If you pin
a deleted version again later, imp downloads it on demand. So a prune is always safe.

## `imp licenses`

`imp licenses` prints the third-party license notices for everything that the binary contains. For
each component it prints the name, the version and the full license text. The command takes no
argument and has no configuration.

**These notices cover the toolchain, not your app.** None of this code goes to a user. `imp build`
collects the notices for the code that an app serves into `LICENSES.txt`. See [build](build.md).
