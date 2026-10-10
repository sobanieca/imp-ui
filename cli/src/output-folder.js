import { join, normalize, relative, SEPARATOR } from '@std/path'
import { projectRoot, publicDirectory } from './config.js'

export const OUTPUT_MARKER = '.imp-output'

const OUTPUT_MARKER_TEXT =
  'imp wrote this folder. imp deletes the folder and writes it again on each build.\n'

const isWithin = (parent, path) => {
  const folder = normalize(parent)
  const target = normalize(path)
  return target === folder ||
    target.startsWith(folder.endsWith(SEPARATOR) ? folder : folder + SEPARATOR)
}

const shown = (path) => relative(Deno.cwd(), path).replaceAll('\\', '/') || '.'

async function folderEntries(path) {
  const names = []
  for await (const entry of Deno.readDir(path)) names.push(entry.name)
  return names
}

async function assertReplaceable(outdir, output) {
  let stat
  try {
    stat = await Deno.stat(outdir)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return
    throw error
  }
  if (!stat.isDirectory) {
    throw new Error(`the output folder is a file: ${output} - pick a folder for the output`)
  }
  const names = await folderEntries(outdir)
  if (names.length === 0 || names.includes(OUTPUT_MARKER)) return
  throw new Error(
    `the output folder ${output} holds files that imp did not write - imp deletes the output folder before it writes into it, so pick a new or empty folder, or delete ${output} yourself`,
  )
}

export async function assertOutputFolder(
  outdir,
  { output, root, sources = [], insidePublic = false },
) {
  if (isWithin(outdir, root) || isWithin(outdir, await projectRoot(root))) {
    throw new Error(`the output folder must not be the project or contain it: ${output}`)
  }
  const publicDir = publicDirectory(root)
  if (isWithin(outdir, publicDir)) {
    throw new Error(`the output folder must not be public/ or contain it: ${output}`)
  }
  if (!insidePublic && isWithin(publicDir, outdir)) {
    throw new Error(
      `the output folder must not be inside public/, because imp copies public/ into it: ${output}`,
    )
  }
  const source = sources.find((path) => isWithin(outdir, path))
  if (source) {
    throw new Error(
      `the output folder must not contain a source of the project: ${output} holds ${
        shown(source)
      }`,
    )
  }
  await assertReplaceable(outdir, output)
}

export async function replaceOutputFolder(outdir) {
  await Deno.remove(outdir, { recursive: true }).catch((error) => {
    if (!(error instanceof Deno.errors.NotFound)) throw error
  })
  await Deno.mkdir(outdir, { recursive: true })
  await Deno.writeTextFile(join(outdir, OUTPUT_MARKER), OUTPUT_MARKER_TEXT)
}
