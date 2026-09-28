const SIDECAR_SUFFIXES = ['.map', '.LEGAL.txt']

export const namesSameFile = (absolutePath, metafilePath) => {
  const path = absolutePath.replaceAll('\\', '/')
  return path === metafilePath || path.endsWith(`/${metafilePath}`)
}

const reachableFrom = (roots, outputs) => {
  const reached = new Set()
  const pending = [...roots]
  while (pending.length > 0) {
    const path = pending.pop()
    if (reached.has(path)) continue
    reached.add(path)
    for (const imported of outputs[path].imports ?? []) {
      if (!imported.external && outputs[imported.path]) pending.push(imported.path)
    }
  }
  return reached
}

const referencedOutputs = (outputs) =>
  new Set(
    Object.values(outputs).flatMap((output) =>
      (output.imports ?? []).filter((imported) => !imported.external).map(({ path }) => path)
    ),
  )

export function unreachableOutputs(metafile, entryFiles) {
  const outputs = metafile.outputs
  const roots = Object.keys(outputs).filter((path) =>
    entryFiles.some((entry) => namesSameFile(entry, path))
  )
  const reached = reachableFrom(roots, outputs)
  const referenced = referencedOutputs(outputs)
  const dropped = Object.keys(outputs).filter((path) =>
    !reached.has(path) && (path.endsWith('.js') || referenced.has(path))
  )
  return dropped.flatMap((path) => [path, ...SIDECAR_SUFFIXES.map((suffix) => path + suffix)])
}

export function withoutUnreachableChunks(result, entryFiles) {
  const dropped = unreachableOutputs(result.metafile, entryFiles)
  if (dropped.length === 0) return result
  const isDropped = (path) => dropped.some((unreachable) => namesSameFile(path, unreachable))
  return {
    ...result,
    outputFiles: result.outputFiles.filter((file) => !isDropped(file.path)),
    metafile: {
      ...result.metafile,
      outputs: Object.fromEntries(
        Object.entries(result.metafile.outputs).filter(([path]) => !dropped.includes(path)),
      ),
    },
  }
}
