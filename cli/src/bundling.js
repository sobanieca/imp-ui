import { dirname, extname, isAbsolute, join, resolve, toFileUrl } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { DATAURL_ASSET_LOADERS, runEsbuild } from './deps.js'
import {
  IMP_MODULES,
  IMP_TOOLING_MODULES,
  impSubpathProblem,
  impToolingOnlyProblem,
  isImpToolingSubpath,
} from './specifiers.js'

const IMP_LIBRARY_ROOT = import.meta.resolve('../../lib/src/')

export const impModuleUrl = (specifier) => new URL(IMP_MODULES[specifier], IMP_LIBRARY_ROOT).href

export const LIBRARY_NAMESPACE = 'imp-library'
const MOCK_NAMESPACE = 'imp-mock'

const MODULE_EXTENSIONS = ['.js', '.mjs']

export const isIdentChar = (char) => /[\w$]/.test(char ?? '')

export function skipStringLiteral(source, index) {
  const quote = source[index]
  index++
  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (quote === '`' && char === '$' && source[index + 1] === '{') {
      index += 2
      let depth = 1
      while (index < source.length && depth > 0) {
        const inner = source[index]
        if (inner === '{') depth++
        else if (inner === '}') depth--
        else if (inner === '"' || inner === "'" || inner === '`') {
          index = skipStringLiteral(source, index)
          continue
        }
        index++
      }
      continue
    }
    if (char === quote) return index + 1
    index++
  }
  return source.length
}

function scanForFirstTopLevelComma(source) {
  let depth = 0
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char)) depth--
    else if (char === ',' && depth === 0) return index
    index++
  }
  return -1
}

export function splitFirstArgument(argumentSource) {
  const comma = scanForFirstTopLevelComma(argumentSource)
  if (comma === -1) return { first: argumentSource, rest: '' }
  return { first: argumentSource.slice(0, comma), rest: argumentSource.slice(comma + 1).trim() }
}

export function parseStringLiteral(text) {
  const trimmed = text.trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'" || quote === '`') && trimmed.endsWith(quote)) {
    try {
      return JSON.parse(`"${trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return null
}

function parseCallArguments(source, parenIndex) {
  let index = parenIndex + 1
  let depth = 0
  const start = index
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if ('([{'.includes(char)) {
      depth++
      index++
      continue
    }
    if (')]}'.includes(char)) {
      if (depth === 0 && char === ')') {
        return { argumentSource: source.slice(start, index), end: index + 1 }
      }
      depth--
      index++
      continue
    }
    index++
  }
  return null
}

export function extractCalls(source, functionName) {
  const calls = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if (isIdentChar(char) && !isIdentChar(source[index - 1])) {
      let end = index
      while (end < source.length && isIdentChar(source[end])) end++
      if (source.slice(index, end) === functionName) {
        let cursor = end
        while (cursor < source.length && /\s/.test(source[cursor])) cursor++
        if (source[cursor] === '(') {
          const call = parseCallArguments(source, cursor)
          if (call) {
            calls.push({ ...call, start: index })
            index = call.end
            continue
          }
        }
      }
      index = end
      continue
    }
    index++
  }
  return calls
}

function extractMockModuleCalls(source) {
  return extractCalls(source, 'mockModule').map(({ argumentSource }) => {
    const { first, rest } = splitFirstArgument(argumentSource)
    const specifier = parseStringLiteral(first)
    if (specifier === null) {
      throw new Error('mockModule(specifier, …) - specifier must be a string literal')
    }
    return { specifier, factorySource: rest }
  })
}

export async function resolveModuleFile(candidate) {
  const attempts = [candidate]
  if (!extname(candidate)) {
    for (const extension of MODULE_EXTENSIONS) attempts.push(candidate + extension)
    for (const extension of MODULE_EXTENSIONS) attempts.push(join(candidate, `index${extension}`))
  }
  for (const attempt of attempts) {
    try {
      const info = await Deno.stat(attempt)
      if (info.isFile) return await Deno.realPath(attempt)
    } catch { /* try the next candidate */ }
  }
  return null
}

async function resolveMockTarget(specifier, { mockingFile, root, dependencies }) {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    const realFile = await resolveModuleFile(resolve(dirname(mockingFile), specifier))
    if (!realFile) throw new Error(`mockModule('${specifier}') - module not found`)
    return { id: realFile, realFile }
  }
  if (!Object.hasOwn(dependencies, specifier)) {
    throw new Error(
      `mockModule('${specifier}') - not a relative module or a dependency declared in imp.json`,
    )
  }
  const realFile = await resolveModuleFile(join(root, 'dependencies', specifier, `${specifier}.js`))
  if (!realFile) {
    throw new Error(
      `mockModule('${specifier}') - dependency '${specifier}' is not vendored; run 'imp install'`,
    )
  }
  return { id: specifier, realFile }
}

