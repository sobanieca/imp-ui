import { join } from '@std/path'

const homeDirectory = () => Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE')

export function impCacheDirectory() {
  const override = Deno.env.get('IMP_CACHE_DIR')
  if (override) return override
  const home = homeDirectory()
  if (!home) throw new Error('cannot locate the imp cache folder - set IMP_CACHE_DIR or HOME')
  return join(home, '.imp')
}
