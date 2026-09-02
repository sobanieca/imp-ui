import { icon } from 'imp/std'
import * as icons from 'imp/icons'
import { luHouse } from 'imp/icons'

export * from 'imp/icons'
export * as glyphs from 'imp/icons'

export const home = () => icon(luHouse)

export const byName = async (name) => {
  const set = await import('imp/icons')
  return icon(set[name] ?? icons[name])
}
