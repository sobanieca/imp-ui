import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'

export const createKeyedRows = (name, keyName) => {
  const order = createState(`imp.${name}.order`, [])
  let loaded = new Map()

  const take = (value) => {
    if (!Array.isArray(value) && value !== null && value !== undefined) {
      impLogger.warn(`${name}: the rows must be an array of objects - showing none`)
    }
    const previous = loaded
    loaded = new Map()
    return (Array.isArray(value) ? value : []).filter((row, index) => {
      const key = row?.[keyName]
      if (key === null || key === undefined) {
        impLogger.warn(`${name}: row ${index} has no '${keyName}' - every row needs a unique key`)
        return false
      }
      const known = previous.get(key)
      const version = known === undefined ? 0 : known.version + (known.row === row ? 0 : 1)
      loaded.set(key, { row, version })
      return true
    })
  }

  return {
    take,
    rowOf: (key) => loaded.get(key).row,
    show: (rows) =>
      order.set(
        rows.map((row) => ({ key: row[keyName], version: loaded.get(row[keyName]).version })),
      ),
    region: (renderRow) =>
      order.each(({ key }) => renderRow(key, loaded.get(key).row), (entry) => entry.key),
  }
}
