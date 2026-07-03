import { join } from '@std/path'

async function readJson(path) {
  try {
    return JSON.parse(await Deno.readTextFile(path))
  } catch {
    return null
  }
}

export async function loadImpConfig(root) {
  return await readJson(join(root, 'imp.json')) ?? {}
}
