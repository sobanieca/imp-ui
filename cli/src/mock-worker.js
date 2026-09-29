const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const messageOf = (error) => String(error?.message || error)

let entries = []

function collectEntries(modules, files) {
  const problems = []
  const collected = modules.flatMap((module, fileIndex) => {
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
  return { entries: collected, problems }
}

const isRawBody = (body) =>
  body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body) ||
  body instanceof FormData || body instanceof URLSearchParams || body instanceof ReadableStream

function mockResponse(result) {
  if (result instanceof Response) return result
  const descriptor = result || {}
  const status = descriptor.status ?? 200
  const headers = new Headers(descriptor.headers || {})
  let body = descriptor.body
  if (body === undefined || body === null || EMPTY_BODY_STATUSES.has(status)) {
    body = null
  } else if (typeof body === 'string') {
    if (!headers.has('content-type')) headers.set('content-type', 'text/plain;charset=utf-8')
  } else if (!isRawBody(body)) {
    body = JSON.stringify(body)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  }
  return new Response(body, { status, statusText: descriptor.statusText || '', headers })
}

async function load({ id, url, files }) {
  try {
    const { default: modules } = await import(url)
    const collected = collectEntries(modules, files)
    entries = collected.entries
    const ready = mockResponse({ body: {} }).body
    self.postMessage({
      id,
      sources: entries.map((entry) => entry.source),
      problems: collected.problems,
      body: ready,
    }, [ready])
  } catch (error) {
    self.postMessage({ id, sources: [], problems: [`evaluation failed - ${messageOf(error)}`] })
  }
}

async function answerFrom(entry, description) {
  try {
    if (entry.delay) await sleep(entry.delay)
    const response = mockResponse(await entry.handler(description))
    return {
      verdict: {
        source: entry.source,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers],
      },
      body: response.body,
    }
  } catch (error) {
    return { verdict: { source: entry.source, error: messageOf(error) }, body: null }
  }
}

async function answer({ id, description }) {
  for (const entry of entries) {
    let matched = false
    try {
      matched = await entry.match(description)
    } catch (error) {
      self.postMessage({ problem: `${entry.source} match() threw: ${messageOf(error)}` })
    }
    if (matched) {
      const { verdict, body } = await answerFrom(entry, description)
      self.postMessage({ id, verdict, body }, body ? [body] : [])
      return
    }
  }
  self.postMessage({ id, verdict: null, body: null })
}

self.onmessage = ({ data }) => data.url ? load(data) : answer(data)
