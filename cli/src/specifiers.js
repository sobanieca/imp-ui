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

export const IMP_SUBPATH_MODULES = {
  'imp/html': 'api/html.js',
  'imp/state': 'api/state.js',
  'imp/router': 'api/router.js',
  'imp/theme': 'api/theme.js',
  'imp/i18n': 'api/i18n.js',
  'imp/log': 'api/log.js',
  'imp/std': 'std/index.js',
  'imp/std/display': 'std/display/index.js',
}

const knownImpSubpaths = () => [
  "'imp'",
  ...Object.keys(IMP_SUBPATH_MODULES).map((subpath) => `'${subpath}'`),
  "'imp/test'",
  "'imp/preview'",
]

export const isImpSubpath = (specifier) => Object.hasOwn(IMP_SUBPATH_MODULES, specifier)

export const impSubpathProblem = (specifier) =>
  `'${specifier}' is not part of the imp library — import ${knownImpSubpaths().join(', ')}`
