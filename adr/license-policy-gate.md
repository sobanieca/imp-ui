# The license policy is a gate, not a report - `licenses` in imp.json

## Context

`vendored-dependency-manifest.md` records the SPDX identifier of every bundled package. That answers
the question "what do I ship, and under what terms?". But it answers it only for a person who opens
the manifest and reads it. The question that a team really needs answered is the one that blocks a
release: can we ship this at all?

That question matters for imp in particular. An imp app is a bundled, minified artifact that you
serve to a user. That is the distribution of a derived work. A copyleft dependency anywhere in the
graph can oblige the app to publish its own source. Nothing in the vendoring model makes that
visible. The bundle is opaque, the obligation is transitive, and a package that a colleague added
looks like any other diff.

A report that somebody reads afterwards is the wrong shape for this. By the time when anybody reads
it, the dependency is committed, imported, and holding weight. The check must run at the moment when
the dependency arrives.

## Decision

One key in `imp.json`, named `licenses`, states the terms that the project accepts. `imp install`
and `imp build` check that key. A violation is an error, and not a warning.

- **A tier is the default form.** The tiers are `"permissive"`, which is the default,
  `"weak-copyleft"` and `"any"`. Each one includes the tiers before it. A tier is the correct
  granularity. For a browser bundle, the distinction that matters is copyleft, and not which
  permissive licence a package chose. A setting per licence also gets the common case wrong. A
  policy of "MIT" would reject Apache-2.0, which is more restrictive than MIT, and completely
  ordinary to ship.
- **An explicit SPDX list is the other form.** `["MIT", "ISC", "Apache-2.0"]` accepts exactly those,
  and refuses everything else. It suits a project whose policy does not follow the tiers.
- **`permissive` is the default, so the gate works with no configuration.** A project that has never
  heard of this key is still protected from an accidental vendoring of AGPL code.
- **`imp install` fails before it writes anything.** There is no bundle, no manifest and no entry in
  `imp.json`. A package that the project must not ship leaves nothing to clean up.
- **`imp build` checks every bundled dependency again**, and emits nothing on a violation. A check
  at install time alone is not a gate. It misses a dependency that somebody else added, a manifest
  that somebody edited by hand, and a policy that somebody made stricter later. The build produces
  the artifact. So the build is where the guarantee must hold.
- **imp evaluates an SPDX expression. It does not match a string.** `OR` resolves to its most
  permissive branch, because the consumer can take those terms. `AND` must satisfy every branch. imp
  ignores a `WITH` exception, and uses the base licence. So `(BSD-3-Clause OR GPL-2.0)` passes the
  permissive tier. That is correct, and a simple check on a substring gets that case wrong.
- **A licence that imp cannot identify gives a warning, and never blocks.** `imp install` names the
  package, and the build does not fail. This covers every JSR package, because JSR publishes no
  licence identifier. It also covers an npm package that declares none. To treat an unknown licence
  as a violation would make `imp install jsr:...` fail with no setup. It would also state a
  conclusion that imp did not reach. imp does not block over something that it only failed to read,
  and it does not pretend that it checked.

## Consequences

- imp answers the compliance question when somebody introduces a dependency, and that person answers
  it. Nobody answers it in an audit months later, against code that now holds weight.
- The default rejects MPL, LGPL, GPL, AGPL and SSPL at install. That is intended. To widen the
  policy, edit one key. The error names the tier that would allow the package.
- imp is not a lawyer, and the tiers are not legal advice. They encode the ordinary reading of these
  licences, for a bundled browser application. A project with real obligations must still ask its
  counsel to confirm the policy that it sets.
- The tables of identifiers live in the binary, and they will fall behind as new licences appear. An
  identifier that imp does not recognize becomes a warning, and not a false rejection. So the drift
  costs coverage, and never a build failure that is wrong.
- A project can defeat the gate by setting `"any"`. That is deliberate. imp states the risk clearly,
  and leaves the decision with the team. It does not make itself impossible to use.
