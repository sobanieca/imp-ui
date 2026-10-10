const ASCENDING = 'ascending'

const DESCENDING = 'descending'

const UNSORTED = 'none'

const NEXT_DIRECTION = {
  [UNSORTED]: ASCENDING,
  [ASCENDING]: DESCENDING,
  [DESCENDING]: UNSORTED,
}

export const nextSortDirection = (current) => NEXT_DIRECTION[current] ?? ASCENDING

export const isSorted = (direction) => direction === ASCENDING || direction === DESCENDING

const comparableOf = (value) => (value instanceof Date ? value.getTime() : value)

const isMissing = (value) =>
  value === null || value === undefined || value === '' || Number.isNaN(comparableOf(value))

const sortValueOf = (column, row) =>
  typeof column.sortValue === 'function' ? column.sortValue(row) : row[column.key]

const compareWith = (collator) => (first, second) => {
  const [left, right] = [comparableOf(first), comparableOf(second)]
  return typeof left === 'number' && typeof right === 'number'
    ? left - right
    : collator.compare(String(first), String(second))
}

export const sortRows = (rows, column, direction, language) => {
  if (!column || !isSorted(direction)) return rows
  const compare = compareWith(new Intl.Collator(language, { numeric: true }))
  const turn = direction === DESCENDING ? -1 : 1
  return rows
    .map((row) => ({ row, value: sortValueOf(column, row) }))
    .toSorted((first, second) => {
      if (isMissing(first.value) || isMissing(second.value)) {
        return Number(isMissing(first.value)) - Number(isMissing(second.value))
      }
      return turn * compare(first.value, second.value)
    })
    .map(({ row }) => row)
}

const cellIncludes = (value, query) =>
  !isMissing(value) && String(value).toLowerCase().includes(query)

export const filterRows = (rows, columns, query) =>
  query === ''
    ? rows
    : rows.filter((row) => columns.some((column) => cellIncludes(row[column.key], query)))
