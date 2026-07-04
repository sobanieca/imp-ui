import { join } from '@std/path'

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export async function loadImpConfig(root) {
  let text
  try {
    text = await Deno.readTextFile(join(root, 'imp.json'))
  } catch {
    return {}
  }
  let config
  try {
    config = JSON.parse(text)
  } catch (error) {
    throw new Error(`invalid imp.json — ${error.message}`)
  }
  if (!isPlainObject(config)) {
    throw new Error('invalid imp.json — expected a JSON object at the top level')
  }
  for (const key of ['imports', 'fmt', 'lint']) {
    if (config[key] !== undefined && !isPlainObject(config[key])) {
      throw new Error(`invalid imp.json — '${key}' must be an object`)
    }
  }
  return config
}
