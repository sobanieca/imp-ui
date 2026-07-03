import * as esbuild from 'esbuild'
import { denoPlugins } from '@luca/esbuild-deno-loader'

const DEP_PREFIX = '/@dep/'
const DEPENDENCY_SCHEMES = /^(npm:|jsr:)/

export const isDependencySpecifier = (specifier) => DEPENDENCY_SCHEMES.test(specifier)

export const dependencyUrl = (specifier) => DEP_PREFIX + encodeURIComponent(specifier)

export const isDependencyRequest = (pathname) => pathname.startsWith(DEP_PREFIX)

export const specifierFromRequest = (pathname) =>
  decodeURIComponent(pathname.slice(DEP_PREFIX.length))

const cache = new Map()
const inflight = new Map()

export async function bundleDependency(specifier) {
  if (cache.has(specifier)) return cache.get(specifier)
  if (inflight.has(specifier)) return inflight.get(specifier)

  const job = (async () => {
    const result = await esbuild.build({
      plugins: denoPlugins(),
      entryPoints: [specifier],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      legalComments: 'none',
      write: false,
    })
    const code = result.outputFiles[0].text
    cache.set(specifier, code)
    return code
  })()

  inflight.set(specifier, job)
  try {
    return await job
  } finally {
    inflight.delete(specifier)
  }
}

const STATIC_DEPENDENCY_IMPORT =
  /(\bfrom\s*|\bimport\s*|\bexport\s+[^;'"]*?\bfrom\s*)(['"])(npm:|jsr:)([^'"]+)\2/g
const DYNAMIC_DEPENDENCY_IMPORT = /(\bimport\(\s*)(['"])(npm:|jsr:)([^'"]+)\2(\s*\))/g

export function rewriteDependencySpecifiers(code) {
  return code
    .replace(
      STATIC_DEPENDENCY_IMPORT,
      (_match, keyword, quote, scheme, rest) =>
        `${keyword}${quote}${dependencyUrl(scheme + rest)}${quote}`,
    )
    .replace(
      DYNAMIC_DEPENDENCY_IMPORT,
      (_match, open, quote, scheme, rest, close) =>
        `${open}${quote}${dependencyUrl(scheme + rest)}${quote}${close}`,
    )
}

export async function shutdownDependencies() {
  await esbuild.stop()
}
