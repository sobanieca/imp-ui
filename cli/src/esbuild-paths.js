import { join as joinPosix } from '@std/path/posix'

const DRIVE_PATH = /^(?:\\\\\?\\)?([A-Za-z]):[\\/]/
const UNC_PATH = /^(?:\\\\\?\\UNC\\|\\\\|\/\/(?=[^/]))/
const ESBUILD_DRIVE_PATH = /^\/([A-Za-z]):(?:\/|$)/
const ESBUILD_UNC_PREFIX = '/UNC/'

const withForwardSlashes = (path) => path.replaceAll('\\', '/')

const withBackslashes = (path) => path.replaceAll('/', '\\')

export function toEsbuildPath(path, os) {
  if (os !== 'windows' || typeof path !== 'string') return path
  const drive = path.match(DRIVE_PATH)
  if (drive) return `/${drive[1]}:/${withForwardSlashes(path.slice(drive[0].length))}`
  const unc = path.match(UNC_PATH)
  if (unc) return `${ESBUILD_UNC_PREFIX}${withForwardSlashes(path.slice(unc[0].length))}`
  return path
}

export function fromEsbuildPath(path, os) {
  if (os !== 'windows' || typeof path !== 'string') return path
  const drive = path.match(ESBUILD_DRIVE_PATH)
  if (drive) return `${drive[1]}:\\${withBackslashes(path.slice(drive[0].length))}`
  if (path.startsWith(ESBUILD_UNC_PREFIX)) {
    return `\\\\${withBackslashes(path.slice(ESBUILD_UNC_PREFIX.length))}`
  }
  return path
}

const isNamespacedKey = (key) => /^[^/]*:/.test(key)

const isFileNamespace = (namespace) => namespace === undefined || namespace === 'file'

const mapEntryPoints = (entryPoints, map) => {
  if (Array.isArray(entryPoints)) {
    return entryPoints.map((entry) =>
      typeof entry === 'string' ? map(entry) : { ...entry, in: map(entry.in) }
    )
  }
  if (entryPoints && typeof entryPoints === 'object') {
    return Object.fromEntries(Object.entries(entryPoints).map(([out, path]) => [out, map(path)]))
  }
  return entryPoints
}

function wrapPlugin(plugin, os) {
  const toEsbuild = (path) => toEsbuildPath(path, os)
  const fromEsbuild = (path) => fromEsbuildPath(path, os)
  const nativeResolveArgs = (args) => ({
    ...args,
    path: args.kind === 'entry-point' ? fromEsbuild(args.path) : args.path,
    importer: fromEsbuild(args.importer),
    resolveDir: fromEsbuild(args.resolveDir),
  })
  const esbuildResolveResult = (result) =>
    result && typeof result.path === 'string' && !result.external &&
      isFileNamespace(result.namespace)
      ? { ...result, path: toEsbuild(result.path) }
      : result
  const esbuildLoadResult = (result) =>
    result && typeof result.resolveDir === 'string'
      ? { ...result, resolveDir: toEsbuild(result.resolveDir) }
      : result
  return {
    ...plugin,
    setup(build) {
      return plugin.setup({
        ...build,
        onResolve: (options, callback) =>
          build.onResolve(
            options,
            async (args) => esbuildResolveResult(await callback(nativeResolveArgs(args))),
          ),
        onLoad: (options, callback) =>
          build.onLoad(options, async (args) =>
            esbuildLoadResult(
              await callback(
                args.namespace === 'file' ? { ...args, path: fromEsbuild(args.path) } : args,
              ),
            )),
        resolve: async (path, options = {}) => {
          const result = await build.resolve(path, {
            ...options,
            importer: toEsbuild(options.importer),
            resolveDir: toEsbuild(options.resolveDir),
          })
          return result.namespace === 'file'
            ? { ...result, path: fromEsbuild(result.path) }
            : result
        },
      })
    },
  }
}

export function esbuildOptions(options, { os, cwd }) {
  const toEsbuild = (path) => toEsbuildPath(path, os)
  const translated = {
    ...options,
    absWorkingDir: toEsbuild(options.absWorkingDir ?? cwd),
    entryPoints: mapEntryPoints(options.entryPoints, toEsbuild),
    plugins: (options.plugins ?? []).map((plugin) => wrapPlugin(plugin, os)),
  }
  for (const key of ['outdir', 'outfile', 'outbase']) {
    if (options[key] !== undefined) translated[key] = toEsbuild(options[key])
  }
  if (options.inject) translated.inject = options.inject.map(toEsbuild)
  if (options.stdin?.resolveDir) {
    translated.stdin = { ...options.stdin, resolveDir: toEsbuild(options.stdin.resolveDir) }
  }
  return translated
}

function nativeMetafile(metafile, absoluteOf) {
  const importsOf = (imports) =>
    imports?.map((imported) =>
      imported.external ? imported : { ...imported, path: absoluteOf(imported.path) }
    )
  const keyed = (record, map) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [absoluteOf(key), map(value)]))
  return {
    ...metafile,
    inputs: keyed(metafile.inputs, (input) => ({ ...input, imports: importsOf(input.imports) })),
    outputs: keyed(metafile.outputs, (output) => ({
      ...output,
      imports: importsOf(output.imports),
      inputs: keyed(output.inputs ?? {}, (input) => input),
      ...(output.entryPoint ? { entryPoint: absoluteOf(output.entryPoint) } : {}),
      ...(output.cssBundle ? { cssBundle: absoluteOf(output.cssBundle) } : {}),
    })),
  }
}

const nativeOutputFile = (file, fromEsbuild) => ({
  path: fromEsbuild(file.path),
  contents: file.contents,
  get text() {
    return file.text
  },
  get hash() {
    return file.hash
  },
})

export function nativeResult(result, { os, absWorkingDir }) {
  const fromEsbuild = (path) => fromEsbuildPath(path, os)
  const absoluteOf = (key) =>
    isNamespacedKey(key) ? key : fromEsbuild(joinPosix(absWorkingDir, key))
  return {
    ...result,
    ...(result.outputFiles
      ? { outputFiles: result.outputFiles.map((file) => nativeOutputFile(file, fromEsbuild)) }
      : {}),
    ...(result.metafile ? { metafile: nativeMetafile(result.metafile, absoluteOf) } : {}),
  }
}
