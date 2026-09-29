import { component, mount } from 'imp'
import { codeBlock } from 'imp/std/display'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { settled } from './shadow.js'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const deep = (root, selector) => {
  const scope = root.shadowRoot ?? root
  const found = scope.querySelector(selector)
  if (found !== null) return found
  for (const child of scope.querySelectorAll('*')) {
    const nested = child.shadowRoot ? deep(child, selector) : null
    if (nested !== null) return nested
  }
  return null
}

const lines = (host) => all(host, '.line')

const tokens = (host, type) => all(host, `.token-${type}`).map((node) => node.textContent)

const click = (node, init = {}) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const clearHash = () => globalThis.history.replaceState(null, '', location.pathname)

const stateHost = component('code-state-host', { setup: (self, render) => render(self) })

const SOURCE = `
// greet
const greet = (name) => \`Hello \${name}\`
greet('imp', 42)
`

beforeEach(() => {
  document.body.replaceChildren()
  clearHash()
})

test('codeBlock renders a pre with one span per line and the exact text', () => {
  const host = mounted(codeBlock({ language: 'js', code: SOURCE }))
  expect(host.localName).toEqual('imp-code-block')
  const listing = inner(host, 'pre > code')
  expect(lines(host).length).toEqual(3)
  expect(listing.textContent).toEqual(SOURCE.slice(1, -1))
})

test('codeBlock highlights comments, keywords, strings, numbers and calls', () => {
  const host = mounted(codeBlock({ language: 'js', code: SOURCE }))
  expect(tokens(host, 'comment')).toEqual(['// greet'])
  expect(tokens(host, 'keyword')).toEqual(['const'])
  expect(tokens(host, 'string')).toEqual(['`Hello ${name}`', "'imp'"])
  expect(tokens(host, 'number')).toEqual(['42'])
  expect(tokens(host, 'function')).toEqual(['greet'])
})

test('codeBlock takes the usual short names of a language', () => {
  const host = mounted(codeBlock({ language: 'sh', code: 'echo "$HOME" # home' }))
  expect(tokens(host, 'function')).toEqual(['echo'])
  expect(tokens(host, 'variable')).toEqual(['$HOME'])
  expect(tokens(host, 'comment')).toEqual(['# home'])
})

test('an unknown language is logged and shown as plain text', () => {
  const warn = warnings()
  const host = mounted(codeBlock({ language: 'klingon', code: 'const x = 1' }))
  expect(warned(warn, "unknown language 'klingon'")).toBeTruthy()
  expect(all(host, '[class^="token-"]').length).toEqual(0)
  expect(inner(host, 'code').textContent).toEqual('const x = 1')
})

test('codeBlock without a language shows plain text', () => {
  const host = mounted(codeBlock({ code: 'const x = 1' }))
  expect(all(host, '[class^="token-"]').length).toEqual(0)
})

test('html highlights tags, attributes and the code inside script and style', () => {
  const source = '<style>a { color: red }</style>\n<a href="/x">Go</a>\n<script>let n = 1</script>'
  const host = mounted(codeBlock({ language: 'html', code: source }))
  expect(tokens(host, 'tag')).toEqual(['style', 'a', 'style', 'a', 'a', 'script', 'script'])
  expect(tokens(host, 'attribute')).toEqual(['href'])
  expect(tokens(host, 'string')).toEqual(['"/x"'])
  expect(tokens(host, 'property')).toEqual(['color'])
  expect(tokens(host, 'keyword')).toEqual(['let'])
})

test('json keys are properties and yaml keys too', () => {
  const json = mounted(codeBlock({ language: 'json', code: '{ "port": 4516, "open": true }' }))
  expect(tokens(json, 'property')).toEqual(['"port"', '"open"'])
  expect(tokens(json, 'number')).toEqual(['4516'])
  expect(tokens(json, 'literal')).toEqual(['true'])
  const yaml = mounted(codeBlock({ language: 'yaml', code: 'server:\n  port: 4516\n  - name: x' }))
  expect(tokens(yaml, 'property')).toEqual(['server', 'port', 'name'])
})

