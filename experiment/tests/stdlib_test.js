import { fire, mount, withLocale } from '../imp/testing.js'
import { assert, assertEquals } from 'jsr:@std/assert@^1'
import { div, setLocale, signal } from '../imp/imp.js'
import {
  alert,
  avatar,
  badge,
  breadcrumbs,
  card,
  checkbox,
  dataTable,
  formBox,
  listView,
  modal,
  pagination,
  progressBar,
  row,
  selectBox,
  stack,
  switchToggle,
  tabs,
  textField,
  tree,
} from '../stdlib/index.js'

Deno.test('layout: stack/row render children with gap', () => {
  const view = mount(() => stack({ gap: 'sm' }, [row(['a', 'b']), 'c']))
  assertEquals(view.el.textContent, 'abc')
  assertEquals(view.el.firstChild.style.getPropertyValue('gap'), 'var(--imp-space-8)')
  view.unmount()
})

Deno.test('display: card title, badge kind, avatar initials', () => {
  const view = mount(() =>
    div([
      card({ title: 'Stats' }, 'body'),
      badge({ kind: 'danger' }, 'hot'),
      avatar({ name: 'Ada Lovelace' }),
    ])
  )
  assertEquals(view.query('h3').textContent, 'Stats')
  assertEquals(view.query('[data-kind="danger"]').textContent, 'hot')
  assert(view.el.textContent.includes('AL'))
  view.unmount()
})

Deno.test('inputs: textField two-way binds a signal', () => {
  const draft = signal('start')
  const view = mount(() => textField({ label: 'Name', value: draft }))
  const inp = view.query('input')
  assertEquals(inp.value, 'start')
  draft.set('from signal')
  assertEquals(inp.value, 'from signal')
  inp.value = 'typed'
  fire(inp, 'input')
  assertEquals(draft(), 'typed')
  view.unmount()
})

Deno.test('inputs: checkbox and switchToggle bind checked', () => {
  const on = signal(false)
  const view = mount(() =>
    div([checkbox({ label: 'A', checked: on }), switchToggle({ checked: on })])
  )
  const [a, b] = view.queryAll('input')
  assertEquals(a.checked, false)
  on.set(true)
  assertEquals(a.checked, true)
  assertEquals(b.checked, true)
  a.checked = false
  fire(a, 'change')
  assertEquals(on(), false)
  view.unmount()
})

Deno.test('inputs: selectBox options and binding', () => {
  const pick = signal('b')
  const view = mount(() => selectBox({ options: ['a', 'b', 'c'], value: pick }))
  const sel = view.query('select')
  assertEquals(view.queryAll('option').length, 3)
  const selected = view.queryAll('option').find((o) => o.selected)
  assertEquals(selected.value, 'b')
  sel.value = 'c'
  fire(sel, 'change')
  assertEquals(pick(), 'c')
  view.unmount()
})

Deno.test('inputs: formBox prevents default submit and calls handler', () => {
  let submitted = 0
  const view = mount(() => formBox({ events: { submit: () => submitted++ } }, textField({})))
  fire(view.query('form'), 'submit')
  assertEquals(submitted, 1)
  view.unmount()
})

Deno.test('feedback: alert kinds, progressBar reactive width', () => {
  const pct = signal(25)
  const view = mount(() =>
    div([
      alert({ kind: 'warning' }, 'careful'),
      progressBar({ value: pct }),
    ])
  )
  assert(view.query('[role="alert"][data-kind="warning"]'))
  const fill = view.query('[role="progressbar"] > div')
  assertEquals(fill.style.getPropertyValue('inline-size'), '25%')
  pct.set(80)
  assertEquals(fill.style.getPropertyValue('inline-size'), '80%')
  view.unmount()
})

Deno.test('feedback: modal opens/closes via its open signal', () => {
  const open = signal(false)
  const view = mount(() => div(modal({ open, title: 'Hi' }, 'modal body')))
  assertEquals(view.query('[role="dialog"]'), null)
  open.set(true)
  assert(view.query('[role="dialog"]'))
  fire(view.query('[aria-label]'), 'click') // × button
  assertEquals(open(), false)
  assertEquals(view.query('[role="dialog"]'), null)
  view.unmount()
})

Deno.test('navigation: tabs switch content lazily', () => {
  const view = mount(() =>
    tabs({
      tabs: [
        { id: 'one', label: 'One', content: () => div('first') },
        { id: 'two', label: 'Two', content: () => div('second') },
      ],
    })
  )
  assert(view.el.textContent.includes('first'))
  assert(!view.el.textContent.includes('second'))
  fire(view.queryAll('[role="tab"]')[1], 'click')
  assert(view.el.textContent.includes('second'))
  view.unmount()
})

Deno.test('navigation: pagination clamps and localizes', async () => {
  setLocale('en')
  const page = signal(1)
  const view = mount(() => pagination({ page, pages: 3 }))
  assert(view.el.textContent.includes('Page 1 of 3'))
  const [prev, next] = view.queryAll('button')
  assertEquals(prev.disabled, true)
  fire(next, 'click')
  fire(next, 'click')
  assertEquals(page(), 3)
  assertEquals(next.disabled, true)
  view.unmount()
})

Deno.test('navigation: breadcrumbs marks the current page', () => {
  const view = mount(() =>
    breadcrumbs({
      items: [
        { label: 'Home', href: '/' },
        { label: 'Settings' },
      ],
    })
  )
  assertEquals(view.queryAll('a').length, 1)
  assertEquals(view.query('[aria-current="page"]').textContent, 'Settings')
  view.unmount()
})

Deno.test('data: dataTable sorts and paginates', () => {
  const rows = signal([
    { id: 1, name: 'cherry', qty: 5 },
    { id: 2, name: 'apple', qty: 12 },
    { id: 3, name: 'banana', qty: 2 },
  ])
  const view = mount(() =>
    dataTable({
      columns: [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'qty', label: 'Qty' },
      ],
      rows,
      pageSize: 2,
    })
  )
  assertEquals(view.queryAll('tbody tr').length, 2)
  fire(view.query('th button'), 'click') // sort by name asc
  assertEquals(view.query('tbody td').textContent, 'apple')
  fire(view.query('th button'), 'click') // desc
  assertEquals(view.query('tbody td').textContent, 'cherry')
  view.unmount()
})

Deno.test('data: listView empty state is localized', async () => {
  await withLocale('en', () => {
    const view = mount(() => listView({ items: [] }))
    assert(view.el.textContent.includes('No data'))
    view.unmount()
  })
})

Deno.test('data: tree expands and selects', () => {
  let selected = null
  const view = mount(() =>
    tree({
      nodes: [{ id: 1, label: 'root', children: [{ id: 2, label: 'leaf' }] }],
      onSelect: (n) => {
        selected = n.id
      },
    })
  )
  assert(!view.el.textContent.includes('leaf'))
  fire(view.query('li > div'), 'click')
  assert(view.el.textContent.includes('leaf'))
  assertEquals(selected, 1)
  view.unmount()
})
