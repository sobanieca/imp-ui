import { component } from 'imp'
import { button, text } from 'imp/std'

export const counter = (start = 0) => {
  let value = start
  return component('demo-counter', {
    setup: () => text(String(value)),
  })
}
