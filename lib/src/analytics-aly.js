import { batch, FLUSH } from './analytics.js'
import { impLogger } from './logger.js'

const APP_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/

const OPTION_NAMES = ['app', 'servers', 'segments', 'size', 'ms']

const STATUS_HINTS = {
  404: (app) => `register the app on that server with 'imp-aly app add ${app} <app-map URL>'`,
  413: () => 'lower the size of the batch',
}

const fnv1a = (text) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  }
  return hash >>> 0
}

const parsedUrl = (server) => {
  try {
    return new URL(server, globalThis.location?.href)
  } catch {
    return null
  }
}

const collectUrlOf = (server, app) => {
  const url = typeof server === 'string' ? parsedUrl(server) : null
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error(
      `imp: alySink({ servers }) - '${server}' is not the URL of an imp-aly server, like 'https://aly.myapp.example'`,
    )
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}/collect/${app}`
}

const readOptions = (options) => {
  const unknown = Object.keys(options ?? {}).filter((name) => !OPTION_NAMES.includes(name))
  if (unknown.length) {
    throw new Error(
      `imp: alySink({ ${OPTION_NAMES.join(', ')} }) takes these options - remove ${
        unknown.join(', ')
      }`,
    )
  }
  const { app, servers, segments, size, ms } = options ?? {}
  if (typeof app !== 'string' || !APP_NAME.test(app)) {
    throw new Error(
      "imp: alySink({ app }) - app is the name of the app on the imp-aly server: lowercase letters, digits and '-', like 'myapp'",
    )
  }
  if (!Array.isArray(servers) || !servers.length) {
    throw new Error(
      "imp: alySink({ servers }) - servers is a list of imp-aly server URLs, like ['https://aly.myapp.example']",
    )
  }
  if (segments !== undefined && typeof segments !== 'function') {
    throw new Error(
      "imp: alySink({ segments }) - segments is a function that returns the segments of a record, like () => ({ plan: 'pro' })",
    )
  }
  const urls = servers.map((server) => collectUrlOf(server, app))
  if (new Set(urls).size !== urls.length) {
    throw new Error('imp: alySink({ servers }) - each server is in the list once')
  }
  return { app, urls, segments, size, ms }
}

const post = (url, body) =>
  globalThis.fetch(url, {
    method: 'POST',
    body,
    keepalive: true,
    credentials: 'omit',
    referrerPolicy: 'strict-origin',
  })

export const alySink = (options) => {
  const { app, urls, segments, size, ms } = readOptions(options)
  let home = null
  let moves = 0
  const currentIndex = () => (home + moves) % urls.length

  const report = async (url, count, response) => {
    if (response.status === 429) {
      impLogger.warn(`imp-aly at ${url} answered 429 - its rate limit dropped ${count} records`)
      return
    }
    if (!response.ok) {
      const hint = STATUS_HINTS[response.status]?.(app)
      impLogger.error(
        `imp-aly at ${url} answered ${response.status} - ${count} records are dropped${
          hint ? ` - ${hint}` : ''
        }`,
      )
      return
    }
    const counts = await response.json().catch(() => null)
    if (counts?.rejected > 0) {
      impLogger.warn(
        `imp-aly at ${url} rejected ${counts.rejected} of ${count} records - run 'imp-aly app show ${app}' on that server for the reasons`,
      )
    }
  }

  const deliver = async (body, count, tried) => {
    const index = currentIndex()
    const url = urls[index]
    const response = await post(url, body).catch(() => null)
    if (response && response.status < 500) return report(url, count, response)
    if (currentIndex() === index) moves++
    if (tried + 1 < urls.length) return deliver(body, count, tried + 1)
    impLogger.warn(
      `no imp-aly server took ${count} records - tried ${
        urls.join(', ')
      } - check that a server runs, and that its --allow-origin lists this page`,
    )
  }

  const send = (records) => {
    home ??= fnv1a(records[0].visit) % urls.length
    return deliver(JSON.stringify(records), records.length, 0)
  }

  const batched = batch(send, { size, ms })
  let firstSent = false
  const sink = (record) => {
    batched(segments ? { ...segments(record), ...record } : record)
    if (firstSent) return
    firstSent = true
    batched[FLUSH]()
  }
  sink[FLUSH] = batched[FLUSH]
  return sink
}
