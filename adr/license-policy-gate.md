# The license policy is a gate, not a report - `licenses` in imp.json

## Context

`vendored-dependency-manifest.md` records every bundled package's SPDX identifier, which answers
"what am I shipping, under what terms?" - but only for someone who opens the manifest and reads it.
The question teams actually need answered is the one that blocks a release: may we ship this at all?

That question has teeth for imp specifically. An imp app is a bundled, minified artifact served to
users, which is distribution of a derived work. A copyleft dependency anywhere in the graph can
oblige the app to publish its own source. Nothing about the vendoring model makes that visible: the
bundle is opaque, the obligation is transitive, and a package added by a colleague looks like any
other diff.

A report read after the fact is the wrong shape for this. By the time anyone reads it the dependency
is committed, imported, and load-bearing. The check has to run at the moment the dependency arrives.

## Decision

One `imp.json` key, `licenses`, states the terms the project accepts. It is checked by `imp install`
and by `imp build`, and a violation is an error, not a warning.

- **A tier by default.** `"permissive"` (the default), `"weak-copyleft"`, or `"any"`, each including
  the ones before it. The tier is the right granularity because the distinction that matters for a
  browser bundle is copyleft, not which permissive license a package chose - and because a
  per-license setting gets the common case wrong: a policy of "MIT" would reject Apache-2.0, which
  is both more restrictive than MIT and entirely ordinary to ship.
- **An explicit SPDX list as the fallback.** `["MIT", "ISC", "Apache-2.0"]` accepts exactly those
  and refuses everything else, for a project whose policy does not follow the tiers.
- **`permissive` is the default, so the gate is on with no configuration.** A project that has never
  heard of this key is still protected from accidentally vendoring AGPL code.
- **`imp install` fails before writing anything** - no bundle, no manifest, no `imp.json` entry. A
  package the project may not ship leaves no trace to clean up.
- **`imp build` re-checks every bundled dependency** and emits nothing on a violation. Install-time
  alone is not a gate: it misses a dependency added by someone else, a manifest edited by hand, and
  a policy tightened after the fact. The build is where the artifact is produced, so the build is
  where the guarantee has to hold.
- **SPDX expressions are evaluated, not string-matched.** `OR` resolves to its most permissive
  branch, because the consumer may take those terms; `AND` must satisfy every branch; a `WITH`
  exception is ignored in favour of the base license. `(BSD-3-Clause OR GPL-2.0)` therefore passes
  the permissive tier, which is correct and is a case a naive substring check gets wrong.
- **An unidentifiable license warns and never blocks.** `imp install` names the package; the build
  does not fail. This covers every JSR package, because JSR publishes no license identifier, and any
  npm package declaring none. Treating unknown as a violation would make `imp install jsr:...` fail
  out of the box, and would state a conclusion imp has not reached: imp does not block over what it
  merely failed to read, and does not pretend to have checked.

## Consequences

- The compliance question is answered when a dependency is introduced, by the person introducing it,
  rather than in an audit months later against code that is now load-bearing.
- The default rejects MPL, LGPL, GPL, AGPL and SSPL on install. That is intended, and widening it is
  one key edit - the error names the tier that would allow the package.
- imp is not a lawyer and the tiers are not legal advice. They encode the ordinary reading of these
  licenses for a bundled browser application; a project with real obligations should still have
  counsel confirm the policy it sets.
- The identifier tables live in the binary and will drift as licenses appear. An unrecognised
  identifier degrades to a warning rather than a false rejection, so drift costs coverage and never
  a spurious build failure.
- A project can defeat the gate by setting `"any"`. That is deliberate: imp states the risk clearly
  and leaves the decision with the team, rather than making itself impossible to use.
