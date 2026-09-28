# Release policy - no guarantees before 1.0, semantic versioning from 1.0

## Context

imp pins its version per project, see `version-pinning-self-delegation.md`. A pin is worth something
only when the pinned version has written guarantees. A team that adopts imp for a production app
must know when an update can break the app, and how much warning it gets. The platforms that imp
supports decide who can adopt it at all, see `binary-distribution.md`.

Before 1.0, imp has no users to protect. The rule of the repository is that a better design replaces
the old one in full, with no compatibility layer. That rule keeps the design clean while it still
changes. It must end at a stated point, or no team can depend on imp.

## Decision

**Before 1.0.0, imp gives no stability guarantee.** Any release can rename or remove an export, a
config key, a command or an output format. The docs say that imp is not released yet.

**From 1.0.0, imp follows semantic versioning.**

- **A breaking change goes into a new major version only.** A breaking change is a change that can
  make a correct app, its tests or its build fail. That covers the removal or the rename of an
  export, a prop, a config key, a command or a flag, and a changed default that changes the output
  of an app.
- **A deprecation warns for at least one minor version before the removal.** The deprecated form
  keeps its behaviour, and imp prints a warning through the logger, and in `imp lint` when a rule
  can see it. The warning names the replacement.
- **A minor version adds a feature. A patch version fixes a defect.** Neither one needs a change in
  an app.
- **The output of a command is stable for the parts that a script reads.** An exit code, a file that
  imp writes, and a machine format such as `--json` follow the same rules as the API. The wording of
  a message for a person is not an API.
- **Windows is a target before 1.0.** CI builds, tests and releases a Windows binary, see
  `binary-distribution.md`. A team does not have to exclude its Windows developers.

## Consequences

- A team can pin a 1.x version and update within the major version with no change to its app.
- The rule of the repository against a compatibility shim ends at 1.0. From then on, a breaking
  change carries a cost: a deprecation period, and a major version.
- Until 1.0, an update of the pin can break an app. The docs say so, and a pin keeps the break under
  the control of the team.
