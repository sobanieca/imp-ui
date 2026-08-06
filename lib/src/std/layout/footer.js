import { createBarComponent } from './bar.js'

export const footer = (...args) => createBarComponent('footer', 'footer', 'start', null)(...args)
