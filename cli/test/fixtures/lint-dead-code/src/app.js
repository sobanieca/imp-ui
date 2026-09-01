import { mount } from 'imp'
import { div } from 'imp/html'
import { greeting } from './lib.js'

mount('#app', () => div(greeting))
