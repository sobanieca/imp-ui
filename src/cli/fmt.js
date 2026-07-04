import { createContext } from '@dprint/formatter'
import { relative } from '@std/path'
import { FMT_EXTENSIONS, FMT_PLUGINS, wasmUrl } from './fmt_plugins.js'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'

async function createFormatterContext(fmtConfig) {
  const layoutSettings = {
    lineWidth: fmtConfig.lineWidth ?? 100,
    indentWidth: fmtConfig.indentWidth ?? 2,
    useTabs: fmtConfig.useTabs ?? false,
  }
  const context = createContext(layoutSettings)
  for (const plugin of FMT_PLUGINS) {
    let buffer
    try {
      buffer = await Deno.readFile(wasmUrl(plugin.file))
    } catch {
      throw new Error(`formatter plugin ${plugin.file} is missing from this imp build`)
    }
    context.addPlugin(buffer, { ...layoutSettings, ...plugin.config(fmtConfig) })
  }
  return context
}

const lineDiff = (before, after) => {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const lines = []
  const count = Math.max(beforeLines.length, afterLines.length)
  for (let index = 0; index < count; index++) {
    if (beforeLines[index] === afterLines[index]) continue
    if (index < beforeLines.length) lines.push(`${index + 1} | -${beforeLines[index]}`)
    if (index < afterLines.length) lines.push(`${index + 1} | +${afterLines[index]}`)
  }
  return lines.join('\n')
}

const fileCount = (count) => `${count} ${count === 1 ? 'file' : 'files'}`

export async function fmt({ root, paths, check }) {
  const imp = await loadImpConfig(root)
  const fmtConfig = imp.fmt ?? {}
  const files = await collectFiles({
    root,
    paths,
    extensions: FMT_EXTENSIONS,
    exclude: fmtConfig.exclude ?? [],
  })
  const context = await createFormatterContext(fmtConfig)

  let changed = 0
  let failed = 0
  for (const file of files) {
    const original = await Deno.readTextFile(file)
    let formatted
    try {
      formatted = context.formatText({ filePath: file, fileText: original })
    } catch (error) {
      failed++
      const reason = String(error.message ?? error).split('\n')[0]
      console.error(`error formatting ${relative(root, file)}: ${reason}`)
      continue
    }
    if (formatted === original) continue
    changed++
    if (check) {
      console.error(`\nfrom ${relative(root, file)}:`)
      console.error(lineDiff(original, formatted))
    } else {
      await Deno.writeTextFile(file, formatted)
      console.log(relative(root, file))
    }
  }

  if (check && changed) {
    console.error(
      `\nerror: Found ${changed} not formatted ${changed === 1 ? 'file' : 'files'} in ${
        fileCount(files.length)
      }`,
    )
    return 1
  }
  console.error(`Checked ${fileCount(files.length)}`)
  return failed ? 1 : 0
}
