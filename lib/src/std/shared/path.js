const SEGMENT = /^(?:[A-Za-z_$][\w$]*|0|[1-9]\d*)$/

const INDEX = /^(?:0|[1-9]\d*)$/

export const pathProblem = (path) => {
  if (typeof path !== 'string' || path === '') {
    return `must be a dot-separated field path like 'user.firstName' or 'items.0.name'`
  }
  const segments = path.split('.')
  if (segments.some((segment) => !SEGMENT.test(segment))) {
    return `'${path}' is not a dot-separated field path - write 'user.firstName' or 'items.0.name', not '${path}'`
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

const emptyFor = (segment) => (INDEX.test(segment) ? [] : {})

const withSegment = (base, segment, next) => {
  if (Array.isArray(base)) {
    const copy = [...base]
    copy[Number(segment)] = next
    return copy
  }
  return { ...base, [segment]: next }
}

export const writePath = (values, path, value) => {
  const [segment, ...rest] = path.split('.')
  const base = values === null || values === undefined ? emptyFor(segment) : values
  const existing = base[segment]
  const next =
    rest.length === 0
      ? value
      : writePath(
          existing === null || existing === undefined ? emptyFor(rest[0]) : existing,
          rest.join('.'),
          value,
        )
  if (next === existing && Object.hasOwn(base, segment)) return base
  return withSegment(base, segment, next)
}
