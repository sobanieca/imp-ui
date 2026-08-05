import { createFlexComponent } from './flex.js'

export const stack = (...args) => createFlexComponent('stack', 'column')(...args)
