# Built apps carry their own license notices - imp build writes LICENSES.txt

## Context

`third-party-attribution.md` settles what the imp _binary_ redistributes. It says nothing about the
other artifact that imp produces, which is the `dist/` directory that `imp build` gives a user to
deploy. That output is a redistribution too. It redistributes whatever the app imports: a vendored
package from `dependencies/`, the library of imp, and the modules of the app. The same obligations
of a notice apply to it. MIT and BSD require the copyright notice and the permission notice to
travel with the code. Apache-2.0 requires the licence, and any NOTICE file.

Every bundling step in the CLI ran esbuild with `legalComments: 'none'`. That option deletes exactly
the comments that those licences require to travel. Those are the `/*! ... */`, `//!`, `@license`
and `@preserve` blocks that a library uses to mark its notice. `imp install` removed them from the
vendored bundle. So by the time when `imp build` ran, there was nothing left to keep, even in
principle. The result was a directory ready to deploy, and it left out a notice that it had to
carry. Nothing in the output showed that imp had dropped anything. That was a compliance failure
that the author of the app had no way to see.

Attribution also cannot be a step that the author performs. imp is the only party that knows which
modules survived the tree-shaking and the code splitting, and which output file holds them. A file
of notices that a person maintains by hand would be wrong the first time when an import changed.

## Decision

The notice travels with the code, to what a user downloads. Two changes make one chain:

- **`imp install` keeps a notice in the vendored bundle**, through `legalComments: 'inline'`. So the
  notice of a package is still in `dependencies/`, and the build finds it later. You commit the
  bundle. So a reviewer sees the notice as well.
- **`imp build` collects the notices into one `LICENSES.txt`.** The build runs esbuild with
  `legalComments: 'external'`. It gathers the legal file that esbuild emits per output. It splits
  that file into blocks, one per comment, and drops a duplicate. It writes the blocks into
  `LICENSES.txt`, at the root of the output directory, **exactly as they are. imp never reformats,
  cuts or summarizes them.** Nothing configures this, and nothing turns it off. Those comments are
  one of the sources that the file merges. Another source is the SPDX identifier and the licence
  text that imp recorded for every bundled package at vendor time, see
  `vendored-dependency-manifest.md`. That source covers a package that carries no header comment.
- **Every script with bundled code points at the file.** Each `.js` output of the bundler starts
  with `/*! Third-party license notices: /LICENSES.txt */`. That covers an entry bundle, a chunk
  that loads lazily, and the file of an inline module script. The environment values and the
  registration of the service worker hold no third-party code, so they carry no reference. imp puts
  `IMP_BASEPATH` in front of that path, like any other root-absolute URL. So a reader who arrives at
  a minified bundle can go from there to the notices.
- **The notice of imp travels too.** The imp library is MIT, and every app bundles the parts of it
  that the app uses. When the metafile of the build holds a module of the imp library, the file
  starts with the `LICENSE` of imp, under the heading of the library. The binary includes that
  `LICENSE`. An app under `targetImpHost` bundles no imp code, so its file leaves the notice out.
- **When imp bundles no notice, it writes none.** With no notice from any source, imp produces no
  file and adds no reference comment. So a build that redistributes nothing does not pretend that it
  does.
- **The export of the gallery carries the same file.** `imp preview --output` writes a folder that a
  site serves, so it is a redistribution too. It collects the notices in the same way, and writes
  `LICENSES.txt` at the root of the folder. Its folder can live under any path of a site, so each
  script points at the file with a relative path.
- **The bundlers for development still remove the comments.** `imp start`, the preview server,
  `imp test` and the mock bundler stay on `legalComments: 'none'`. Their output never goes to a
  user, and the noise buys nothing.

imp writes one aggregate file. It does not scatter the `*.LEGAL.txt` files that esbuild emits per
output. The notices are a legal artifact. A person reads them, and a deploy ships them. To tie them
to a hashed chunk name that changes on every build makes them harder to read, and easier to lose.

`LICENSES.txt` is separate from `imp licenses`. That command prints `THIRD-PARTY-LICENSES.md`, for
the tools that imp compiles into the binary. Those tools are the toolchain, and they never reach a
user. `LICENSES.txt` covers only what the app serves. Neither file derives from the other.

## Consequences

- A deployed imp app carries the attribution that imp and its dependencies require, and the author
  does nothing. Almost every build now writes `LICENSES.txt`, because almost every app bundles imp.
  The set is exact, because imp derives it from the build graph, and not from a list of
  dependencies.
- The detection of a comment is the detection of esbuild. A comment is legal when it is
  `/*! ... */`, or `//!`, or when it contains `@license` or `@preserve`. A package whose header uses
  none of those markers contributes no comment block. Its licence arrives from the manifest that imp
  writes at vendor time instead. imp reads that licence from the `LICENSE` file of the package,
  while `imp install` still holds the package and not only the bundle.
- A vendored bundle, and the built output, grow by the size of the notices that they carry. That
  counts toward the `maxFileSize` warning on `dependencies/`. It is a few hundred bytes against a
  limit of hundreds of kilobytes.
- To delete `LICENSES.txt` from a deploy breaks the compliance again. imp puts the file in the
  output, and says so in the documentation and in the skills. imp cannot enforce what happens after
  an upload.
