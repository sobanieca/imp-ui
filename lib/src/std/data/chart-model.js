import { impLogger } from '../../logger.js'
import { paletteNames } from '../../theme-colors.js'

const NAME = 'chart'

const DEFAULT_COLORS = ['blue', 'orange', 'pink', 'cyan', 'purple', 'green', 'indigo', 'red']

const PATTERN_COUNT = 6

const STEP_FACTORS = [1, 2, 2.5, 5, 10]

const TARGET_INTERVALS = 5

const clean = (value) => Number(value.toPrecision(12))

const niceStep = (rough) => {
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const factor = STEP_FACTORS.find((candidate) => candidate * magnitude >= rough) ?? 10
  return factor * magnitude
}

const valueScale = (lowest, highest) => {
  const low = lowest === highest ? Math.min(0, lowest) : lowest
  const high = lowest === highest ? Math.max(0, highest) : highest
  const top = low === high ? high + 1 : high
  const step = niceStep((top - low) / TARGET_INTERVALS)
  const firstIndex = Math.floor(clean(low / step))
  const lastIndex = Math.ceil(clean(top / step))
  const ticks = []
  for (let index = firstIndex; index <= lastIndex; index++) ticks.push(clean(index * step))
  const first = ticks[0]
  const span = ticks.at(-1) - first
  return { ticks, position: (value) => clean((value - first) / span * 100) }
}

const normalizeLabels = (labels) => {
  if (Array.isArray(labels)) return labels.map(String)
  impLogger.warn(`${NAME}: 'labels' must be an array of category names like ['Q1', 'Q2']`)
  return []
}

const colorOf = (entry, index) => {
  const fallback = DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  if (entry.color === undefined || entry.color === null) return fallback
  if (paletteNames().includes(entry.color)) return entry.color
  impLogger.warn(
    `${NAME}: the color '${entry.color}' of series '${entry.name}' is not a theme palette name like 'blue' - using '${fallback}'`,
  )
  return fallback
}

const valuesOf = (entry, count) => {
  const values = Array.isArray(entry.values) ? entry.values : []
  if (values.length !== count) {
    impLogger.warn(
      `${NAME}: series '${entry.name}' has ${values.length} values for ${count} labels - a missing value draws nothing`,
    )
  }
  return Array.from({ length: count }, (_, index) => {
    const value = values[index]
    if (value === undefined || value === null) return null
    if (typeof value === 'number' && Number.isFinite(value)) return value
    impLogger.warn(
      `${NAME}: series '${entry.name}' has the value '${value}' at index ${index}, which is not a number - skipping it`,
    )
    return null
  })
}

const normalizeSeries = (series, count) => {
  if (!Array.isArray(series)) {
    impLogger.warn(`${NAME}: 'series' must be an array of { name, values, color }`)
    return []
  }
  const usable = series.filter((entry) => {
    if (entry && typeof entry === 'object' && Array.isArray(entry.values)) return true
    impLogger.warn(`${NAME}: a series is not an object with a 'values' array - skipping it`)
    return false
  })
  if (usable.length > DEFAULT_COLORS.length) {
    impLogger.warn(
      `${NAME}: ${usable.length} series is more than the ${DEFAULT_COLORS.length} default colors - the colors repeat`,
    )
  }
  return usable.map((entry, index) => {
    const named = { ...entry, name: entry.name === undefined ? `${index + 1}` : String(entry.name) }
    return {
      name: named.name,
      color: colorOf(named, index),
      pattern: index % PATTERN_COUNT,
      values: valuesOf(named, count),
    }
  })
}

const groupedMarks = (series, position) => {
  const zero = position(0)
  return series.map(({ values }) =>
    values.map((value) => {
      if (value === null) return null
      const at = position(value)
      return { value, at, from: Math.min(zero, at), size: Math.abs(at - zero), negative: value < 0 }
    })
  )
}

const stackedMarks = (series, position, count) => {
  const raised = Array(count).fill(0)
  const lowered = Array(count).fill(0)
  return series.map(({ values }) =>
    values.map((value, index) => {
      if (value === null) return null
      const negative = value < 0
      const base = negative ? lowered[index] : raised[index]
      const tip = base + value
      if (negative) lowered[index] = tip
      else raised[index] = tip
      const from = position(Math.min(base, tip))
      return {
        value,
        at: position(tip),
        from,
        size: clean(position(Math.max(base, tip)) - from),
        negative,
      }
    })
  )
}

const stackedExtent = (series, count) => {
  const sums = Array.from({ length: count }, (_, index) => {
    const column = series.map(({ values }) => values[index] ?? 0)
    return {
      raised: column.filter((value) => value > 0).reduce((sum, value) => sum + value, 0),
      lowered: column.filter((value) => value < 0).reduce((sum, value) => sum + value, 0),
    }
  })
  return [
    Math.min(0, ...sums.map(({ lowered }) => lowered)),
    Math.max(0, ...sums.map(({ raised }) => raised)),
  ]
}

const plainExtent = (series, fromZero) => {
  const numbers = series.flatMap(({ values }) => values.filter((value) => value !== null))
  if (numbers.length === 0) return [0, 0]
  const anchors = fromZero ? [0] : []
  return [Math.min(...anchors, ...numbers), Math.max(...anchors, ...numbers)]
}

export const buildModel = ({ type, stacked, labels: rawLabels, series: rawSeries }) => {
  const labels = normalizeLabels(rawLabels)
  const series = normalizeSeries(rawSeries, labels.length)
  const [lowest, highest] = stacked
    ? stackedExtent(series, labels.length)
    : plainExtent(series, type !== 'line')
  const scale = valueScale(lowest, highest)
  const marks = stacked
    ? stackedMarks(series, scale.position, labels.length)
    : groupedMarks(series, scale.position)
  return {
    labels,
    series,
    marks,
    ticks: scale.ticks.map((value) => ({ value, at: scale.position(value) })),
  }
}
