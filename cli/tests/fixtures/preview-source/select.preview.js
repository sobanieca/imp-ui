import { form, select } from 'imp/std/inputs'
import { luBox, luUser } from 'imp/icons'
import { icon } from 'imp/std'
import * as fixtures from './fixtures.js'
import { mockModule } from 'imp/preview'

export const name = 'Select'
export const group = 'Inputs'
export const description = `
  Picks one plan.

  - the **free** plan is the default
`

mockModule('./http.js', ({ spy }) => ({ load: spy(async () => []) }))

const wrap = (...fields) => form({ initialValues: { plan: 'pro' } }, ...fields)
const plans = ['free', 'pro']
const badge = () =>
  icon(luBox, { size: 'sm' })

export const basic = wrap(select({ field: 'plan', label: 'Plan', options: plans }))
export const lazy = () => select({ field: 'plan', options: fixtures.plans, icon: badge() })
export const plain = select({ field: 'plan', label: `Plan ${plans.length}` })
export const arrowWithBody = () => {
  const options = plans
  return select({ field: 'plan', options })
}
export function declared() {
  return select({ field: 'plan', options: plans })
}
export const labelled = {
  scenario: 'With a placeholder',
  component: wrap(select({ field: 'plan', placeholder: 'Pick a plan', options: plans })),
}
export const labelledLazy = { scenario: 'Built at render time', component: () => select(plans) }
export const shadowed = () => {
  const plans = ['enterprise']
  return select({ field: 'plan', options: plans })
}
export { luUser as reexported }
