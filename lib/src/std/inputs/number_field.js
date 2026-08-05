import { createTextComponent } from './text_input.js'

export const numberField = (...args) =>
  createTextComponent('numberField', {
    tag: 'input',
    type: 'number',
    numeric: true,
    extraProps: ['step'],
  })(...args)
