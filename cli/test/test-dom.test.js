import { join, toFileUrl } from '@std/path'
import { check, ROOT } from './helpers.js'

const TEST_DOM = toFileUrl(join(ROOT, 'src', 'test-dom.js')).href

const probe = `
const { installDomEnvironment } = await import(${JSON.stringify(TEST_DOM)})
const restore = installDomEnvironment()
const calls = []
new MutationObserver(() => calls.push('lang')).observe(document.documentElement, { attributes: true })
await new Promise((resolve) => setTimeout(resolve))
globalThis.gc()
await new Promise((resolve) => setTimeout(resolve))
document.documentElement.setAttribute('lang', 'pl')
await new Promise((resolve) => setTimeout(resolve))
console.log(JSON.stringify(calls))
await restore()
`

Deno.test('a MutationObserver of a unit test survives garbage collection', async () => {
  const { stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: ['eval', '--no-lock', '--v8-flags=--expose-gc', probe],
    stdout: 'piped',
    stderr: 'piped',
  }).output()
  const output = new TextDecoder().decode(stdout).trim()
  check(
    output === '["lang"]',
    `expected the observer to see the change, got '${output}' ${new TextDecoder().decode(stderr)}`,
  )
})
