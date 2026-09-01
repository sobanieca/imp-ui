import { mount } from 'imp'
import { div } from 'imp/html'
import { greeting } from './lib.js'
import { format } from './util/index.js'

mount('#app', () => div(format(greeting)))