test('markdown highlights a fenced block in the language of its fence', () => {
  const host = mounted(codeBlock({ language: 'md', code: '# Title\n\n```js\nconst a = 1\n```' }))
  expect(tokens(host, 'title')).toEqual(['# Title'])
  expect(tokens(host, 'keyword')).toEqual(['const'])
  expect(tokens(host, 'attribute')).toEqual(['js'])
})

test('diff marks added and removed lines', () => {
  const host = mounted(codeBlock({ language: 'diff', code: '@@ -1 +1 @@\n-old\n+new\n same' }))
  expect(tokens(host, 'deleted')).toEqual(['-old'])
  expect(tokens(host, 'inserted')).toEqual(['+new'])
  expect(tokens(host, 'title')).toEqual(['@@ -1 +1 @@'])
})

test('a block comment spans lines and stays one colour', () => {
  const host = mounted(codeBlock({ language: 'css', code: '/* a\n   b */\n.x { margin: 0 }' }))
  expect(tokens(host, 'comment')).toEqual(['/* a', '   b */'])
  expect(tokens(host, 'type')).toEqual(['.x'])
  expect(tokens(host, 'property')).toEqual(['margin'])
})

test('codeBlock drops one line break at each end and nothing else', () => {
  const host = mounted(codeBlock({ code: '\n  indented\n\n' }))
  expect(inner(host, 'code').textContent).toEqual('  indented\n')
  expect(lines(host).length).toEqual(2)
})

test('codeBlock has no line numbers unless asked', () => {
  const plain = mounted(codeBlock({ language: 'js', code: SOURCE }))
  expect(all(plain, '.number').length).toEqual(0)
  const numbered = mounted(codeBlock({ language: 'js', lineNumbers: true, code: SOURCE }))
  const anchors = all(numbered, '.number')
  expect(anchors.length).toEqual(3)
  expect(anchors.map((anchor) => anchor.getAttribute('href'))).toEqual(['#L1', '#L2', '#L3'])
  expect(anchors[1].getAttribute('aria-label')).toEqual('Line 2')
  expect(anchors.every((anchor) => anchor.textContent === '')).toBeTruthy()
})

test('an id prefixes the line fragments', () => {
  const host = mounted(codeBlock({ lineNumbers: true, id: 'install', code: 'a\nb' }))
  expect(all(host, '.number').map((anchor) => anchor.getAttribute('href')))
    .toEqual(['#install-L1', '#install-L2'])
})

test('a click on a line number selects the line and writes it into the address', () => {
  const host = mounted(codeBlock({ lineNumbers: true, code: 'a\nb\nc' }))
  const [first, second, third] = all(host, '.number')
  click(second)
  expect(location.hash).toEqual('#L2')
  expect(lines(host).map((line) => line.classList.contains('selected'))).toEqual([
    false,
    true,
    false,
  ])
  expect(second.getAttribute('aria-current')).toEqual('true')
  expect(first.hasAttribute('aria-current')).not.toBeTruthy()
  click(third)
  expect(location.hash).toEqual('#L3')
  expect(lines(host).map((line) => line.classList.contains('selected'))).toEqual([
    false,
    false,
    true,
  ])
})

test('a shift-click extends the selection to a range', () => {
  const host = mounted(codeBlock({ lineNumbers: true, id: 'x', code: 'a\nb\nc\nd' }))
  const anchors = all(host, '.number')
  click(anchors[3])
  click(anchors[1], { shiftKey: true })
  expect(location.hash).toEqual('#x-L2-L4')
  expect(lines(host).map((line) => line.classList.contains('selected'))).toEqual([
    false,
    true,
    true,
    true,
  ])
})

test('a block opened with a line fragment highlights those lines', () => {
  globalThis.history.replaceState(null, '', '#L2-L3')
  const host = mounted(codeBlock({ lineNumbers: true, code: 'a\nb\nc\nd' }))
  expect(lines(host).map((line) => line.classList.contains('selected'))).toEqual([
    false,
    true,
    true,
    false,
  ])
})

