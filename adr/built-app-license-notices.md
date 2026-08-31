# Built apps carry their own license notices - imp build writes LICENSES.txt

## Context

`third-party-attribution.md` settles what the imp _binary_ redistributes. It says nothing about the
other artifact imp produces: the `dist/` directory `imp build` hands a user to deploy. That output
is a redistribution too, of whatever the app imports - vendored packages from `dependencies/`, imp's
own library, and the app's own modules - and the same notice obligations apply to it. MIT and BSD
require the copyright and permission notice to accompany the code; Apache-2.0 requires the license
and any NOTICE.

Every bundling step in the CLI ran esbuild with `legalComments: 'none'`, which deletes exactly the
comments those licenses require to travel: the `/*! ... */`, `//!`, `@license` and `@preserve`
blocks a library uses to mark its notice. `imp install` stripped them out of the vendored bundle, so
by the time `imp build` ran there was nothing left to preserve even in principle. The result was a
deployable directory that omitted notices it was obligated to carry, with nothing in the output
hinting that anything had been dropped - a compliance failure the app author had no way to notice.

Attribution also cannot be a step the author performs. imp is the only party that knows which
modules survived tree-shaking and code splitting into which output file; a hand-maintained notice
file would be wrong the first time an import changed.

## Decision

The notice travels with the code, all the way to what a user downloads. Two changes make one chain:

- **`imp install` preserves notices in the vendored bundle** (`legalComments: 'inline'`), so a
  package's notice is still present in `dependencies/` for the build to find later. The bundle is
  committed, so the notice is visible in review as well.
- **`imp build` collects them into one `LICENSES.txt`.** The build runs esbuild with
  `legalComments: 'external'`, gathers the per-output legal files it emits, splits them into
  individual comment blocks, drops duplicates, and writes them - **verbatim, never reformatted,
  truncated or summarized** - into `LICENSES.txt` at the root of the output directory. Nothing
  configures this and nothing turns it off. They are one of two sources the file merges: the other
  is the SPDX identifier and license text recorded for every bundled package at vendor time
  (`vendored-dependency-manifest.md`), which is what covers a package carrying no header comment at
  all.
- **Every emitted script points at it.** Each `.js` output - entry bundles, lazily loaded chunks,
  and the inline module scripts re-inlined into the page - opens with
  `/*! Third-party license notices: /LICENSES.txt */`, prefixed by `IMP_BASEPATH` like any other
  root-absolute URL. A reader who lands on a minified bundle can get from there to the notices.
- **Nothing bundled, nothing written.** With no notice from either source, no file is produced and
  no reference comment is added, so a build that redistributes nothing does not pretend to.
- **The dev-time bundlers keep stripping.** `imp start`, `imp preview`, `imp test` and the mock
  bundler stay on `legalComments: 'none'` - their output is never distributed, and the noise buys
  nothing.

One aggregate file, not esbuild's per-output `*.LEGAL.txt` scatter: the notices are a legal artifact
a person reads and a deploy ships, and pinning them to hashed chunk names that change every build
makes them harder to read and easier to lose.

`LICENSES.txt` is disjoint from `imp licenses`, which prints `THIRD_PARTY_LICENSES.md` for the tools
compiled into the binary. Those tools are the toolchain and never reach a user; `LICENSES.txt`
covers only what the app actually serves. Neither file is derived from the other.

## Consequences

- A deployed imp app carries the attribution its dependencies require, without the author doing
  anything, and the set is exact because it is derived from the build graph rather than from a
  dependency list.
- Comment detection is esbuild's: a comment is legal if it is `/*! ... */`, `//!`, or contains
  `@license` or `@preserve`. A package whose header uses none of those markers contributes no
  comment block, which used to mean it contributed nothing at all; its license now arrives from the
  vendor-time manifest instead, read from the package's own `LICENSE` file while `imp install` still
  has the package rather than the bundle.
- Vendored bundles and built output grow by the size of the notices they carry. This counts toward
  the `maxFileSize` warning on `dependencies/`; it is a few hundred bytes against a limit in the
  hundreds of kilobytes.
- Deleting `LICENSES.txt` from a deploy re-breaks compliance. imp puts it in the output and says so
  in the docs and skills; it cannot enforce what happens after upload.
