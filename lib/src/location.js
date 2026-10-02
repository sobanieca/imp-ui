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

const carriesBase = (path, base) =>
  path === base || ['/', '?', '#'].some((separator) => path.startsWith(base + separator))

export const url = (path) => {
  if (!path.startsWith('/')) return path
  if (hashRouting()) return `#${path}`
  const base = basePath()
  return base && !carriesBase(path, base) ? base + path : path
}

const firstValues = (searchParams) => {
  const query = {}
  for (const [key, value] of searchParams) {
    if (!Object.hasOwn(query, key)) query[key] = value
  }
  return query
}

const routeWith = (path, search) => {
  const searchParams = new URLSearchParams(search)
  return { path, query: firstValues(searchParams), searchParams }
}

const routeOfFragment = (fragment) => {
  const separator = fragment.indexOf('?')
  const path = separator === -1 ? fragment : fragment.slice(0, separator)
  const search = separator === -1 ? '' : fragment.slice(separator + 1)
  return routeWith(path.startsWith('/') ? path : `/${path}`, search)
}

export const routeOf = (href) => {
  const location = new URL(href)
  if (hashRouting()) return routeOfFragment(location.hash.slice(1))
  return routeWith(stripBase(location.pathname), location.search)
}

export const currentRoute = () => routeOf(globalThis.location.href)

export const sameRoute = (one, other) =>
  one.path === other.path && one.searchParams.toString() === other.searchParams.toString()

export const segmentsOf = (path) => path.split('/').filter(Boolean)
