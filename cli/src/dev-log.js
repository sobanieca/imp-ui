import { join } from '@std/path'

export const DEFAULT_MAX_LOG_ENTRIES = 4000

export const devLogPath = (root) => join(root, '.imp', 'dev.log')

export async function createDevLog({ root, maxEntries = DEFAULT_MAX_LOG_ENTRIES }) {
  const path = devLogPath(root)
  await Deno.mkdir(join(root, '.imp'), { recursive: true })
  const file = await Deno.open(path, { write: true, create: true, truncate: true })
  const encoder = new TextEncoder()

  const recent = []
  let entriesInFile = 0
  const rewriteThreshold = maxEntries * 2
  let pending = Promise.resolve()
  let closed = false

  const writeBytes = async (bytes) => {
    let offset = 0
    while (offset < bytes.length) offset += await file.write(bytes.subarray(offset))
  }

  const rewriteFromRecent = async () => {
    await file.truncate(0)
    await file.seek(0, Deno.SeekMode.Start)
    if (recent.length) await writeBytes(encoder.encode(recent.join('\n') + '\n'))
    entriesInFile = recent.length
  }

  const append = async (line) => {
    if (closed) return
    const entry = line.replaceAll('\n', ' ')
    recent.push(entry)
    if (recent.length > maxEntries) recent.shift()
    await writeBytes(encoder.encode(entry + '\n'))
    entriesInFile++
    if (entriesInFile >= rewriteThreshold) await rewriteFromRecent()
  }

  return {
    path,
    recent: (limit) => recent.slice(-limit),
    write(line) {
      pending = pending.then(() => append(line)).catch(() => {})
      return pending
    },
    async close() {
      closed = true
      await pending
      try {
        file.close()
      } catch {
        /* already closed */
      }
    },
  }
}
