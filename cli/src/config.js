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
  for (const key of ['dependencies', 'fmt', 'lint', 'test']) {
    if (config[key] !== undefined && !isPlainObject(config[key])) {
      throw new Error(`invalid imp.json — '${key}' must be an object`)
    }
  }
  for (const key of ['entry', 'browser']) {
    if (config.test?.[key] !== undefined && typeof config.test[key] !== 'string') {
      throw new Error(`invalid imp.json — 'test.${key}' must be a string`)
    }
  }
  if (
    config.test?.exclude !== undefined &&
    (!Array.isArray(config.test.exclude) ||
      config.test.exclude.some((entry) => typeof entry !== 'string'))
  ) {
    throw new Error("invalid imp.json — 'test.exclude' must be an array of strings")
  }
  for (const [alias, specifier] of Object.entries(config.dependencies ?? {})) {
    if (alias === 'imp') {
      throw new Error(
        "invalid imp.json — 'imp' is reserved for the imp library and cannot be a dependency alias",
      )
    }
    if (typeof specifier !== 'string') {
      throw new Error(`invalid imp.json — dependency '${alias}' must be a string specifier`)
    }
  }
  if (config.targetImpHost !== undefined && typeof config.targetImpHost !== 'boolean') {
    throw new Error("invalid imp.json — 'targetImpHost' must be true or false")
  }
  return config
}
