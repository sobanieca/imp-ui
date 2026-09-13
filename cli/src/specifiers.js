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

export const IMP_MODULES = {
  'imp': 'imp.js',
  'imp/html': 'api/html.js',
  'imp/state': 'api/state.js',
  'imp/router': 'api/router.js',
  'imp/theme': 'api/theme.js',
  'imp/i18n': 'api/i18n.js',
  'imp/log': 'api/log.js',
  'imp/http': 'api/http.js',
  'imp/icons': 'api/icons.js',
  'imp/service-worker': 'api/service-worker.js',
  'imp/std': 'std/index.js',
  'imp/std/layout': 'std/layout/index.js',
  'imp/std/display': 'std/display/index.js',
  'imp/std/inputs': 'std/inputs/index.js',
  'imp/std/navigation': 'std/navigation/index.js',
  'imp/std/shell': 'std/shell/index.js',
  'imp/std/feedback': 'std/feedback/index.js',
}

export const isImpStdSpecifier = (specifier) =>
  specifier === 'imp/std' || specifier.startsWith('imp/std/')

export const IMP_TOOLING_MODULES = {
  'imp/test': { url: new URL('./test-library.js', import.meta.url).href, resolvedBy: 'imp test' },
  'imp/preview': {
    url: new URL('./preview-library.js', import.meta.url).href,
    resolvedBy: 'imp preview',
  },
}

export const isImpToolingSubpath = (specifier) => Object.hasOwn(IMP_TOOLING_MODULES, specifier)

export const isImpSpecifier = (specifier) =>
  Object.hasOwn(IMP_MODULES, specifier) || isImpToolingSubpath(specifier)

const knownImpSpecifiers = () =>
  [...Object.keys(IMP_MODULES), ...Object.keys(IMP_TOOLING_MODULES)]
    .map((specifier) => `'${specifier}'`)

export const impSubpathProblem = (specifier) =>
  `'${specifier}' is not part of the imp library - import ${knownImpSpecifiers().join(', ')}`

export const impToolingOnlyProblem = (specifier) =>
  `'${specifier}' is only resolved by ${
    IMP_TOOLING_MODULES[specifier].resolvedBy
  } - it cannot be bundled into an app`
