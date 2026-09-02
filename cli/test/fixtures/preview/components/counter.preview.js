import { counter } from './counter.js'

export const name = 'Counter'
export const group = 'Widgets'
export const description = "Run 'imp skill ./components/counter.js' before writing code with it."

export const zero = counter()
export const startsAtFive = counter({ start: 5 })
export const lazy = () => counter({ start: 9 })
