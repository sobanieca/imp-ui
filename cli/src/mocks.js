import { isAbsolute, join, relative, SEPARATOR, toFileUrl } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { runEsbuild } from './deps.js'
import { DATAURL_ASSET_LOADERS, impResolverPlugin } from './bundling.js'

const MOCK_FILE_SUFFIX = '.mock.js'

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', '.imp'])

const ENTRY_NAMESPACE = 'imp-mocks-entry'

async function findMockFiles(directory) {
  const found = []
  const walk = async (current) => {
    for await (const entry of Deno.readDir(current)) {
      const path = join(current, entry.name)
      if (entry.isDirectory) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(path)
      } else if (entry.isFile && entry.name.endsWith(MOCK_FILE_SUFFIX)) {
        found.push(path)
      }
    }
  }
  await walk(directory)
  found.sort()
  return found
}

const asPosix = (path) => path.replaceAll('\\', '/')

function entrySource(files, root) {
  const imported = (index) => `mockFile${index}`
  const lines = files.map((file, index) =>
    `import * as ${imported(index)} from ${JSON.stringify(toFileUrl(file).href)}`
  )
  lines.push(
    `const collect = (module, file) => {`,
    `  const declared = module.mocks ?? module.default`,
    `  if (!Array.isArray(declared)) {`,
    '    self.__impMockProblem(file + " must export \'mocks\' — an array of { match, handler }")',
    `    return []`,
    `  }`,
    `  return declared.flatMap((entry, index) => {`,
    '    const source = file + " #" + (index + 1)',
    `    if (typeof entry?.match !== 'function' || typeof entry?.handler !== 'function') {`,
    `      self.__impMockProblem(source + ' must be { match, handler }, both functions')`,
    `      return []`,
    `    }`,
    `    return [{ match: entry.match, handler: entry.handler, delay: entry.delay ?? 0, source }]`,
    `  })`,
    `}`,
    `self.__impMocks = [${
      files.map((file, index) =>
        `...collect(${imported(index)}, ${JSON.stringify(asPosix(relative(root, file)))})`
      ).join(', ')
    }]`,
  )
  return lines.join('\n')
}

function mocksEntryPlugin({ contents, root }) {
  return {
    name: 'imp-mocks-entry',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${ENTRY_NAMESPACE}$`) }, () => ({
        path: ENTRY_NAMESPACE,
        namespace: ENTRY_NAMESPACE,
      }))
      build.onLoad({ filter: /.*/, namespace: ENTRY_NAMESPACE }, () => ({
        contents,
        loader: 'js',
        resolveDir: root,
      }))
    },
  }
}

async function bundleMockFiles(files, { root, dependencies = {} } = {}) {
  const result = await runEsbuild({
    plugins: [
      mocksEntryPlugin({ contents: entrySource(files, root), root }),
      impResolverPlugin({ root, dependencies }),
      denoPlugin(),
    ],
    entryPoints: [ENTRY_NAMESPACE],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    write: false,
    outdir: '/imp-mocks',
    loader: DATAURL_ASSET_LOADERS,
  })
  return result.outputFiles[0].text
}

const locate = (file, root) => {
  for (const candidate of [file, SEPARATOR + file]) {
    if (isAbsolute(candidate)) return asPosix(relative(root, candidate))
  }
  return asPosix(file)
}

function describeProblem(error, root) {
  const reported = error?.errors?.map((issue) => {
    const file = issue.location?.file
    const where = file ? `${locate(file, root)}:${issue.location.line} — ` : ''
    return `${where}${issue.text}`
  })
  return reported?.length ? reported.join('; ') : (error?.message ?? String(error))
}

export function createMockBundler({ root, directory, dependencies = {} }) {
  let cache = null
  const currentState = async () => {
    let files
    try {
      files = await findMockFiles(directory)
    } catch {
      return {
        key: 'missing',
        files: [],
        source: '',
        problem: `${asPosix(relative(root, directory))}/ does not exist`,
      }
    }
    const stamps = await Promise.all(files.map(async (file) => {
      const { mtime, size } = await Deno.stat(file)
      return `${file}:${mtime?.getTime() ?? 0}:${size}`
    }))
    const key = stamps.join('|')
    if (cache?.key === key) return cache
    if (!files.length) return { key, files, source: '', problem: null }
    try {
      return {
        key,
        files,
        source: await bundleMockFiles(files, { root, dependencies }),
        problem: null,
      }
    } catch (error) {
      return { key: `${key}!`, files, source: '', problem: describeProblem(error, root) }
    }
  }
  return async () => {
    const state = await currentState()
    const changed = cache?.key !== state.key
    cache = state
    return { ...state, changed }
  }
}
