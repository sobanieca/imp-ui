const [path, countArg] = Deno.args
const count = Number(countArg ?? 25)
const profile = JSON.parse(await Deno.readTextFile(path))

const byId = new Map(profile.nodes.map((node) => [node.id, node]))
const selfTime = new Map()
const deltas = profile.timeDeltas
for (const [index, id] of profile.samples.entries()) {
  selfTime.set(id, (selfTime.get(id) ?? 0) + (deltas[index] ?? 0))
}

const label = (node) => {
  const { functionName, url, lineNumber } = node.callFrame
  const file = url.split('/').pop()
  return `${functionName || '(anonymous)'} ${file}:${lineNumber + 1}`
}

const totals = new Map()
for (const [id, time] of selfTime) {
  const key = label(byId.get(id))
  totals.set(key, (totals.get(key) ?? 0) + time)
}
const total = [...selfTime.values()].reduce((sum, time) => sum + time, 0)
const rows = [...totals].sort((a, b) => b[1] - a[1]).slice(0, count)
console.log(`total sampled: ${(total / 1000).toFixed(1)} ms`)
for (const [key, time] of rows) {
  console.log(
    `${(time / 1000).toFixed(1).padStart(8)} ms ${
      (100 * time / total).toFixed(1).padStart(5)
    }%  ${key}`,
  )
}

if (Deno.args.includes('--tree')) {
  const children = new Map(profile.nodes.map((node) => [node.id, node.children ?? []]))
  const inclusive = new Map()
  const measure = (id) => {
    if (inclusive.has(id)) return inclusive.get(id)
    let time = selfTime.get(id) ?? 0
    for (const child of children.get(id)) time += measure(child)
    inclusive.set(id, time)
    return time
  }
  const print = (id, depth) => {
    const time = measure(id)
    if (time < total * 0.015 || depth > 14) return
    const node = byId.get(id)
    console.log(`${'  '.repeat(depth)}${(time / 1000).toFixed(1)} ms  ${label(node)}`)
    const ordered = [...children.get(id)].sort((a, b) => measure(b) - measure(a))
    for (const child of ordered) print(child, depth + 1)
  }
  print(profile.nodes[0].id, 0)
}
