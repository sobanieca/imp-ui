import { fromFileUrl, join } from '@std/path'

const ROOT = fromFileUrl(new URL('..', import.meta.url))
export const IMP_BINARY = join(ROOT, Deno.build.os === 'windows' ? 'imp.exe' : 'imp')

export const compileImp = async () => {
  const { code, success } = await new Deno.Command(Deno.execPath(), {
    args: ['run', '-A', 'tools/compile.js'],
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output()
  if (!success) Deno.exit(code)
}

export const runImp = async (args, cwd = Deno.cwd()) => {
  await compileImp()
  const { code } = await new Deno.Command(IMP_BINARY, {
    args,
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).output()
  return code
}

if (import.meta.main) Deno.exit(await runImp(Deno.args))
