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
  if (config.imports !== undefined) {
    throw new Error(
      "invalid imp.json — 'imports' has been replaced by 'dependencies'; run 'imp install <package>' to declare each dependency",
    )
  }
  for (const key of ['dependencies', 'fmt', 'lint']) {
    if (config[key] !== undefined && !isPlainObject(config[key])) {
      throw new Error(`invalid imp.json — '${key}' must be an object`)
    }
  }
  for (const [alias, specifier] of Object.entries(config.dependencies ?? {})) {
    if (typeof specifier !== 'string') {
      throw new Error(`invalid imp.json — dependency '${alias}' must be a string specifier`)
    }
  }
  return config
}
