import { assertSnapshot } from './snapshot.js'
import { entryShell, previewIdentity, renderDescription, renderSkill } from '../src/preview.js'
import { scanGroupsModule, scanPreviewSource } from '../src/preview-source.js'
import { check } from './helpers.js'

Deno.test('imp preview slices the call site of every scenario', async () => {
  const source = `import { form, select } from 'imp/std/inputs'
import { luBox, luUser } from 'imp/icons'
import { icon } from 'imp/std'
import * as fixtures from './fixtures.js'
import { mockModule } from 'imp/preview'

export const name = 'Select'
export const group = 'Inputs'
export const description = \`
  Picks one plan.

  - the **free** plan is the default
\`

mockModule('./http.js', ({ spy }) => ({ load: spy(async () => []) }))

const wrap = (...fields) => form({ initialValues: { plan: 'pro' } }, ...fields)
const plans = ['free', 'pro']
const badge = () =>
  icon(luBox, { size: 'sm' })

export const basic = wrap(select({ field: 'plan', label: 'Plan', options: plans }))
export const lazy = () => select({ field: 'plan', options: fixtures.plans, icon: badge() })
export const plain = select({ field: 'plan', label: \`Plan \${plans.length}\` })
export const arrowWithBody = () => {
  const options = plans
  return select({ field: 'plan', options })
}
export function declared() {
  return select({ field: 'plan', options: plans })
}
export const labelled = {
  scenario: 'With a placeholder',
  component: wrap(select({ field: 'plan', placeholder: 'Pick a plan', options: plans })),
}
export const labelledLazy = { scenario: 'Built at render time', component: () => select(plans) }
export const shadowed = () => {
  const plans = ['enterprise']
  return select({ field: 'plan', options: plans })
}
export { luUser as reexported }
`
  const { scenarios, declared, code } = scanPreviewSource(source)
  const report = [
    `scenarios: ${scenarios.join(', ')}`,
    `declared: ${JSON.stringify(declared)}`,
    ...scenarios.map((scenario) => `--- ${scenario}\n${code[scenario] ?? '(no code)'}`),
  ].join('\n')
  await assertSnapshot('preview-source-slices', `${report}\n`)
})

Deno.test('imp preview reads a group as a key of the groups module', () => {
  const module = `import { luBox, luUser } from 'imp/icons'

export const groups = {
  widgets: { name: 'Widgets', icon: luBox },
  people: { icon: luUser, name: "People" },
  unnamed: { icon: luBox },
}
`
  const names = scanGroupsModule(module)
  check(
    JSON.stringify([...names]) === '[["widgets","Widgets"],["people","People"],["unnamed",null]]',
    `group names read from the module: ${JSON.stringify([...names])}`,
  )
  check(scanGroupsModule('export const groups = []') === null, 'an array is not a groups object')

  const keyed = scanPreviewSource(`import { groups } from '../preview-groups.js'
export const group = groups.widgets
export const one = 1
`).declared.group
  check(
    JSON.stringify(keyed) === '{"key":"widgets","specifier":"../preview-groups.js"}',
    `a member expression on an import is a key: ${JSON.stringify(keyed)}`,
  )
  const literal = scanPreviewSource("export const group = 'Widgets'\n").declared.group
  check(
    literal.literal === 'Widgets',
    `a string is reported as a literal: ${JSON.stringify(literal)}`,
  )
  const local = scanPreviewSource('const groups = {}\nexport const group = groups.widgets\n')
    .declared.group
  check(local.specifier === null, `a local object has no specifier: ${JSON.stringify(local)}`)
})

Deno.test('imp preview renders a multiline description as markdown', () => {
  const declared = scanPreviewSource(
    'export const description = `\n  A number.\n\n  - counts up\n`\nexport const one = 1\n',
  ).declared
  check(
    declared.description === 'A number.\n\n- counts up',
    `a template literal is dedented: ${JSON.stringify(declared.description)}`,
  )
  const html = renderDescription(declared.description)
  check(html.includes('<p>A number.</p>'), `a paragraph is rendered: ${html}`)
  check(html.includes('<li>counts up</li>'), `a list is rendered: ${html}`)
  check(
    scanPreviewSource('export const description = `count: ${1}`\n').declared.description ===
      undefined,
    'a template literal with a substitution is ignored',
  )
  check(
    previewIdentity('components/counter.preview.js').description === null,
    'a preview file without a description has none',
  )
})

Deno.test('imp preview renders a sidecar to HTML with its links retargeted', () => {
  const html = renderSkill('# counter - a number\n\nSee [state](state.md) and `demo.count`.\n')
  check(html.includes('<h1>counter - a number</h1>'), `a heading is rendered: ${html}`)
  check(html.includes('state (imp skill state)'), `a subject link is retargeted: ${html}`)
  check(html.includes('<code>demo.count</code>'), `inline code is rendered: ${html}`)
})

Deno.test('imp preview frames a page with the entry file, keeping its head', () => {
  const entry = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>My previews</title>
<link rel="stylesheet" href="/fonts/inter.css">
</head>
<body>
<p>kept</p>
</body>
</html>`
  const page = entryShell(entry, 'imp preview - Widgets / Counter', '<script>preview</script>')
  check(page.includes('<title>imp preview - Widgets / Counter</title>'), 'the title is replaced')
  check(!page.includes('My previews'), 'the original title is gone')
  check(page.includes('<link rel="stylesheet" href="/fonts/inter.css">'), 'the head is kept')
  check(
    page.indexOf('<p>kept</p>') < page.indexOf('<script>preview</script>'),
    'the preview scripts land at the end of the body',
  )
  check(page.trim().endsWith('</html>'), 'the document still closes')

  const bare = entryShell('<html><head></head><body></body></html>', 't', '<script></script>')
  check(bare.includes('<head>\n<title>t</title>'), 'a missing title is added to the head')
  check(
    bare.includes('<body>\n<script></script>\n</body>'),
    'the scripts sit alone before the body close',
  )
})
