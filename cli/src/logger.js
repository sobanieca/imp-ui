import { blue, cyan, dim, magenta, red, yellow } from './colors.js'

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const stripAnsi = (text) => text.replaceAll(ANSI_PATTERN, '')

const sinks = new Set()

export function addLogSink(sink) {
  sinks.add(sink)
  return () => sinks.delete(sink)
}

const emit = (stream, header, message) => {
  const line = message === undefined ? header : `${header} ${message}`
  if (stream === 'error') console.error(line)
  else console.log(line)
  if (sinks.size) {
    const plain = stripAnsi(line)
    for (const sink of sinks) sink(plain)
  }
}

const browserHeaderColor = {
  error: red,
  warn: yellow,
  info: cyan,
  uncaught: red,
}

export const logger = {
  error: (message) => emit('error', red('[ERROR]'), message),
  warn: (message) => emit('log', yellow('[WARN]'), message),
  info: (message) => emit('log', cyan('[INFO]'), message),
  debug: (message) => emit('log', dim('[DEBUG]'), message),
  http: (message) => emit('log', blue('[HTTP]'), message),
  browser: (level, message) =>
    emit('log', (browserHeaderColor[level] ?? magenta)(`[BROWSER:${level}]`), message),
}
