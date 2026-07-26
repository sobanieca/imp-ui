import { counter } from './counter.js'

export const zero = counter()
export const startsAtFive = counter({ start: 5 })
export const lazy = () => counter({ start: 9 })
