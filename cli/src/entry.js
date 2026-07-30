import { basename, dirname, join, resolve } from '@std/path'
import { publicDirectory } from './config.js'

async function isFile(path) {
  try {
    return (await Deno.stat(path)).isFile
  } catch {
    return false
  }
}

export async function publicCopyOfEntry(root, entryName) {
  const path = join(publicDirectory(root), entryName)
  return await isFile(path) ? path : null
}

const MISSING_MESSAGE_INDENT = ' '.repeat('[ERROR] '.length)

const inPublicFolderHint = (entryName) =>
  `${MISSING_MESSAGE_INDENT}public/${entryName} exists — move it to the project root: ` +
  `public/ ships verbatim, while the entry page is the one imp bundles, injects environment ` +
  `values into and adds PWA tags to`

export async function resolveEntryPath(entry, { expected }) {
  const entryPath = resolve(entry)
  let entryStat
  try {
    entryStat = await Deno.stat(entryPath)
  } catch {
    const entryName = basename(entryPath)
    const publicCopy = await publicCopyOfEntry(dirname(entryPath), entryName)
    throw new Error(
      publicCopy
        ? `file not found: ${entryPath}\n${inPublicFolderHint(entryName)}`
        : `file not found: ${entryPath}`,
    )
  }
  if (entryStat.isDirectory) {
    throw new Error(`expected ${expected}, got a directory: ${entry}`)
  }
  return entryPath
}
