import { join } from '@std/path'
import { loadImpConfig } from './config.js'
import { bundleDependency, shutdownBundler } from './deps.js'
import { defaultAlias, EXACT_VERSION, parseSpecifier, VALID_ALIAS } from './specifiers.js'
import { logger } from './logger.js'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const JSR_REGISTRY = 'https://jsr.io'

async function latestVersion(scheme, name) {
  const url = scheme === 'npm'
    ? `${NPM_REGISTRY}/${name.replace('/', '%2F')}`
    : `${JSR_REGISTRY}/${name}/meta.json`
  const headers = scheme === 'npm' ? { accept: 'application/vnd.npm.install-v1+json' } : {}
  const response = await fetch(url, { headers })
  if (response.status === 404) {
    await response.body?.cancel()
    throw new Error(`package not found: ${scheme}:${name}`)
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`failed to resolve ${scheme}:${name} — registry responded ${response.status}`)
  }
  const metadata = await response.json()
  const latest = scheme === 'npm' ? metadata['dist-tags']?.latest : metadata.latest
  if (!latest) throw new Error(`failed to resolve ${scheme}:${name} — no latest version published`)
  return latest
}

const LARGE_DEPENDENCY_BYTES = 200 * 1024

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function installOne({ root, alias, scheme, name, version, subpath }) {
  const resolvedVersion = version ?? await latestVersion(scheme, name)
  const specifier = `${scheme}:${name}@${resolvedVersion}${subpath}`
  const { files, packages, impImports } = await bundleDependency({ specifier, alias })
  const totalSize = files.reduce((sum, file) => sum + file.contents.length, 0)
  if (totalSize > LARGE_DEPENDENCY_BYTES) {
    logger.warn(
      `${specifier} bundles to ${
        formatSize(totalSize)
      }, which will be committed into your git repository`,
    )
  }
  const folder = join(root, 'dependencies', alias)
  await Deno.remove(folder, { recursive: true }).catch(() => {})
  await Deno.mkdir(folder, { recursive: true })
  for (const file of files) await Deno.writeFile(join(folder, file.name), file.contents)
  console.log(`installed ${alias} (${specifier})`)
  for (const file of files) {
    console.log(`  dependencies/${alias}/${file.name} (${formatSize(file.contents.length)})`)
  }
  console.log('  bundled packages:')
  for (const bundled of packages) console.log(`    ${bundled}`)
  if (impImports.length) {
    console.log(
      `  imp imports kept bare (resolved by this app at runtime): ${impImports.join(', ')}`,
    )
    console.log(
      '    note: this package runs against the imp version this app provides, not the one it was built with',
    )
  }
  return specifier
}

const sortedByKey = (entries) =>
  Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))

async function writeImpConfig(root, config) {
  await Deno.writeTextFile(join(root, 'imp.json'), JSON.stringify(config, null, 2) + '\n')
}

function declaredTarget(alias, specifier, version) {
  const declared = parseSpecifier(specifier)
  if (!declared?.scheme) {
    throw new Error(`invalid specifier for dependency '${alias}' in imp.json: '${specifier}'`)
  }
  return { alias, scheme: declared.scheme, name: declared.name, version, subpath: declared.subpath }
}

function requestedTarget(packageArg, versionArg, aliasArg, dependencies) {
  const parsed = parseSpecifier(packageArg)
  if (!parsed) throw new Error(`invalid package specifier: '${packageArg}'`)
  const { scheme, name, subpath } = parsed
  if (parsed.version && versionArg) {
    throw new Error(`two versions given: '${parsed.version}' and '${versionArg}'`)
  }
  const version = parsed.version ?? versionArg ?? null
  if (version && !EXACT_VERSION.test(version)) {
    throw new Error(
      `'${version}' is not an exact version — give an exact version (e.g. 1.2.3) or omit it to resolve the latest`,
    )
  }
  if (!scheme && !subpath && !aliasArg && dependencies[name]) {
    return declaredTarget(name, dependencies[name], version)
  }
  if (scheme === 'jsr' && !name.startsWith('@')) {
    throw new Error(`jsr packages are scoped: 'jsr:@scope/name', got '${packageArg}'`)
  }
  const alias = aliasArg ?? defaultAlias(parsed)
  if (!VALID_ALIAS.test(alias)) throw new Error(`invalid dependency alias: '${alias}'`)
  if (alias === 'imp') {
    throw new Error(
      "'imp' is reserved for the imp library, which every app can already import — pick a different alias",
    )
  }
  return { alias, scheme: scheme ?? 'npm', name, version, subpath }
}

export async function install({ root, packageArg = null, versionArg = null, aliasArg = null }) {
  const config = await loadImpConfig(root)
  const dependencies = config.dependencies ?? {}
  const targets = []
  if (packageArg) {
    targets.push(requestedTarget(packageArg, versionArg, aliasArg, dependencies))
  } else {
    if (versionArg || aliasArg) throw new Error('a version or alias requires a package name')
    if (!Object.keys(dependencies).length) {
      console.log('nothing to install — no dependencies declared in imp.json')
      return
    }
    for (const [alias, specifier] of Object.entries(dependencies)) {
      targets.push(declaredTarget(alias, specifier, null))
    }
  }
  try {
    for (const target of targets) dependencies[target.alias] = await installOne({ root, ...target })
  } finally {
    await shutdownBundler()
  }
  config.dependencies = sortedByKey(dependencies)
  await writeImpConfig(root, config)
}

export async function uninstall({ root, alias = null }) {
  if (!alias) throw new Error('usage: imp uninstall <package>')
  const config = await loadImpConfig(root)
  const dependencies = config.dependencies ?? {}
  if (!dependencies[alias]) throw new Error(`'${alias}' is not a declared dependency in imp.json`)
  const specifier = dependencies[alias]
  delete dependencies[alias]
  if (Object.keys(dependencies).length) config.dependencies = sortedByKey(dependencies)
  else delete config.dependencies
  if (VALID_ALIAS.test(alias)) {
    await Deno.remove(join(root, 'dependencies', alias), { recursive: true }).catch(() => {})
  }
  await writeImpConfig(root, config)
  console.log(`uninstalled ${alias} (${specifier})`)
}
