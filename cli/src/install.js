import { join } from '@std/path'
import { configTargetPath, licensePolicy, loadImpConfig, updateConfigFile } from './config.js'
import { bundleDependency, packageId, shutdownBundler } from './deps.js'
import { verifyPackages } from './integrity.js'
import {
  DEPENDENCY_MANIFEST_FILE,
  dependencyManifest,
  manifestFileContents,
  recordPackageLicenses,
  unlicensedPackages,
} from './dependency-manifest.js'
import { licenseViolationProblem, reviewLicenses, unknownLicenseWarning } from './license-policy.js'
import { defaultAlias, EXACT_VERSION, parseSpecifier, VALID_ALIAS } from './specifiers.js'
import { formatSize, isFileSizeIgnored, maxFileBytes, maxFileSizeHint } from './file-size.js'
import { logger } from './logger.js'
import { LICENSE_NOTICES_FILE } from './license-notices.js'

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
    throw new Error(`failed to resolve ${scheme}:${name} - registry responded ${response.status}`)
  }
  const metadata = await response.json()
  const latest = scheme === 'npm' ? metadata['dist-tags']?.latest : metadata.latest
  if (!latest) throw new Error(`failed to resolve ${scheme}:${name} - no latest version published`)
  return latest
}

async function prepareOne({ alias, scheme, name, version, subpath, policy }) {
  const resolvedVersion = version ?? await latestVersion(scheme, name)
  const specifier = `${scheme}:${name}@${resolvedVersion}${subpath}`
  const { files, packages, impImports } = await bundleDependency({ specifier, alias })
  const manifest = dependencyManifest({
    alias,
    specifier,
    packages: await recordPackageLicenses(await verifyPackages(packages)),
    impImports,
  })
  const { violations, unknown } = reviewLicenses([manifest], policy)
  if (violations.length) throw new Error(licenseViolationProblem(violations, policy))
  return { alias, specifier, files, manifest, unknown, impImports }
}

function warnAboutSize({ maxBytes, ignore }, { alias, specifier, files }) {
  const countedSize = files
    .filter((file) => !isFileSizeIgnored(join('dependencies', alias, file.name), ignore))
    .reduce((sum, file) => sum + file.contents.length, 0)
  if (countedSize > maxBytes) {
    logger.warn(
      `${specifier} bundles to ${
        formatSize(countedSize)
      }, which will be committed into your git repository - ${maxFileSizeHint}`,
    )
  }
}

function reportInstalled({ alias, specifier, files, manifest, unknown, impImports }) {
  console.log(`installed ${alias} (${specifier})`)
  for (const file of files) {
    console.log(`  dependencies/${alias}/${file.name} (${formatSize(file.contents.length)})`)
  }
  console.log(`  dependencies/${alias}/${DEPENDENCY_MANIFEST_FILE} (packages, versions, licenses)`)
  console.log('  bundled packages:')
  for (const entry of manifest.packages) {
    const attestation = entry.attestationListed ? ', attestation listed by the registry' : ''
    console.log(
      `    ${packageId(entry)} - ${entry.license ?? 'license not declared'}${attestation}`,
    )
  }
  const checked = manifest.packages.filter((entry) => entry.integrity).length
  if (checked) {
    console.log(
      `  integrity: ${checked} npm package${
        checked === 1 ? '' : 's'
      } checked against the signed hash of the npm registry`,
    )
  }
  const undeclared = unlicensedPackages(manifest)
  if (undeclared.length) {
    logger.warn(
      `no license text found for ${
        undeclared.join(', ')
      } - ${LICENSE_NOTICES_FILE} will not carry a notice for ${
        undeclared.length === 1 ? 'it' : 'them'
      }`,
    )
  }
  if (unknown.length) logger.warn(unknownLicenseWarning(unknown))
  if (impImports.length) {
    console.log(
      `  imp imports kept bare (resolved by this app at runtime): ${impImports.join(', ')}`,
    )
    console.log(
      '    note: this package runs against the imp version this app provides, not the one it was built with',
    )
  }
}

export const projectFileSystem = {
  writeFile: (path, bytes) => Deno.writeFile(path, bytes),
  rename: (from, to) => Deno.rename(from, to),
  updateConfig: (path, changes) => updateConfigFile(path, changes),
}

const pathExists = (path) => Deno.lstat(path).then(() => true, () => false)

async function stage(folder, { files, manifest }, fileSystem) {
  await Deno.mkdir(folder, { recursive: true })
  for (const file of files) await fileSystem.writeFile(join(folder, file.name), file.contents)
  await fileSystem.writeFile(
    join(folder, DEPENDENCY_MANIFEST_FILE),
    new TextEncoder().encode(manifestFileContents(manifest)),
  )
}

async function rollBack({ swaps, configPath, configBefore, configTouched, createdFolder }) {
  const problems = []
  const attempt = (action, step) =>
    action().catch((error) => problems.push(`${step}: ${error.message}`))
  for (const swap of [...swaps].reverse()) {
    if (swap.placed) {
      await attempt(() => Deno.remove(swap.target, { recursive: true }), `remove ${swap.target}`)
    }
    if (swap.movedAside) {
      await attempt(() => Deno.rename(swap.aside, swap.target), `restore ${swap.target}`)
    }
  }
  if (configTouched) {
    await attempt(
      () =>
        configBefore === null
          ? Deno.remove(configPath)
          : Deno.writeTextFile(configPath, configBefore),
      `restore ${configPath}`,
    )
  }
  if (createdFolder) await Deno.remove(createdFolder).catch(() => {})
  return problems
}

