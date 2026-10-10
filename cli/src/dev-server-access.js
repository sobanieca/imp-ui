export const DEFAULT_DEV_HOST = '127.0.0.1'

const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]'])

const WELL_KNOWN_FOLDER = '.well-known'

const unbracketed = (host) => host.replace(/^\[(.*)\]$/, '$1')

const urlHostname = (host) => {
  const bare = unbracketed(host)
  return bare.includes(':') ? `[${bare}]` : bare.toLowerCase()
}

export const isLoopbackHost = (host) => {
  const bare = unbracketed(host).toLowerCase()
  return bare === 'localhost' || bare.endsWith('.localhost') || bare === '::1' ||
    /^127\.\d+\.\d+\.\d+$/.test(bare)
}

export const isWildcardHost = (host) => WILDCARD_HOSTS.has(host)

export const listenHostname = (host) => unbracketed(host ?? DEFAULT_DEV_HOST)

const interfaceAddresses = () => {
  try {
    return Deno.networkInterfaces()
  } catch {
    return []
  }
}

export function networkAddresses() {
  return interfaceAddresses()
    .filter(({ family, address }) => family === 'IPv4' && !isLoopbackHost(address))
    .map(({ address }) => address)
}

export function servedHostnames(host) {
  if (host === null || isLoopbackHost(host)) return new Set()
  if (isWildcardHost(host)) {
    return new Set(interfaceAddresses().map(({ address }) => urlHostname(address)))
  }
  return new Set([urlHostname(host)])
}

export function serverUrls(host, port, path = '/') {
  const local = `http://localhost:${port}${path}`
  if (host === null || host === DEFAULT_DEV_HOST || host === 'localhost') return [local]
  if (isWildcardHost(host)) {
    return [local, ...networkAddresses().map((address) => `http://${address}:${port}${path}`)]
  }
  return [`http://${urlHostname(host)}:${port}${path}`]
}

export const exposedHostWarning = (host) =>
  `the dev server listens on ${host} - every device on that network can read the files of this project. Use --host only on a network that you trust, and stop the server when you are done`

export const isServedHost = (url, hostnames) =>
  isLoopbackHost(url.hostname) || hostnames.has(url.hostname)

export const unknownHostResponse = (url) =>
  new Response(
    `forbidden - the dev server does not answer for the host name '${url.hostname}'; open one of the addresses that it printed, or pass that name with --host`,
    { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } },
  )

export function isOwnPageRequest(req, url) {
  const origin = req.headers.get('origin')
  if (origin !== null) return origin === url.origin
  return req.headers.get('sec-fetch-site') === 'same-origin'
}

export const isJsonRequest = (req) =>
  (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() ===
    'application/json'

export const hasHiddenSegment = (relativePath) =>
  relativePath.split(/[/\\]/).some((segment) =>
    segment.startsWith('.') && segment !== WELL_KNOWN_FOLDER
  )
