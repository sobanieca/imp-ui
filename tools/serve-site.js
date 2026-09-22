import { extname, fromFileUrl, join } from '@std/path'

const DIST = fromFileUrl(new URL('../site/dist', import.meta.url))
const PORT = 4507

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

const fileOf = async (pathname) => {
  const path = join(DIST, decodeURIComponent(pathname))
  const info = await Deno.stat(path).catch(() => null)
  if (info?.isFile) return path
  if (info?.isDirectory) return join(path, 'index.html')
  return null
}

Deno.serve({ port: PORT, onListen: () => {} }, async (request) => {
  const { pathname } = new URL(request.url)
  const file = await fileOf(pathname)
  if (file === null) return new Response('Not found', { status: 404 })
  const body = await Deno.readFile(file)
  return new Response(body, {
    headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' },
  })
})
console.log(`site: serving site/dist on http://localhost:${PORT}/`)
