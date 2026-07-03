import mitt from 'npm:mitt@3.0.1'
import { encodeBase64 } from 'jsr:@std/encoding@1.0.10/base64'
import { greeting } from './lib.js'
import { div, mount } from 'imp'

const emitter = mitt()
const loadDayjs = () => import('npm:dayjs@1.11.13')

emitter.on('ready', loadDayjs)

mount('#app', () => div(`${greeting} ${encodeBase64('imp')}`))
