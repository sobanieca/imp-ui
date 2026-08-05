const SNAPSHOT_DIR = new URL('./snapshots/', import.meta.url)
const UPDATE = Deno.args.includes('--update')

const diffLines = (expected, actual) => {
  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const lines = []
  const count = Math.max(expectedLines.length, actualLines.length)
  for (let index = 0; index < count; index++) {
    if (expectedLines[index] === actualLines[index]) continue
    if (index < expectedLines.length) lines.push(`- ${expectedLines[index]}`)
    if (index < actualLines.length) lines.push(`+ ${actualLines[index]}`)
  }
  return lines.join('\n')
}

export async function assertSnapshot(name, actual) {
  const path = new URL(`${name}.txt`, SNAPSHOT_DIR)
  if (UPDATE) {
    await Deno.mkdir(SNAPSHOT_DIR, { recursive: true })
    await Deno.writeTextFile(path, actual)
    return
  }
  let expected
  try {
    expected = await Deno.readTextFile(path)
  } catch {
    throw new Error(
      `missing snapshot cli/test/snapshots/${name}.txt - run 'deno task test:update' to create it`,
    )
  }
  if (expected === actual) return
  throw new Error(
    `snapshot mismatch in cli/test/snapshots/${name}.txt (- expected, + actual):\n` +
      `${diffLines(expected, actual)}\n\n` +
      `run 'deno task test:update' if the new output is correct`,
  )
}
