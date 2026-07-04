import mitt from 'mitt'
import { greeting } from './lib.js'
import { div, mount } from 'imp'

const emitter = mitt()
emitter.on('ready', () => mount('#app', () => div(greeting)))
emitter.emit('ready')
