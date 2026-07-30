function normalizeBasePath(value) {
  if (value === undefined || value === null) return ''
  const text = String(value)
  if (!text || text === '/') return ''
  const leading = text.startsWith('/') ? text : `/${text}`
  return leading.endsWith('/') ? leading.slice(0, -1) : leading
}

export const basePathOf = (env) => normalizeBasePath(env?.IMP_BASEPATH)

export const siteUrl = (base, path) => `${base}/${path}`
