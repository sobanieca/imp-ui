const BINARY = Deno.build.os === 'windows' ? 'imp.exe' : 'imp'

async function gitVisibleFiles() {
  const { success, stdout } = await new Deno.Command('git', {
    args: ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    stdout: 'piped',
    stderr: 'inherit',
  }).output()
  if (!success) {
    console.error('error: git ls-files failed — compile.js must run inside the imp git repo')
    Deno.exit(1)
  }
  return new TextDecoder().decode(stdout).split('\0').filter(Boolean)
}

async function newestOf(files) {
  let newest = 0
  for (const file of files) {
    const info = await Deno.stat(file).catch(() => null)
    newest = Math.max(newest, info?.mtime?.getTime() ?? 0)
  }
  return newest
}

async function binaryIsFresh() {
  const binary = await Deno.stat(BINARY).catch(() => null)
  if (!binary) return false
  const builtAt = binary.mtime?.getTime() ?? 0
  return await newestOf(await gitVisibleFiles()) <= builtAt
}

async function run(...args) {
  const { code, success } = await new Deno.Command(Deno.execPath(), {
    args,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output()
  if (!success) Deno.exit(code)
}

if (!Deno.args.includes('--force') && await binaryIsFresh()) {
  console.log(`${BINARY} is up to date — skipping compile (pass --force to recompile)`)
  Deno.exit(0)
}

await run('run', '-A', 'tools/download_fmt_plugins.js')
await run('run', '-A', 'tools/prebundle_npm_deps.js')
await run(
  'compile',
  '-A',
  '--include',
  'cli/src',
  '--include',
  'lib/src',
  '--include',
  'THIRD_PARTY_LICENSES.md',
  '-o',
  'imp',
  'cli/src/main.js',
)
