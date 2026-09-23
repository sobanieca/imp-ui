const GROUPS = [
  ['mount', 'Mount'],
  ['update', 'State updates'],
  ['dispose', 'Disposal'],
]

const sorted = (values) => [...values].sort((a, b) => a - b)

export const median = (values) => {
  const list = sorted(values)
  const middle = list.length >> 1
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2
}

const ms = (value) => value.toFixed(2)

const kb = (bytes) => `${Math.round(bytes / 1024)} kB`

const ratio = (value, best) => (best > 0 ? `${(value / best).toFixed(1)}x` : '-')

const table = (header, rows) => {
  const line = (cells) => `| ${cells.join(' | ')} |`
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n')
}

const findResult = (run, framework, name) =>
  run.frameworks[framework]?.find((result) => result.name === name) ?? null

const scenarioNames = (run, group) => {
  const names = []
  for (const results of Object.values(run.frameworks)) {
    for (const result of results) {
      if (result.group === group && !names.includes(result.name)) names.push(result.name)
    }
  }
  return names
}

function timingTable(run, group) {
  const frameworks = Object.keys(run.frameworks)
  const rows = scenarioNames(run, group).map((name) => {
    const medians = frameworks.map((framework) => {
      const result = findResult(run, framework, name)
      return result ? median(result.durations) : null
    })
    const best = Math.min(...medians.filter((value) => value !== null))
    const cells = medians.map((value, index) => {
      if (value === null) return '-'
      const result = findResult(run, frameworks[index], name)
      const low = ms(Math.min(...result.durations))
      const high = ms(Math.max(...result.durations))
      return `${ms(value)} (${low}..${high}) ${ratio(value, best)}`
    })
    return [name, ...cells]
  })
  return table(['scenario', ...frameworks], rows)
}

function memoryTable(run) {
  const rows = []
  for (const name of scenarioNames(run, 'dispose')) {
    for (const framework of Object.keys(run.frameworks)) {
      const result = findResult(run, framework, name)
      if (!result || !result.memory.length) continue
      const pick = (key, field) => median(result.memory.map((entry) => entry[key][field]))
      rows.push([
        name,
        framework,
        String(pick('mounted', 'nodes')),
        String(pick('mounted', 'listeners')),
        kb(pick('mounted', 'heap')),
        String(pick('leaked', 'nodes')),
        String(pick('leaked', 'listeners')),
        kb(pick('leaked', 'heap')),
      ])
    }
  }
  return table(
    [
      'scenario',
      'framework',
      'mounted nodes',
      'mounted listeners',
      'mounted heap',
      'left nodes',
      'left listeners',
      'left heap',
    ],
    rows,
  )
}

function domCheck(run) {
  const frameworks = Object.keys(run.frameworks)
  const [first, ...others] = frameworks
  const mismatches = []
  for (const result of run.frameworks[first] ?? []) {
    for (const other of others) {
      const counterpart = findResult(run, other, result.name)
      if (!counterpart) continue
      const a = JSON.stringify(result.dom)
      const b = JSON.stringify(counterpart.dom)
      if (a !== b) mismatches.push(`- ${result.name}: ${first} ${a} vs ${other} ${b}`)
    }
  }
  if (!mismatches.length) return 'Every framework produced the same DOM after every scenario.'
  return ['The DOM differed after these scenarios:', ...mismatches].join('\n')
}

export function writeReport(run) {
  const versions = Object.entries(run.versions).map(([name, version]) => `${name} ${version}`)
  const lines = [
    '# imp performance run',
    '',
    `Date: ${run.date}. Browser: ${run.browser}. Platform: ${run.platform}.`,
    `Versions: ${versions.join(', ')}. Samples per scenario: ${run.samples}.`,
    '',
    'A timing cell is the median in milliseconds, the range in parentheses,',
    'and the ratio to the fastest framework in the row.',
    '',
  ]
  for (const [group, title] of GROUPS) {
    if (!scenarioNames(run, group).length) continue
    lines.push(`## ${title}`, '', timingTable(run, group), '')
  }
  if (scenarioNames(run, 'dispose').length) {
    lines.push(
      '## Memory after disposal',
      '',
      'Each value is the median across samples. The "mounted" columns are the cost of the',
      'mounted scenario relative to the empty page, after a forced garbage collection.',
      'The "left" columns are what stays after the scenario ends and the garbage collector',
      'runs. A clean disposal leaves 0 nodes and 0 listeners. Heap deltas carry',
      'noise of a few tens of kilobytes.',
      '',
      memoryTable(run),
      '',
    )
  }
  lines.push('## DOM check', '', domCheck(run), '')
  return lines.join('\n')
}
