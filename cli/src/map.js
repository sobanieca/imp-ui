import { relative, resolve, toFileUrl } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig, projectRoot } from './config.js'
import { DATAURL_ASSET_LOADERS, runEsbuild, shutdownBundler } from './deps.js'
import { impResolverPlugin } from './bundling.js'
import { bold, dim } from './colors.js'
import { posixPath } from './walk.js'

const MAP = Symbol.for('imp.appMap')

const INDENT = '  '

async function bundleMapFile(file, { root, dependencies }) {
  const result = await runEsbuild({
    plugins: [impResolverPlugin({ root, dependencies, mocks: null }), denoPlugin()],
    entryPoints: [toFileUrl(file).href],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    write: false,
    outdir: '/imp-map',
    loader: DATAURL_ASSET_LOADERS,
  })
  return result.outputFiles[0].text
}

const importCode = (code) => import(`data:text/javascript;base64,${encodeBase64(code)}`)

const labelOf = (node) => {
  if (typeof node.label === 'string') return node.label
  if (typeof node.label === 'function') {
    try {
      return String(node.label({ params: {}, option: undefined }))
    } catch {
      return node.defaultLabel
    }
  }
  return node.defaultLabel
}

const describeAccess = (node) =>
  node.access === undefined ? '' : `access: ${JSON.stringify(node.access)}`

const describeNav = (node) => {
  const notes = []
  if (node.nav === false) notes.push('hidden from the nav')
  if (node.group !== undefined) notes.push(`group '${node.group}'`)
  return notes.join(', ')
}

function rows(node, depth, into) {
  for (const child of node.children) {
    const notes = [describeAccess(child), describeNav(child)].filter(Boolean).join(' | ')
    into.push({
      depth,
      location: child.pattern,
      label: labelOf(child),
      notes,
      description: child.description ?? '',
    })
    rows(child, depth + 1, into)
  }
  return into
}

const describeProps = (props) => {
  const notes = [describeAccess(props), describeNav(props)].filter(Boolean)
  if (props.description !== undefined) notes.push(props.description)
  return notes.length === 0 ? '' : ` ${dim(`- a part of another map: ${notes.join(' | ')}`)}`
}

const renderMap = (name, internals) => {
  const lines = []
  lines.push(`${bold(name)}${describeProps(internals.props)}`)
  const table = rows(internals.root, 1, [])
  if (table.length === 0) {
    lines.push(`${INDENT}${dim('(no nodes)')}`)
    return lines.join('\n')
  }
  const width = Math.max(...table.map((row) => row.depth * INDENT.length + row.location.length))
  for (const row of table) {
    const head = `${INDENT.repeat(row.depth)}${row.location}`.padEnd(width + 2)
    const notes = row.notes === '' ? '' : `  ${dim(row.notes)}`
    lines.push(`${head}${row.label}${notes}`)
    if (row.description !== '') {
      lines.push(`${INDENT.repeat(row.depth + 1)}${dim(row.description)}`)
    }
  }
  return lines.join('\n')
}

export async function loadMaps(target, { root, dependencies }) {
  const { installDomEnvironment } = await import('./test-dom.js')
  const restore = installDomEnvironment()
  let module
  try {
    module = await importCode(await bundleMapFile(target, { root, dependencies }))
  } finally {
    await restore()
  }
  return Object.entries(module).filter(([, value]) => value?.[MAP] !== undefined)
}

export const routePatternsOf = (maps) => {
  const patterns = new Set()
  for (const [, map] of maps) {
    const internals = map[MAP]
    if (internals.graftedInto !== null) continue
    for (const node of internals.nodes) patterns.add(node.pattern)
  }
  return [...patterns].sort()
}

export async function printMap({ cwd, file = null }) {
  const root = await projectRoot(cwd)
  const config = await loadImpConfig(root)
  if (file === null && config.map === undefined) {
    throw new Error(
      'imp.json has no \'map\' - add "map": "src/app-map.js", the file that exports appMap(), or pass a file: imp map src/admin/map.js',
    )
  }
  const target = resolve(file === null ? root : cwd, file ?? config.map)
  try {
    await Deno.stat(target)
  } catch {
    throw new Error(
      `no map at ${
        posixPath(relative(cwd, target) || target)
      } - imp map reads the file that exports appMap(), ${
        file === null ? "the 'map' of imp.json" : 'the file you pass'
      }`,
    )
  }
  let maps
  try {
    maps = await loadMaps(target, { root, dependencies: config.dependencies ?? {} })
  } finally {
    await shutdownBundler()
  }
  if (maps.length === 0) {
    throw new Error(
      `${
        posixPath(relative(cwd, target))
      } exports no map - export the value of appMap(), like export const app = appMap({ ... })`,
    )
  }
  console.log(maps.map(([name, map]) => renderMap(name, map[MAP])).join('\n\n'))
}