export async function commitDependencies(
  { root, dependencies, configChanges, fileSystem = projectFileSystem },
) {
  const dependenciesFolder = join(root, 'dependencies')
  const workFolder = join(root, '.imp')
  const createdWorkFolder = !await pathExists(workFolder)
  const createdFolder = await pathExists(dependenciesFolder) ? null : dependenciesFolder
  const staging = join(workFolder, `install-${crypto.randomUUID()}`)
  const configPath = await configTargetPath(root)
  const configBefore = await Deno.readTextFile(configPath).catch(() => null)
  const swaps = []
  let configTouched = false
  let keepStaging = false
  try {
    for (const dependency of dependencies) {
      await stage(join(staging, 'new', dependency.alias), dependency, fileSystem)
    }
    await Deno.mkdir(join(staging, 'old'), { recursive: true })
    await Deno.mkdir(dependenciesFolder, { recursive: true })
    for (const { alias } of dependencies) {
      const swap = {
        target: join(dependenciesFolder, alias),
        aside: join(staging, 'old', alias),
        movedAside: false,
        placed: false,
      }
      swaps.push(swap)
      if (await pathExists(swap.target)) {
        await fileSystem.rename(swap.target, swap.aside)
        swap.movedAside = true
      }
      await fileSystem.rename(join(staging, 'new', alias), swap.target)
      swap.placed = true
    }
    configTouched = true
    await fileSystem.updateConfig(configPath, configChanges)
  } catch (error) {
    const problems = await rollBack({
      swaps,
      configPath,
      configBefore,
      configTouched,
      createdFolder,
    })
    if (problems.length) {
      keepStaging = true
      throw new Error(
        `${error.message} - and the rollback failed (${
          problems.join('; ')
        }); the previous versions are in ${join(staging, 'old')}`,
      )
    }
    throw new Error(`${error.message} - nothing was installed`)
  } finally {
    if (!keepStaging) {
      await Deno.remove(staging, { recursive: true }).catch(() => {})
      if (createdWorkFolder) await Deno.remove(workFolder).catch(() => {})
    }
  }
}

const alphabeticalInsertionIndex = (alias) => (keys) => {
  const index = keys.findIndex((key) => key.localeCompare(alias) > 0)
  return index === -1 ? keys.length : index
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
      `'${version}' is not an exact version - give an exact version (e.g. 1.2.3) or omit it to resolve the latest`,
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
      "'imp' is reserved for the imp library, which every app can already import - pick a different alias",
    )
  }
  return { alias, scheme: scheme ?? 'npm', name, version, subpath }
}

export async function install({ root, packageArg = null, versionArg = null, aliasArg = null }) {
  const config = await loadImpConfig(root)
  const dependencies = config.dependencies ?? {}
  const maxBytes = maxFileBytes(config)
  const policy = licensePolicy(config)
  const ignore = config.maxFileSizeIgnore ?? []
  const targets = []
  if (packageArg) {
    targets.push(requestedTarget(packageArg, versionArg, aliasArg, dependencies))
  } else {
    if (versionArg || aliasArg) throw new Error('a version or alias requires a package name')
    if (!Object.keys(dependencies).length) {
      console.log('nothing to install - no dependencies declared in imp.json')
      return
    }
    for (const [alias, specifier] of Object.entries(dependencies)) {
      targets.push(declaredTarget(alias, specifier, null))
    }
  }
  const prepared = []
  try {
    for (const target of targets) prepared.push(await prepareOne({ policy, ...target }))
  } finally {
    await shutdownBundler()
  }
  for (const dependency of prepared) warnAboutSize({ maxBytes, ignore }, dependency)
  await commitDependencies({
    root,
    dependencies: prepared,
    configChanges: prepared.map(({ alias, specifier }) => ({
      path: ['dependencies', alias],
      value: specifier,
      getInsertionIndex: alphabeticalInsertionIndex(alias),
    })),
  })
  for (const dependency of prepared) reportInstalled(dependency)
}

export async function uninstall({ root, alias = null }) {
  if (!alias) throw new Error('usage: imp uninstall <package>')
  const config = await loadImpConfig(root)
  const dependencies = config.dependencies ?? {}
  if (!dependencies[alias]) throw new Error(`'${alias}' is not a declared dependency in imp.json`)
  const specifier = dependencies[alias]
  delete dependencies[alias]
  if (VALID_ALIAS.test(alias)) {
    await Deno.remove(join(root, 'dependencies', alias), { recursive: true }).catch(() => {})
  }
  const change = Object.keys(dependencies).length
    ? { path: ['dependencies', alias], value: undefined }
    : { path: ['dependencies'], value: undefined }
  await updateConfigFile(await configTargetPath(root), [change])
  console.log(`uninstalled ${alias} (${specifier})`)
}
