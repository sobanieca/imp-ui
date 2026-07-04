export const DEPENDENCY_SCHEME = /^(npm|jsr):/

export const EXACT_VERSION = /^\d+\.\d+\.\d+([-+][\w.-]+)?$/

const SPECIFIER_SHAPE = /^(@[^/@]+\/[^/@]+|[^/@]+)(?:@([^/]+))?(\/.*)?$/

export function parseSpecifier(input) {
  if (typeof input !== 'string') return null
  const scheme = input.match(DEPENDENCY_SCHEME)?.[1] ?? null
  const rest = scheme ? input.slice(scheme.length + 1) : input
  const match = rest.match(SPECIFIER_SHAPE)
  if (!match) return null
  return { scheme, name: match[1], version: match[2] ?? null, subpath: match[3] ?? '' }
}

const withoutExtension = (segment) => segment.replace(/\.[^.]+$/, '')

export function defaultAlias({ name, subpath }) {
  if (subpath) return withoutExtension(subpath.split('/').at(-1))
  return name.split('/').at(-1)
}

export const VALID_ALIAS = /^[A-Za-z0-9._-]+$/
