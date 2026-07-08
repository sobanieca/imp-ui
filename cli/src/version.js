import denoJson from '../../deno.json' with { type: 'json' }

export const VERSION = denoJson.version

const core = (version) =>
  (version ?? '').split('-')[0].split('.').map((part) => parseInt(part, 10) || 0)

export function isNewer(candidate, current) {
  const left = core(candidate)
  const right = core(current)
  for (let index = 0; index < 3; index++) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}
