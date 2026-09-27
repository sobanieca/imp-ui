const normalizeBase = (value) => {
  if (!value || value === '/') return ''
  const leading = value.startsWith('/') ? value : `/${value}`
  return leading.endsWith('/') ? leading.slice(0, -1) : leading
}

const basePath = () => normalizeBase(globalThis.__IMP_ENV__?.IMP_BASEPATH ?? '')

const hashRouting = () => globalThis.__IMP_ENV__?.IMP_ROUTING === 'hash'

const stripBase = (pathname) => {
  const base = basePath()
  return base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || '/'
    : pathname
}

export const url = (path) => {
  if (!path.startsWith('/')) return path
  if (hashRouting()) return `#${path}`
  const base = basePath()
  return base ? base + path : path
}

const queryOf = (search) => Object.fromEntries(new URLSearchParams(search))

const routeOfFragment = (fragment) => {
  const separator = fragment.indexOf('?')
  const path = separator === -1 ? fragment : fragment.slice(0, separator)
  const search = separator === -1 ? '' : fragment.slice(separator + 1)
  return { path: path.startsWith('/') ? path : `/${path}`, query: queryOf(search) }
}

export const routeOf = (href) => {
  const location = new URL(href)
  if (hashRouting()) return routeOfFragment(location.hash.slice(1))
  return { path: stripBase(location.pathname), query: queryOf(location.search) }
}

export const currentRoute = () => routeOf(globalThis.location.href)

export const sameRoute = (one, other) => {
  if (one.path !== other.path) return false
  const keys = Object.keys(one.query)
  return keys.length === Object.keys(other.query).length &&
    keys.every((key) => one.query[key] === other.query[key])
}

export const segmentsOf = (path) => path.split('/').filter(Boolean)
