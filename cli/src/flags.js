import { extractCalls, parseStringLiteral, splitFirstArgument } from './bundling.js'
import { scriptSafeJson } from './environments.js'

const FLAG_EXPORT = 'flag'

function flagValue(name, value) {
  if (value === undefined) return false
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(
    `flag '${name}' must be true or false in the selected environment, not ${
      JSON.stringify(value)
    }`,
  )
}

export function splitEnvAndFlags({ config, env }) {
  const declared = config.flags ?? []
  const values = { ...env }
  const flags = {}
  for (const name of declared) {
    flags[name] = flagValue(name, env[name])
    delete values[name]
  }
  return { env: values, flags }
}

export function flagsInjectionScript(flags) {
  if (!flags || Object.keys(flags).length === 0) return ''
  return `<script>globalThis.__IMP_FLAGS__ = ${scriptSafeJson(flags)}</script>`
}

const IMP_NAMED_IMPORT = /^[ \t]*import\s*\{([^}]*)\}\s*from\s*(['"])imp\2/gm

function localFlagName(source) {
  for (const [, clause] of source.matchAll(IMP_NAMED_IMPORT)) {
    for (const specifier of clause.split(',')) {
      const [imported, local] = specifier.trim().split(/\s+as\s+/)
      if (imported === FLAG_EXPORT) return (local ?? imported).trim()
    }
  }
  return null
}

const unknownFlagProblem = (name, flags) => {
  const declared = Object.keys(flags)
  return `unknown flag '${name}' - ${
    declared.length
      ? `declare it in imp.json's 'flags'; declared flags: ${declared.join(', ')}`
      : "imp.json declares no 'flags'"
  }`
}

export function foldFlagCalls(source, { flags, file }) {
  const local = localFlagName(source)
  if (!local) return source
  const calls = extractCalls(source, local)
  if (!calls.length) return source
  let folded = ''
  let lastIndex = 0
  for (const call of calls) {
    const { first, rest } = splitFirstArgument(call.argumentSource)
    const name = parseStringLiteral(first)
    if (name === null || rest !== '') {
      throw new Error(
        `${file} - ${local}() takes one string literal flag name, so the build can fold it away: ${local}('CHECKOUT_V2')`,
      )
    }
    if (!Object.hasOwn(flags, name)) throw new Error(`${file} - ${unknownFlagProblem(name, flags)}`)
    folded += source.slice(lastIndex, call.start) + String(flags[name])
    lastIndex = call.end
  }
  return folded + source.slice(lastIndex)
}
