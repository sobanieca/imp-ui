import { dirname, fromFileUrl, join } from '@std/path'

const CLI_DIR = dirname(fromFileUrl(import.meta.url))
const LINT_PLUGIN = join(CLI_DIR, 'lint_plugin.js')

const DEFAULT_FMT = {
  semiColons: false,
  singleQuote: true,
  lineWidth: 100,
}

async function readJson(path) {
  try {
    return JSON.parse(await Deno.readTextFile(path))
  } catch {
    return null
  }
}

export async function loadImpConfig(root) {
  return await readJson(join(root, 'imp.json')) ?? {}
}

export async function prepareConfig(root) {
  const imp = await loadImpConfig(root)
  const generatedDir = join(root, '.imp')
  const configPath = join(generatedDir, 'deno.json')

  const denoConfig = {
    imports: imp.imports ?? {},
    fmt: imp.fmt ?? DEFAULT_FMT,
    lint: {
      ...imp.lint,
      rules: {
        ...imp.lint?.rules,
        exclude: ['no-import-prefix', ...(imp.lint?.rules?.exclude ?? [])],
      },
      plugins: [LINT_PLUGIN, ...(imp.lint?.plugins ?? [])],
    },
    lock: '../imp.lock',
  }

  await Deno.mkdir(generatedDir, { recursive: true })
  await Deno.writeTextFile(join(generatedDir, '.gitignore'), '*\n')
  await Deno.writeTextFile(configPath, JSON.stringify(denoConfig, null, 2))

  return { configPath, imports: denoConfig.imports }
}
