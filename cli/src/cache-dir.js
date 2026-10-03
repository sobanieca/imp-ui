import { join, resolve } from '@std/path'

export function impCacheDirectory(shellEnv = Deno.env) {
  const override = shellEnv.get('IMP_CACHE_DIR')
  if (override) return resolve(override)
  const home = shellEnv.get('HOME') ?? shellEnv.get('USERPROFILE')
  if (!home) throw new Error('cannot locate the imp cache folder - set IMP_CACHE_DIR or HOME')
  return join(home, '.imp')
}
