import { packageId } from './deps.js'

export const DEFAULT_LICENSE_POLICY = 'permissive'

const PERMISSIVE = 0
const WEAK_COPYLEFT = 1
const STRONG_COPYLEFT = 2

export const LICENSE_POLICIES = {
  'permissive': PERMISSIVE,
  'weak-copyleft': WEAK_COPYLEFT,
  'any': STRONG_COPYLEFT,
}

const TIER_NAMES = ['permissive', 'weak copyleft', 'strong copyleft']

const POLICY_ALLOWING = ['permissive', 'weak-copyleft', 'any']

const identifiers = (tier, list) => list.map((id) => [id.toLowerCase(), tier])

const LICENSE_TIERS = new Map([
  ...identifiers(PERMISSIVE, [
    '0BSD',
    'Apache-2.0',
    'Artistic-2.0',
    'BlueOak-1.0.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'BSD-3-Clause-Clear',
    'CC0-1.0',
    'CC-BY-4.0',
    'ISC',
    'MIT',
    'MIT-0',
    'PostgreSQL',
    'Python-2.0',
    'Unlicense',
    'WTFPL',
    'Zlib',
  ]),
  ...identifiers(WEAK_COPYLEFT, [
    'CDDL-1.0',
    'CDDL-1.1',
    'EPL-1.0',
    'EPL-2.0',
    'MPL-1.1',
    'MPL-2.0',
  ]),
  ...identifiers(STRONG_COPYLEFT, [
    'CC-BY-SA-4.0',
    'EUPL-1.1',
    'EUPL-1.2',
    'OSL-3.0',
    'SSPL-1.0',
  ]),
])

const FAMILY_TIERS = [
  [/^agpl-/, STRONG_COPYLEFT],
  [/^lgpl-/, WEAK_COPYLEFT],
  [/^gpl-/, STRONG_COPYLEFT],
]

const normalizeIdentifier = (identifier) => identifier.toLowerCase().replace(/\+$/, '')

function tierOfIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier)
  const known = LICENSE_TIERS.get(normalized)
  if (known !== undefined) return known
  return FAMILY_TIERS.find(([family]) => family.test(normalized))?.[1] ?? null
}

const TOKEN = /\(|\)|[^\s()]+/g

function parseFactor(tokens) {
  if (tokens[0] === '(') {
    tokens.shift()
    const node = parseExpression(tokens)
    if (tokens[0] === ')') tokens.shift()
    return node
  }
  const license = tokens.shift() ?? ''
  if (tokens[0]?.toUpperCase() === 'WITH') {
    tokens.shift()
    tokens.shift()
  }
  return { license }
}

function parseTerm(tokens) {
  const operands = [parseFactor(tokens)]
  while (tokens[0]?.toUpperCase() === 'AND') {
    tokens.shift()
    operands.push(parseFactor(tokens))
  }
  return operands.length === 1 ? operands[0] : { and: operands }
}

function parseExpression(tokens) {
  const operands = [parseTerm(tokens)]
  while (tokens[0]?.toUpperCase() === 'OR') {
    tokens.shift()
    operands.push(parseTerm(tokens))
  }
  return operands.length === 1 ? operands[0] : { or: operands }
}

function parseLicenseExpression(expression) {
  if (typeof expression !== 'string' || !expression.trim()) return null
  return parseExpression(expression.match(TOKEN) ?? [])
}

function tierOf(node) {
  if (node.license !== undefined) return tierOfIdentifier(node.license)
  const tiers = (node.or ?? node.and).map(tierOf)
  if (node.or) {
    const known = tiers.filter((tier) => tier !== null)
    return known.length ? Math.min(...known) : null
  }
  if (tiers.includes(null)) return tiers.includes(STRONG_COPYLEFT) ? STRONG_COPYLEFT : null
  return Math.max(...tiers)
}

function allowedBy(node, allowList) {
  if (node.license !== undefined) return allowList.has(normalizeIdentifier(node.license))
  const results = (node.or ?? node.and).map((operand) => allowedBy(operand, allowList))
  return node.or ? results.some(Boolean) : results.every(Boolean)
}

export const isLicenseAllowList = (policy) => Array.isArray(policy)

const describePolicy = (policy) =>
  isLicenseAllowList(policy) ? `licenses list (${policy.join(', ')})` : `'${policy}' license policy`

export function reviewLicenses(manifests, policy) {
  const allowList = isLicenseAllowList(policy) ? new Set(policy.map(normalizeIdentifier)) : null
  const allowedTier = allowList ? null : LICENSE_POLICIES[policy]
  const violations = []
  const unknown = []
  const seen = new Set()
  for (const manifest of manifests) {
    for (const entry of manifest.packages) {
      const id = packageId(entry)
      if (seen.has(id)) continue
      seen.add(id)
      const node = parseLicenseExpression(entry.license)
      if (!node) {
        unknown.push({ id, license: entry.license })
        continue
      }
      if (allowList) {
        if (!allowedBy(node, allowList)) violations.push({ id, license: entry.license, tier: null })
        continue
      }
      const tier = tierOf(node)
      if (tier === null) unknown.push({ id, license: entry.license })
      else if (tier > allowedTier) violations.push({ id, license: entry.license, tier })
    }
  }
  return { violations, unknown }
}

function resolutionHint(violations, policy) {
  if (isLicenseAllowList(policy)) {
    const missing = [...new Set(violations.map(({ license }) => license))]
    return `add ${missing.join(', ')} to 'licenses' in imp.json to allow ${
      violations.length === 1 ? 'it' : 'them'
    }`
  }
  const lowest = Math.min(...violations.map(({ tier }) => tier))
  return `set 'licenses' in imp.json to '${POLICY_ALLOWING[lowest]}' to allow ${
    violations.length === 1 ? 'it' : 'them'
  }`
}

export function licenseViolationProblem(violations, policy) {
  const lines = violations.map(({ id, license, tier }) =>
    tier === null ? `  ${id} is ${license}` : `  ${id} is ${license}, which is ${TIER_NAMES[tier]}`
  )
  return [
    `${violations.length} bundled package${
      violations.length === 1 ? ' falls' : 's fall'
    } outside the ${describePolicy(policy)}:`,
    ...lines,
    resolutionHint(violations, policy),
  ].join('\n')
}

export const unknownLicenseWarning = (unknown) =>
  `could not identify the license of ${
    unknown.map(({ id, license }) => license ? `${id} (${license})` : id).join(', ')
  } - check the terms yourself; imp cannot hold ${
    unknown.length === 1 ? 'it' : 'them'
  } to the 'licenses' policy`
