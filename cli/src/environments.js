import { basename, resolve } from '@std/path'

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const SHELL_REFERENCE = /^\$env\.(.+)$/

const DEFAULT_ALIAS = 'default'

function isDotenvFile(filePath) {
  const base = basename(filePath)
  return base.endsWith('.env') || base.startsWith('.env.')
}

function stripUnquotedComment(value) {
  const comment = value.indexOf(' #')
  return comment === -1 ? value : value.slice(0, comment).trimEnd()
}

function unquoteDotenvValue(value) {
  const quote = value[0]
  if ((quote === '"' || quote === "'") && value.length >= 2 && value.at(-1) === quote) {
    const inner = value.slice(1, -1)
    return quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\"/g, '"') : inner
  }
  return stripUnquotedComment(value)
}

function parseDotenv(text) {
  const values = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const assignment = line.startsWith('export ') ? line.slice(7).trimStart() : line
    const separator = assignment.indexOf('=')
    if (separator === -1) continue
    const key = assignment.slice(0, separator).trim()
    if (key === '') continue
    values[key] = unquoteDotenvValue(assignment.slice(separator + 1).trim())
  }
  return values
}

function resolveValues(alias, filePath, raw) {
  if (!isPlainObject(raw)) {
    throw new Error(`environment '${alias}' - ${filePath} must be a flat JSON object of values`)
  }
  const resolved = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      const reference = value.match(SHELL_REFERENCE)
      if (reference) {
        const variable = reference[1]
        const fromShell = Deno.env.get(variable)
        if (fromShell === undefined) {
          throw new Error(
            `environment '${alias}' - key '${key}' references shell variable '${variable}', which is not set`,
          )
        }
        resolved[key] = fromShell
      } else {
        resolved[key] = value
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      resolved[key] = value
    } else {
      throw new Error(
        `environment '${alias}' - key '${key}' must be a string, number, or boolean`,
      )
    }
  }
  return resolved
}

function selectAlias(requestedAlias, environments) {
  if (requestedAlias) return requestedAlias
  const fromShell = Deno.env.get('IMP_ENV')
  if (fromShell) return fromShell
  if (Object.hasOwn(environments, DEFAULT_ALIAS)) return DEFAULT_ALIAS
  return null
}

export async function resolveEnvironment({ root, config, requestedAlias = null }) {
  const environments = config.environments ?? {}
  const alias = selectAlias(requestedAlias, environments)
  if (alias === null) return {}
  const filePath = environments[alias]
  if (filePath === undefined) {
    const defined = Object.keys(environments)
    const list = defined.length ? defined.join(', ') : '(none defined in imp.json)'
    throw new Error(`unknown environment '${alias}' - defined environments: ${list}`)
  }
  let text
  try {
    text = await Deno.readTextFile(resolve(root, filePath))
  } catch {
    throw new Error(`environment '${alias}' - file not found: ${filePath}`)
  }
  let raw
  if (isDotenvFile(filePath)) {
    raw = parseDotenv(text)
  } else {
    try {
      raw = JSON.parse(text)
    } catch (error) {
      throw new Error(`environment '${alias}' - invalid JSON in ${filePath}: ${error.message}`)
    }
  }
  return resolveValues(alias, filePath, raw)
}

export function envInjectionScript(env) {
  if (!env || Object.keys(env).length === 0) return ''
  return `<script>globalThis.__IMP_ENV__ = ${JSON.stringify(env)}</script>`
}
