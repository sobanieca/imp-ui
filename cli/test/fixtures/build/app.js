import mitt from 'mitt'
import { logLevel } from 'imp/log'
import { greeting } from './lib.js'

const emitter = mitt()
let delivered = null
emitter.on('ready', (value) => {
  delivered = value
})
emitter.emit('ready', greeting)

export const message = delivered
export const impLogLevel = logLevel()
export const loadShout = async () => {
  const { shout } = await import('./lazy.js')
  return shout()
}
