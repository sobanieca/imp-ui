import { createBarComponent } from './bar.js'

export const navbar = (...args) =>
  createBarComponent('navbar', 'header', 'end', 'shadow-sm')(...args)
