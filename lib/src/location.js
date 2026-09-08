const normalizeBase = (value) => {
  if (!value || value === '/') return ''
  const leading = value.startsWith('/') ? value : `/${value}`
  return leading.endsWith('/') ? leading.slice(0, -1) : leading
}

const basePath = () => normalizeBase(globalThis.__IMP_ENV__?.IMP_BASEPATH ?? '')

export const stripBase = (pathname) => {
  const base = basePath()
  return base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || '/'
    : pathname
}

export const url = (path) => {
  const base = basePath()
  return base && path.startsWith('/') ? base + path : path
}

export const segmentsOf = (path) => path.split('/').filter(Boolean)
