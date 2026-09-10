import { counter } from './counter.js'
import { groups } from '../preview-groups.js'

export const name = 'Counter'
export const group = groups.widgets

export const zero = counter()
export const startsAtFive = { scenario: 'Starts at five', component: counter({ start: 5 }) }
export const lazy = { scenario: 'Built at render time', component: () => counter({ start: 9 }) }
