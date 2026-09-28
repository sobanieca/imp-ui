import { env } from './env.js'

const LOG_LEVELS = ['debug', 'info', 'warn', 'error']

const consoleMethods = { debug: 'log', info: 'log', warn: 'warn', error: 'error' }

const defaultLevel = () => (globalThis.__IMP_DEV__ === false ? 'warn' : 'info')

const knownLevel = (level) => LOG_LEVELS.includes(level)

const configuredLevel = () => {
  const configured = env.IMP_LOG_LEVEL
  if (configured === undefined) return defaultLevel()
  const level = String(configured).toLowerCase()
  if (knownLevel(level)) return level
  console.warn(
    `imp: IMP_LOG_LEVEL is '${configured}' - expected one of ${
      LOG_LEVELS.join(', ')
    }; using '${defaultLevel()}'`,
  )
  return defaultLevel()
}

let activeLevel = null

const currentLevel = () => (activeLevel ??= configuredLevel())

export function setLogLevel(level) {
  if (!knownLevel(level)) {
    throw new Error(`imp: log level '${level}' is unknown - use one of ${LOG_LEVELS.join(', ')}`)
  }
  activeLevel = level
}

export const logLevel = () => currentLevel()

const write = (level, name, parts) => {
  if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(currentLevel())) return
  const method = consoleMethods[level]
  if (!name) {
    console[method](...parts)
    return
  }
  const [first, ...rest] = parts
  if (typeof first === 'string') console[method](`${name}: ${first}`, ...rest)
  else console[method](`${name}:`, ...parts)
}

const named = (name) => ({
  name,
  debug: (...parts) => write('debug', name, parts),
  info: (...parts) => write('info', name, parts),
  warn: (...parts) => write('warn', name, parts),
  error: (...parts) => write('error', name, parts),
})

export function createLogger(name = '') {
  if (typeof name !== 'string') {
    throw new Error('imp: createLogger needs a string name to prefix its messages')
  }
  return Object.freeze(named(name))
}

export const logger = Object.freeze({
  name: '',
  debug: (...parts) => write('debug', '', parts),
  info: (...parts) => write('info', '', parts),
  warn: (...parts) => write('warn', '', parts),
  error: (...parts) => write('error', '', parts),
})

export const impLogger = Object.freeze({
  name: 'imp',
  debug: (...parts) => write('debug', 'imp', parts),
  info: (...parts) => write('info', 'imp', parts),
  warn: (...parts) => write('warn', 'imp', parts),
  error: (...parts) => write('error', 'imp', parts),
})