async function discoverModuleExports(realFile, { root, dependencies }) {
  const result = await runEsbuild({
    plugins: [impResolverPlugin({ root, dependencies }), denoPlugin()],
    entryPoints: [toFileUrl(realFile).href],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    metafile: true,
    logLevel: 'silent',
    outdir: '/imp-mock',
    loader: DATAURL_ASSET_LOADERS,
  })
  const output = Object.values(result.metafile.outputs).find((entry) => entry.entryPoint)
  const names = output?.exports ?? []
  return {
    named: names.filter((name) => name !== 'default'),
    hasDefault: names.includes('default'),
  }
}

function generateMockModule(mock) {
  const usesOrig = mock.factorySource ? /\borig\b/.test(mock.factorySource) : false
  const lines = ["import { spy as __spy } from 'imp/test'"]
  if (usesOrig) {
    lines.push(`import * as __real from ${JSON.stringify(toFileUrl(mock.realFile).href)}`)
  }
  const helpers = usesOrig ? '{ spy: __spy, orig: () => __real }' : '{ spy: __spy }'
  if (mock.factorySource) {
    lines.push(`const __exports = (${mock.factorySource})(${helpers})`)
  } else {
    lines.push('const __exports = {}')
  }
  lines.push(
    'const __pick = (name) => (__exports != null && name in __exports) ? __exports[name] : __spy()',
  )
  for (const name of mock.named) {
    lines.push(`export const ${name} = __pick(${JSON.stringify(name)})`)
  }
  if (mock.hasDefault) lines.push("export default __pick('default')")
  return `${lines.join('\n')}\n`
}

export async function collectMocks(file, { root, dependencies }) {
  const calls = extractMockModuleCalls(await Deno.readTextFile(file))
  const mocks = new Map()
  for (const { specifier, factorySource } of calls) {
    const target = await resolveMockTarget(specifier, { mockingFile: file, root, dependencies })
    if (mocks.has(target.id)) {
      throw new Error(`mockModule('${specifier}') - this module is mocked more than once`)
    }
    const exports = await discoverModuleExports(target.realFile, { root, dependencies })
    mocks.set(target.id, { ...target, factorySource: factorySource || null, ...exports })
  }
  return mocks
}

const libraryModule = (url) => ({ path: url, namespace: LIBRARY_NAMESPACE })

export function resolveImpLibrary(build, { tooling }) {
  build.onResolve({ filter: /^imp(\/|$)/ }, ({ path }) => {
    if (Object.hasOwn(IMP_MODULES, path)) return libraryModule(impModuleUrl(path))
    if (isImpToolingSubpath(path)) {
      return tooling
        ? libraryModule(IMP_TOOLING_MODULES[path].url)
        : { errors: [{ text: impToolingOnlyProblem(path) }] }
    }
    return { errors: [{ text: impSubpathProblem(path) }] }
  })
  build.onResolve(
    { filter: /.*/, namespace: LIBRARY_NAMESPACE },
    (args) => libraryModule(new URL(args.path, args.importer).href),
  )
  build.onLoad({ filter: /.*/, namespace: LIBRARY_NAMESPACE }, async (args) => ({
    contents: await Deno.readTextFile(new URL(args.path)),
    loader: 'js',
  }))
}

const escapeForRegExp = (text) => text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

export function resolveDependencyAliases(build, { root, dependencies }) {
  const aliases = Object.keys(dependencies)
  if (!aliases.length) return
  const aliasFilter = new RegExp(`^(${aliases.map(escapeForRegExp).join('|')})$`)
  build.onResolve({ filter: aliasFilter }, async ({ path: alias }) => {
    const path = join(root, 'dependencies', alias, `${alias}.js`)
    try {
      await Deno.stat(path)
    } catch {
      throw new Error(`dependency '${alias}' is declared but not vendored - run 'imp install'`)
    }
    return { path }
  })
}

export function impResolverPlugin({ root, dependencies, mocks }) {
  return {
    name: 'imp-resolver',
    setup(build) {
      if (mocks?.size) {
        build.onResolve({ filter: /.*/ }, async (args) => {
          if (args.namespace && args.namespace !== 'file') return
          if (mocks.has(args.path)) return { path: args.path, namespace: MOCK_NAMESPACE }
          if (args.path.startsWith('.') || isAbsolute(args.path)) {
            const realFile = await resolveModuleFile(resolve(args.resolveDir, args.path))
            if (realFile && mocks.has(realFile)) {
              return { path: realFile, namespace: MOCK_NAMESPACE }
            }
          }
        })
        build.onLoad({ filter: /.*/, namespace: MOCK_NAMESPACE }, (args) => ({
          contents: generateMockModule(mocks.get(args.path)),
          loader: 'js',
          resolveDir: root,
        }))
      }
      resolveImpLibrary(build, { tooling: true })
      resolveDependencyAliases(build, { root, dependencies })
    },
  }
}
