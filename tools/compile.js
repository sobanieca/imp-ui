const BINARY = Deno.build.os === 'windows' ? 'imp.exe' : 'imp'

const STAMP = `${BINARY}.stamp`

export async function gitVisibleFiles(cwd = Deno.cwd()) {
  const { success, stdout } = await new Deno.Command('git', {
    args: ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    cwd,
    stdout: 'piped',
    stderr: 'inherit',
  }).output()
  if (!success) {
    console.error('error: git ls-files failed - compile.js must run inside the imp git repo')
    Deno.exit(1)
  }
  return new TextDecoder().decode(stdout).split('\0').filter(Boolean).sort()
}

export async function treeStamp(cwd = Deno.cwd()) {
  const lines = []
  for (const file of await gitVisibleFiles(cwd)) {
    const info = await Deno.stat(`${cwd}/${file}`).catch(() => null)
    lines.push(info ? `${file}\0${info.mtime?.getTime() ?? 0}\0${info.size}` : `${file}\0missing`)
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(lines.join('\n')))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function binaryIsFresh() {
  const binary = await Deno.stat(BINARY).catch(() => null)
  if (!binary) return false
  const recorded = await Deno.readTextFile(STAMP).catch(() => null)
  return recorded?.trim() === await treeStamp()
}

async function run(...args) {
  const { code, success } = await new Deno.Command(Deno.execPath(), {
    args,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output()
  if (!success) Deno.exit(code)
}

if (import.meta.main) {
  const option = (name) => {
    const index = Deno.args.indexOf(`--${name}`)
    return index === -1 ? null : Deno.args[index + 1] ?? null
  }

  const target = option('target')
  const output = option('output')
  if ((target === null) !== (output === null)) {
    console.error(
      'error: --target and --output go together, as in --target <triple> --output <file>',
    )
    Deno.exit(1)
  }

  if (target === null && !Deno.args.includes('--force') && await binaryIsFresh()) {
    console.log(`${BINARY} is up to date - skipping compile (pass --force to recompile)`)
    Deno.exit(0)
  }

  await run('run', '-A', 'tools/download-fmt-plugins.js')
  await run('run', '-A', 'tools/prebundle-npm-deps.js')
  const stamp = await treeStamp()
  const librarySources = (await gitVisibleFiles()).filter((file) =>
    file.startsWith('lib/src/') && !file.startsWith('lib/src/public/')
  )

  await run(
    'compile',
    '-A',
    '--include',
    'cli/src',
    ...librarySources.flatMap((file) => ['--include', file]),
    '--include',
    'skills',
    '--include',
    'THIRD-PARTY-LICENSES.md',
    '--include',
    'LICENSE',
    ...(target === null ? ['-o', 'imp'] : ['--target', target, '-o', output]),
    'cli/src/main.js',
  )

  if (target === null) await Deno.writeTextFile(STAMP, `${stamp}\n`)
}
