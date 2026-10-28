import { component, mount } from 'imp'
import { markdown } from 'imp/std/display'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const stateHost = component('markdown-state-host', { setup: (self, render) => render(self) })

beforeEach(() => {
  document.body.replaceChildren()
})

test('markdown renders headings, marks and inline code', () => {
  const host = mounted(markdown({ text: '# Title\n\nA **bold** word and `code`.' }))
  expect(host.localName).toEqual('imp-markdown')
  expect(inner(host, 'h1').textContent).toEqual('Title')
  expect(inner(host, 'strong').textContent).toEqual('bold')
  expect(inner(host, 'code').textContent).toEqual('code')
})

test('markdown renders lists, quotes, rules and fenced code', () => {
  const host = mounted(
    markdown({
      text: '- one\n- two\n\n> quoted\n\n---\n\n```js\nconst a = 1\n```',
    }),
  )
  expect(all(host, 'ul > li').map((item) => item.textContent)).toEqual(['one', 'two'])
  expect(inner(host, 'blockquote').textContent).toEqual('quoted')
  expect(inner(host, 'hr')).toBeTruthy()
  expect(inner(host, 'pre').textContent).toEqual('const a = 1')
  expect(inner(host, 'pre').dataset.language).toEqual('js')
})

test('markdown keeps a safe link and drops a script address', () => {
  const host = mounted(
    markdown({
      text: '[home](https://imp.dev) and [bad](javascript:alert(1))',
    }),
  )
  const links = all(host, 'a')
  expect(links.length).toEqual(1)
  expect(links[0].getAttribute('href')).toEqual('https://imp.dev')
  expect(inner(host, '.prose').textContent).toContain('bad')
})

test('markdown drops a script address that hides its scheme behind a space or a tab', () => {
  const host = mounted(
    markdown({
      text: '[a]( javascript:alert(1)) [b](java\tscript:alert(1)) [c](docs/page)',
    }),
  )
  const links = all(host, 'a')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['docs/page'])
})

test('markdown never treats the text as HTML', () => {
  const host = mounted(markdown({ text: 'before <script>window.stolen = 1</script> after' }))
  expect(inner(host, 'script')).toEqual(null)
  expect(globalThis.stolen).toEqual(undefined)
})

test('markdown follows a state', () => {
  let notes = null
  const host = mounted(
    stateHost((self) => {
      notes = initState(self, 'markdown.notes', '# First')
      return markdown({ text: notes })
    }),
  )
  const prose = host.shadowRoot.querySelector('imp-markdown')
  expect(prose.shadowRoot.querySelector('h1').textContent).toEqual('First')
  notes.set('- one\n- two')
  expect(prose.shadowRoot.querySelector('h1')).toEqual(null)
  expect([...prose.shadowRoot.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
    'one',
    'two',
  ])
})

test('markdown warns about a child and about a text that is not a string', () => {
  const warn = warnings()
  mounted(markdown({ text: 42 }, 'child'))
  expect(warned(warn, "takes no children - pass the markdown as the 'text' prop")).toEqual(true)
  expect(warned(warn, "'text' must be a string")).toEqual(true)
})

test('markdown with no text renders empty prose', () => {
  const host = mounted(markdown())
  expect(inner(host, '.prose').childNodes.length).toEqual(0)
})

test('a message renders bold, italic, strikethrough and links, and every other construct as text', () => {
  const host = mounted(
    markdown({
      format: 'message',
      text: '# Not a heading\n**bold** _it_ ~~gone~~ `tick` ![pic](https://imp.dev/a.png)\n\n- not a list',
    }),
  )
  expect(all(host, '.prose > p').length).toEqual(2)
  expect(inner(host, 'h1')).toEqual(null)
  expect(inner(host, 'ul')).toEqual(null)
  expect(inner(host, 'code')).toEqual(null)
  expect(inner(host, 'img')).toEqual(null)
  expect(inner(host, 'strong').textContent).toEqual('bold')
  expect(inner(host, 'em').textContent).toEqual('it')
  expect(inner(host, 's').textContent).toEqual('gone')
  expect(all(host, 'p')[0].textContent).toEqual('# Not a headingbold it gone `tick` !pic')
  expect(all(host, 'p')[0].querySelectorAll('br').length).toEqual(1)
  expect(all(host, 'p')[1].textContent).toEqual('- not a list')
})

test('a message link opens in a new tab, names its address, and sends no referrer', () => {
  const host = mounted(
    markdown({
      format: 'message',
      text: '[pricing](https://example.com/pricing) [bad](javascript:alert(1)) [data](data:text/html,x)',
    }),
  )
  const links = all(host, 'a')
  expect(links.length).toEqual(1)
  expect(links[0].getAttribute('href')).toEqual('https://example.com/pricing')
  expect(links[0].getAttribute('target')).toEqual('_blank')
  expect(links[0].getAttribute('rel')).toEqual('noopener noreferrer nofollow ugc')
  expect(links[0].getAttribute('title')).toEqual('https://example.com/pricing')
  expect(inner(host, 'p').textContent).toEqual('pricing bad data')
})

test('markdown warns about an unknown format and renders a document', () => {
  const warn = warnings()
  const host = mounted(markdown({ format: 'chat', text: '# Title' }))
  expect(warned(warn, "markdown: 'format' must be one of")).toBeTruthy()
  expect(inner(host, 'h1').textContent).toEqual('Title')
})
