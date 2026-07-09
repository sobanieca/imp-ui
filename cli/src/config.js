import { dirname, join } from '@std/path'
import { applyEdits, modify, parse as parseJsonc, printParseErrorCode } from './vendor/jsonc.js'

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const CONFIG_FILENAMES = ['imp.json', 'imp.jsonc']

const FORMATTING_OPTIONS = { insertSpaces: true, tabSize: 2, eol: '\n' }

async function pathExists(path) {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

export async function findConfigFile(startDir) {
  let dir = startDir
  while (true) {
    for (const name of CONFIG_FILENAMES) {
      const path = join(dir, name)
      if (await pathExists(path)) return { dir, path, name }
    }
    if (await pathExists(join(dir, '.git'))) return null
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export async function projectRoot(startDir) {
  return (await findConfigFile(startDir))?.dir ?? startDir
}

export async function configTargetPath(startDir) {
  return (await findConfigFile(startDir))?.path ?? join(startDir, 'imp.json')
}

export function parseConfigText(text, name = 'imp.json') {
  const errors = []
  const config = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false })
  if (errors.length) {
    const { error, offset } = errors[0]
    throw new Error(`invalid ${name} — ${printParseErrorCode(error)} at position ${offset}`)
  }
  return config
}

export function tryParseConfig(text) {
  return parseJsonc(text, [], { allowTrailingComma: true, disallowComments: false })
}

export async function updateConfigFile(path, changes) {
  let text
  try {
    text = await Deno.readTextFile(path)
  } catch {
    text = '{}\n'
  }
  for (const { path: keyPath, value, getInsertionIndex } of changes) {
    const options = getInsertionIndex
      ? { formattingOptions: FORMATTING_OPTIONS, getInsertionIndex }
      : { formattingOptions: FORMATTING_OPTIONS }
    text = applyEdits(text, modify(text, keyPath, value, options))
  }
  if (!text.endsWith('\n')) text += '\n'
  await Deno.writeTextFile(path, text)
}

export async function loadImpConfig(startDir) {
  const found = await findConfigFile(startDir)
  if (!found) return {}
  let text
  try {
    text = await Deno.readTextFile(found.path)
  } catch {
    return {}
  }
  const name = found.name
  const config = parseConfigText(text, name)
  if (!isPlainObject(config)) {
    throw new Error(`invalid ${name} — expected a JSON object at the top level`)
  }
  if (config.imports !== undefined) {
    throw new Error(
      `invalid ${name} — 'imports' has been replaced by 'dependencies'; run 'imp install <package>' to declare each dependency`,
    )
  }
  for (const key of ['dependencies', 'fmt', 'lint', 'test', 'pwa', 'environments']) {
    if (config[key] !== undefined && !isPlainObject(config[key])) {
      throw new Error(`invalid ${name} — '${key}' must be an object`)
    }
  }
  for (const [alias, path] of Object.entries(config.environments ?? {})) {
    if (typeof path !== 'string') {
      throw new Error(`invalid ${name} — environment '${alias}' must be a string path`)
    }
  }
  if (config.pwa !== undefined) {
    for (
      const key of [
        'name',
        'shortName',
        'themeColor',
        'backgroundColor',
        'icon',
        'startUrl',
        'scope',
      ]
    ) {
      if (config.pwa[key] !== undefined && typeof config.pwa[key] !== 'string') {
        throw new Error(`invalid ${name} — 'pwa.${key}' must be a string`)
      }
    }
    const displays = ['standalone', 'fullscreen', 'minimal-ui', 'browser']
    if (config.pwa.display !== undefined && !displays.includes(config.pwa.display)) {
      throw new Error(`invalid ${name} — 'pwa.display' must be one of ${displays.join(', ')}`)
    }
  }
  for (const key of ['entry', 'browser']) {
    if (config.test?.[key] !== undefined && typeof config.test[key] !== 'string') {
      throw new Error(`invalid ${name} — 'test.${key}' must be a string`)
    }
  }
  if (
    config.test?.exclude !== undefined &&
    (!Array.isArray(config.test.exclude) ||
      config.test.exclude.some((entry) => typeof entry !== 'string'))
  ) {
    throw new Error(`invalid ${name} — 'test.exclude' must be an array of strings`)
  }
  if (config.test?.video !== undefined) {
    if (!isPlainObject(config.test.video)) {
      throw new Error(`invalid ${name} — 'test.video' must be an object`)
    }
    if (config.test.video.enable !== undefined && typeof config.test.video.enable !== 'boolean') {
      throw new Error(`invalid ${name} — 'test.video.enable' must be true or false`)
    }
    for (const key of ['fps', 'maxDuration', 'width', 'quality']) {
      const value = config.test.video[key]
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new Error(`invalid ${name} — 'test.video.${key}' must be a positive number`)
      }
    }
  }
  for (const [alias, specifier] of Object.entries(config.dependencies ?? {})) {
    if (alias === 'imp') {
      throw new Error(
        `invalid ${name} — 'imp' is reserved for the imp library and cannot be a dependency alias`,
      )
    }
    if (typeof specifier !== 'string') {
      throw new Error(`invalid ${name} — dependency '${alias}' must be a string specifier`)
    }
  }
  if (config.version !== undefined && typeof config.version !== 'string') {
    throw new Error(
      `invalid ${name} — 'version' must be a string (an exact imp version, e.g. '1.2.3')`,
    )
  }
  if (config.targetImpHost !== undefined && typeof config.targetImpHost !== 'boolean') {
    throw new Error(`invalid ${name} — 'targetImpHost' must be true or false`)
  }
  if (
    config.maxFileSize !== undefined &&
    (!Number.isFinite(config.maxFileSize) || config.maxFileSize <= 0)
  ) {
    throw new Error(`invalid ${name} — 'maxFileSize' must be a positive number`)
  }
  if (
    config.maxFileSizeIgnore !== undefined &&
    (!Array.isArray(config.maxFileSizeIgnore) ||
      config.maxFileSizeIgnore.some((entry) => typeof entry !== 'string'))
  ) {
    throw new Error(`invalid ${name} — 'maxFileSizeIgnore' must be an array of strings`)
  }
  if (
    config.maxLogEntries !== undefined &&
    (!Number.isInteger(config.maxLogEntries) || config.maxLogEntries <= 0)
  ) {
    throw new Error(`invalid ${name} — 'maxLogEntries' must be a positive integer`)
  }
  return config
}
