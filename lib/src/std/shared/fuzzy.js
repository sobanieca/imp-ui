const WORD_BOUNDARY = /[\s\-_/.:]/

const MATCH_SCORE = 10
const WORD_START_BONUS = 8
const CONSECUTIVE_BONUS = 6
const PREFIX_BONUS = 20
const MAX_SKIP_PENALTY = 4

const startsWord = (text, index) => index === 0 || WORD_BOUNDARY.test(text[index - 1])

export const normalizeQuery = (query) => String(query ?? '').toLowerCase().replace(/\s+/g, '')

export const fuzzyMatch = (text, query) => {
  const needle = normalizeQuery(query)
  if (needle === '') return { score: 0, matched: [] }
  const haystack = String(text).toLowerCase()
  const matched = []
  let score = 0
  let cursor = 0
  for (const character of needle) {
    const index = haystack.indexOf(character, cursor)
    if (index === -1) return null
    score += MATCH_SCORE
    if (startsWord(haystack, index)) score += WORD_START_BONUS
    if (index === cursor && matched.length > 0) score += CONSECUTIVE_BONUS
    score -= Math.min(index - cursor, MAX_SKIP_PENALTY)
    matched.push(index)
    cursor = index + 1
  }
  if (haystack.startsWith(needle)) score += PREFIX_BONUS
  return { score, matched }
}
