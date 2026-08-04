import { join, relative, resolve, SEPARATOR } from '@std/path'

const ALWAYS_SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', '.imp'])

const VENDORED_DEPENDENCIES = 'dependencies'

export const isSkippedPath = (path) =>
  path.split(/[/\\]/).some((segment) => ALWAYS_SKIPPED_DIRECTORIES.has(segment))

const extensionOf = (name) => {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export async function collectFiles({ root, paths, extensions, exclude = [] }) {
  const files = []

  const excluded = (path) => {
    const relativePath = relative(root, path)
    const segments = relativePath.split(SEPARATOR)
    if (segments.some((segment) => ALWAYS_SKIPPED_DIRECTORIES.has(segment))) return true
    if (segments[0] === VENDORED_DEPENDENCIES) return true
    return exclude.some((entry) => {
      const prefix = entry.replace(/\/+$/, '')
      return relativePath === prefix || relativePath.startsWith(prefix + SEPARATOR)
    })
  }

  const walkDirectory = async (directory) => {
    for await (const entry of Deno.readDir(directory)) {
      const path = join(directory, entry.name)
      if (excluded(path)) continue
      if (entry.isDirectory) await walkDirectory(path)
      else if (entry.isFile && extensions.has(extensionOf(entry.name))) files.push(path)
    }
  }

  for (const target of paths.length ? paths : ['.']) {
    const path = resolve(root, target)
    let info
    try {
      info = await Deno.stat(path)
    } catch {
      throw new Error(`path not found: ${target}`)
    }
    if (info.isDirectory) await walkDirectory(path)
    else if (extensions.has(extensionOf(path))) files.push(path)
  }

  files.sort()
  return files
}
