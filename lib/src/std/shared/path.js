const SEGMENT = /^[A-Za-z_$][\w$]*$/

export const pathProblem = (path) => {
  if (typeof path !== 'string' || path === '') {
    return `must be a dot-separated field path like 'user.firstName'`
  }
  const segments = path.split('.')
  if (segments.some((segment) => !SEGMENT.test(segment))) {
    return `'${path}' is not a dot-separated field path - write 'user.firstName', not '${path}'`
  }
  return null
}

export const readPath = (values, path) => {
  let current = values
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined
    current = current[segment]
  }
  return current
}

export const writePath = (values, path, value) => {
  const [segment, ...rest] = path.split('.')
  const base = values === null || values === undefined ? {} : values
  const existing = base[segment]
  const next = rest.length === 0
    ? value
    : writePath(existing === null || existing === undefined ? {} : existing, rest.join('.'), value)
  if (next === existing && Object.hasOwn(base, segment)) return base
  return { ...base, [segment]: next }
}
