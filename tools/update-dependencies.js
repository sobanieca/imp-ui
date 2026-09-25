const { code, success } = await new Deno.Command(Deno.execPath(), {
  args: ['outdated', '--update', '--latest'],
  cwd: new URL('..', import.meta.url),
  stdout: 'inherit',
  stderr: 'inherit',
}).output()
if (!success) Deno.exit(code)
await import('./update-dprint.js')
