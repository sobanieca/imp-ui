export const mockRuntime = ({ modules, files, reply, report }) => {
  const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const messageOf = (error) => String(error?.message || error)

  const ROUTE = /^([A-Z]+)\s+(\/\S*)$/

  const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const routeMatcher = (route) => {
    const found = typeof route === 'string' ? route.trim().match(ROUTE) : null
    if (!found) return null
    const [, method, path] = found
    const names = []
    const pattern = path
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':')) return escaped(segment)
        names.push(segment.slice(1))
        return '([^/]+)'
      })
      .join('/')
    const expression = new RegExp(`^${pattern}/?$`)
    return (description) => {
      if (description.method !== method) return null
      const values = description.path.match(expression)
      if (!values) return null
      try {
        return Object.fromEntries(
          names.map((name, index) => [name, decodeURIComponent(values[index + 1])]),
        )
      } catch {
        return null
      }
    }
  }

  const collectEntries = () => {
    const problems = []
    const entries = modules.flatMap((module, fileIndex) => {
      const file = files[fileIndex]
      const declared = module.mocks ?? module.default
      if (!Array.isArray(declared)) {
        problems.push(`${file} must export 'mocks' - an array of { match, handler }`)
        return []
      }
      return declared.flatMap((entry, index) => {
        const source = `${file} #${index + 1}`
        const route = typeof entry?.match === 'function' ? null : routeMatcher(entry?.route)
        if (
          (typeof entry?.match !== 'function' && !route)
          || typeof entry?.handler !== 'function'
        ) {
          problems.push(
            `${source} must be { match, handler } or { route: 'GET /api/users/:id', handler }, with functions`,
          )
          return []
        }
        return [
          { route, match: entry.match, handler: entry.handler, delay: entry.delay ?? 0, source },
        ]
      })
    })
    return { entries, problems }
  }

  const isBytes = (body) => body instanceof ArrayBuffer || ArrayBuffer.isView(body)

  const bytesOf = (body) =>
    body instanceof ArrayBuffer
      ? [...new Uint8Array(body)]
      : [...new Uint8Array(body.buffer, body.byteOffset, body.byteLength)]

  const bodyOf = (body, status, headers) => {
    const hasType = headers.some(([name]) => name === 'content-type')
    if (body === undefined || body === null || EMPTY_BODY_STATUSES.has(status)) return null
    if (typeof body === 'string') {
      if (!hasType) headers.push(['content-type', 'text/plain;charset=utf-8'])
      return { text: body }
    }
    if (isBytes(body)) return { bytes: bytesOf(body) }
    if (!hasType) headers.push(['content-type', 'application/json'])
    return { text: JSON.stringify(body) }
  }

  const answerOf = (source, result) => {
    const descriptor = result || {}
    const status = descriptor.status ?? 200
    const headers = Object.entries(descriptor.headers || {}).map(([name, value]) => [
      name.toLowerCase(),
      String(value),
    ])
    const body = bodyOf(descriptor.body, status, headers)
    headers.sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))
    return { verdict: { source, status, statusText: descriptor.statusText || '', headers }, body }
  }

  const answerFrom = async (entry, description) => {
    try {
      if (entry.delay) await sleep(entry.delay)
      return answerOf(entry.source, await entry.handler(description))
    } catch (error) {
      return { verdict: { source: entry.source, error: messageOf(error) }, body: null }
    }
  }

  const { entries, problems } = collectEntries()

  const answer = async (id, text) => {
    const description = JSON.parse(text)
    for (const entry of entries) {
      if (entry.route) {
        const params = entry.route(description)
        if (params) {
          reply(id, JSON.stringify(await answerFrom(entry, { ...description, params })))
          return
        }
        continue
      }
      let matched = false
      try {
        matched = await entry.match(description)
      } catch (error) {
        report(`${entry.source} match() threw: ${messageOf(error)}`)
      }
      if (matched) {
        reply(id, JSON.stringify(await answerFrom(entry, description)))
        return
      }
    }
    reply(id, JSON.stringify({ verdict: null, body: null }))
  }

  return { sources: entries.map((entry) => entry.source), problems, answer }
}
