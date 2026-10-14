const RESERVED_KEYS = new Set([
  'path',
  'label',
  'description',
  'access',
  'nav',
  'group',
  'href',
  'spec',
  'toString',
])

const wordsOf = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())

const identifierOf = (words) =>
  words.map((word, index) => index === 0 ? word : word[0].toUpperCase() + word.slice(1)).join('')

const slugOf = (name, taken, fallback) => {
  let words = wordsOf(name)
  if (words.length === 0) words = [fallback]
  if (/^[0-9]/.test(words[0])) words = ['n', ...words]
  let key = identifierOf(words)
  if (RESERVED_KEYS.has(key)) {
    words = [...words, 'item']
    key = identifierOf(words)
  }
  let suffix = 1
  let candidate = key
  while (taken.has(candidate)) {
    suffix++
    candidate = `${key}${suffix}`
  }
  taken.add(candidate)
  const segment = candidate === key ? words.join('-') : `${words.join('-')}-${suffix}`
  return { key: candidate, segment }
}

export const previewSlugs = (catalog) => {
  const groupKeys = new Set()
  const groups = new Map()
  const slugs = new Map()
  for (const entry of catalog) {
    if (!groups.has(entry.group)) {
      groups.set(entry.group, { ...slugOf(entry.group, groupKeys, 'group'), taken: new Set() })
    }
    const group = groups.get(entry.group)
    const own = slugOf(entry.name, group.taken, 'preview')
    slugs.set(entry.file, {
      groupKey: group.key,
      groupSegment: group.segment,
      key: own.key,
      segment: own.segment,
    })
  }
  return slugs
}

export const previewHref = (slug) => `/${slug.groupSegment}/${slug.segment}`
