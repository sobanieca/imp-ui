export const mockRuntime = ({ modules, files, reply, report }) => {
  const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const messageOf = (error) => String(error?.message || error)

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
        if (typeof entry?.match !== 'function' || typeof entry?.handler !== 'function') {
          problems.push(`${source} must be { match, handler }, both functions`)
          return []
        }
        return [{ match: entry.match, handler: entry.handler, delay: entry.delay ?? 0, source }]
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
