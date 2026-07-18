import { env } from './env.js'

const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent']

const levelRanks = new Map(LOG_LEVELS.map((level, rank) => [level, rank]))

const consoleMethods = { debug: 'log', info: 'log', warn: 'warn', error: 'error' }

const DEFAULT_LOG_LEVEL = 'info'

const configuredLevel = () => {
  const configured = env.IMP_LOG_LEVEL
  if (configured === undefined) return DEFAULT_LOG_LEVEL
  const level = String(configured).toLowerCase()
  if (levelRanks.has(level)) return level
  console.warn(
    `imp: IMP_LOG_LEVEL is '${configured}' — expected one of ${
      LOG_LEVELS.join(', ')
    }; using '${DEFAULT_LOG_LEVEL}'`,
  )
  return DEFAULT_LOG_LEVEL
}

let activeLevel = configuredLevel()

export function setLogLevel(level) {
  if (!levelRanks.has(level)) {
    throw new Error(`imp: log level '${level}' is unknown — use one of ${LOG_LEVELS.join(', ')}`)
  }
  activeLevel = level
}

export const logLevel = () => activeLevel

const write = (level, name, parts) => {
  if (levelRanks.get(level) < levelRanks.get(activeLevel)) return
  const method = consoleMethods[level]
  if (!name) {
    console[method](...parts)
    return
  }
  const [first, ...rest] = parts
  if (typeof first === 'string') console[method](`${name}: ${first}`, ...rest)
  else console[method](`${name}:`, ...parts)
}

export function createLogger(name = '') {
  if (typeof name !== 'string') {
    throw new Error('imp: createLogger needs a string name to prefix its messages')
  }
  return Object.freeze({
    name,
    debug: (...parts) => write('debug', name, parts),
    info: (...parts) => write('info', name, parts),
    warn: (...parts) => write('warn', name, parts),
    error: (...parts) => write('error', name, parts),
  })
}

export const logger = createLogger()