test('a fragment for another block selects nothing here', () => {
  globalThis.history.replaceState(null, '', '#other-L1')
  const host = mounted(codeBlock({ lineNumbers: true, id: 'mine', code: 'a\nb' }))
  expect(lines(host).some((line) => line.classList.contains('selected'))).not.toBeTruthy()
  const anonymous = mounted(codeBlock({ lineNumbers: true, code: 'a\nb' }))
  expect(lines(anonymous).some((line) => line.classList.contains('selected'))).not.toBeTruthy()
})

test('a malformed escape in the fragment selects nothing and throws nothing', () => {
  globalThis.history.replaceState(null, '', '#%E0')
  const host = mounted(codeBlock({ lineNumbers: true, code: 'a\nb' }))
  expect(lines(host).some((line) => line.classList.contains('selected'))).not.toBeTruthy()
  globalThis.history.replaceState(null, '', '#L1%E0')
  const other = mounted(codeBlock({ lineNumbers: true, code: 'a\nb' }))
  expect(lines(other).some((line) => line.classList.contains('selected'))).not.toBeTruthy()
  click(all(host, '.number')[1])
  expect(location.hash).toEqual('#L2')
  expect(lines(host)[1].classList.contains('selected')).toBeTruthy()
})

test('a fragment with an escaped id selects the lines of that block', () => {
  globalThis.history.replaceState(null, '', `#${encodeURIComponent('\u017c\u00f3\u0142w')}-L2`)
  const host = mounted(codeBlock({ lineNumbers: true, id: '\u017c\u00f3\u0142w', code: 'a\nb' }))
  expect(lines(host).map((line) => line.classList.contains('selected'))).toEqual([false, true])
})

test('a selection in one block clears the selection in another', () => {
  const first = mounted(codeBlock({ lineNumbers: true, id: 'one', code: 'a\nb' }))
  const second = mounted(codeBlock({ lineNumbers: true, id: 'two', code: 'a\nb' }))
  click(all(first, '.number')[0])
  expect(lines(first)[0].classList.contains('selected')).toBeTruthy()
  click(all(second, '.number')[1])
  expect(location.hash).toEqual('#two-L2')
  expect(lines(first).some((line) => line.classList.contains('selected'))).not.toBeTruthy()
  expect(lines(second)[1].classList.contains('selected')).toBeTruthy()
})

test('the copy button copies the whole code and says so for a moment', async () => {
  const written = []
  const clipboard = { writeText: (text) => (written.push(text), Promise.resolve()) }
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
  const host = mounted(codeBlock({ language: 'js', lineNumbers: true, code: SOURCE }))
  const control = deep(host, 'button')
  expect(control.getAttribute('aria-label')).toEqual('Copy code')
  click(control)
  await settled()
  await settled()
  expect(written).toEqual([SOURCE.slice(1, -1)])
  expect(control.getAttribute('aria-label')).toEqual('Copied')
  expect(inner(host, '[role="status"]').textContent).toEqual('Copied')
})

test('a state as the code re-renders the lines in place', () => {
  let source
  const host = mounted(stateHost((self) => {
    source = initState(self, 'demo.source', 'let a = 1')
    return codeBlock({ language: 'js', code: source })
  }))
  const block = host.shadowRoot.querySelector('imp-code-block')
  expect(lines(block).length).toEqual(1)
  expect(tokens(block, 'keyword')).toEqual(['let'])
  source.set('const a = 1\nconst b = 2')
  expect(lines(block).length).toEqual(2)
  expect(tokens(block, 'keyword')).toEqual(['const', 'const'])
})

test('a label names the block as a figure', () => {
  const host = mounted(codeBlock({ label: 'imp.json', code: '{}' }))
  const block = inner(host, 'figure')
  expect(block.getAttribute('aria-label')).toEqual('imp.json')
  expect(inner(mounted(codeBlock({ code: '{}' })), 'figure').hasAttribute('aria-label')).not
    .toBeTruthy()
})

test('codeBlock warns about an unknown prop', () => {
  const warn = warnings()
  mounted(codeBlock({ wrap: true, code: 'x' }))
  expect(warned(warn, "unknown prop 'wrap'")).toBeTruthy()
})
