import mitt from 'mitt'
import { greeting } from './lib.js'
import { mount } from 'imp'
import { div } from 'imp/html'

const emitter = mitt()
emitter.on('ready', () => mount('#app', () => div(greeting)))
emitter.emit('ready')
