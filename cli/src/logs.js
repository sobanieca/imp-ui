import { dirname, join, relative, resolve } from '@std/path'
import { loadImpConfig } from './config.js'
import { DEFAULT_MAX_LOG_ENTRIES, devLogPath } from './dev-log.js'

const NOT_SEARCHED = new Set(['.git', '.imp', 'node_modules', 'dist', 'dependencies'])

const exists = (path) => Deno.stat(path).then(() => true, () => false)

async function nestedLogFolders(root) {
  const found = []
  const search = async (directory) => {
    let entries
    try {
      entries = await Array.fromAsync(Deno.readDir(directory))
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory || NOT_SEARCHED.has(entry.name)) continue
      const folder = join(directory, entry.name)
      if (await exists(devLogPath(folder))) found.push(relative(root, folder))
      await search(folder)
    }
  }
  await search(root)
  return found.sort()
}

async function noLogMessage(root, path) {
  const nested = await nestedLogFolders(root)
  if (!nested.length) {
    return `no dev server has run in this project - imp start writes the log to ${path}`
  }
  const where = nested.length === 1 ? 'that folder' : 'one of them'
  return `no session log at ${path} - there is one in ${
    nested.join(', ')
  }, run imp logs from ${where}`
}

const NEWLINE = 10

const READ_CHUNK = 65536

const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function print(text) {
  const bytes = encoder.encode(text)
  let offset = 0
  try {
    while (offset < bytes.length) offset += await Deno.stdout.write(bytes.subarray(offset))
  } catch (error) {
    if (error instanceof Deno.errors.BrokenPipe) Deno.exit(0)
    throw error
  }
}

const entriesOf = (text) => {
  const entries = text.split('\n')
  if (entries.at(-1) === '') entries.pop()
  return entries
}

async function readWholeLog(path, root) {
  try {
    return await Deno.readFile(path)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) throw new Error(await noLogMessage(root, path))
    throw error
  }
}

async function readFrom(path, offset) {
  const file = await Deno.open(path, { read: true })
  try {
    await file.seek(offset, Deno.SeekMode.Start)
    const chunks = []
    let total = 0
    while (true) {
      const chunk = new Uint8Array(READ_CHUNK)
      const read = await file.read(chunk)
      if (read === null) break
      chunks.push(chunk.subarray(0, read))
      total += read
    }
    const bytes = new Uint8Array(total)
    let at = 0
    for (const chunk of chunks) {
      bytes.set(chunk, at)
      at += chunk.length
    }
    return bytes
  } finally {
    file.close()
  }
}

const completeLength = (bytes) => bytes.lastIndexOf(NEWLINE) + 1

const alreadyPrintedPrefix = (fileEntries, printed) => {
  for (let length = Math.min(fileEntries.length, printed.length); length > 0; length--) {
    let matches = true
    for (let index = 0; index < length; index++) {
      if (fileEntries[index] !== printed[printed.length - length + index]) {
        matches = false
        break
      }
    }
    if (matches) return length
  }
  return 0
}

async function follow({ root, path, remember, startOffset, printed }) {
  let offset = startOffset
  const recent = printed.slice(-remember)

  const emit = async (entries) => {
    if (!entries.length) return
    recent.push(...entries)
    if (recent.length > remember) recent.splice(0, recent.length - remember)
    await print(entries.join('\n') + '\n')
  }

  const rewrittenLog = async () => {
    const bytes = await readWholeLog(path, root)
    const complete = completeLength(bytes)
    const entries = entriesOf(decoder.decode(bytes.subarray(0, complete)))
    offset = complete
    await emit(entries.slice(alreadyPrintedPrefix(entries, recent)))
  }

  const advance = async () => {
    let size
    try {
      size = (await Deno.stat(path)).size
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return
      throw error
    }
    if (size === offset) return
    if (size < offset || offset === 0) {
      await rewrittenLog()
      return
    }
    const bytes = await readFrom(path, offset)
    const complete = completeLength(bytes)
    if (!complete) return
    offset += complete
    await emit(entriesOf(decoder.decode(bytes.subarray(0, complete))))
  }

  const watched = await Deno.realPath(path)
  const watcher = Deno.watchFs(dirname(watched))
  const stop = () => watcher.close()
  Deno.addSignalListener('SIGINT', stop)
  try {
    await advance()
    for await (const event of watcher) {
      if (!event.paths.some((changed) => resolve(changed) === watched)) continue
      await advance()
    }
  } finally {
    Deno.removeSignalListener('SIGINT', stop)
  }
}

export async function logs({ root, count = null, follow: keepOpen = false }) {
  const path = resolve(devLogPath(root))
  const bytes = await readWholeLog(path, root)
  const complete = keepOpen ? completeLength(bytes) : bytes.length
  const entries = entriesOf(decoder.decode(bytes.subarray(0, complete)))
  const shown = count === null ? entries : entries.slice(-count)
  if (shown.length) await print(shown.join('\n') + '\n')
  if (!keepOpen) return
  const config = await loadImpConfig(root)
  const remember = Math.max(config.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES, entries.length)
  await follow({ root, path, remember, startOffset: complete, printed: entries })
}
