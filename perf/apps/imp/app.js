import { component, mount } from 'imp'
import { button, div, li, span, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { richTextEditor } from 'imp/std/inputs'
import { makeRows, relabel, settle, swapEnds, withoutMiddle } from '../shared/bench-data.js'
import { makeRichTextDocument } from './rich-text-document.js'

const handles = {
  unmountList: null,
  unmountDeep: null,
  unmountCounter: null,
  unmountEditor: null,
  note: null,
  rows: null,
  selected: null,
  deep: null,
  count: null,
  local: new Map(),
  nextId: 1,
  version: 0,
}

const row = component('perf-row', {
  setup: (self, { item }) => {
    const label = initState(self, 'perf.label', item.label)
    self.label = label
    handles.local.set(item.id, label)
    const selected = useState(self, 'perf.selected')
    const rows = useState(self, 'perf.rows')
    const rowClass = computed([selected], (id) => ({ row: true, selected: id === item.id }))
    return li(
      { class: rowClass },
      span({ class: 'label' }, label.text()),
      button({
        class: 'remove',
        events: { click: () => rows.set((items) => items.filter((it) => it.id !== item.id)) },
      }, 'x'),
    )
  },
  onRemove: (self, { item }) => {
    if (handles.local.get(item.id) === self.label) handles.local.delete(item.id)
  },
})

const listApp = component('perf-list-app', {
  setup: (self, { items }) => {
    handles.rows = initState(self, 'perf.rows', items)
    handles.selected = initState(self, 'perf.selected', null)
    return ul(handles.rows.each((item) => row({ item }), (item) => item.id))
  },
})

const plainRow = (item, selected, rows) =>
  li(
    { class: computed([selected], (id) => ({ row: true, selected: id === item.id })) },
    span({ class: 'label' }, item.label),
    button({
      class: 'remove',
      events: { click: () => rows.set((items) => items.filter((it) => it.id !== item.id)) },
    }, 'x'),
  )

const plainListApp = component('perf-plain-list-app', {
  setup: (self, { items }) => {
    handles.rows = initState(self, 'perf.rows', items)
    handles.selected = initState(self, 'perf.selected', null)
    const { rows, selected } = handles
    return ul(rows.each((item) => plainRow(item, selected, rows), (item) => item.id))
  },
})

const deepLeaf = component('perf-deep-leaf', {
  setup: (self) => span({ class: 'deep' }, useState(self, 'perf.deep').text()),
})

const deepNode = component('perf-deep-node', {
  setup: (_self, { depth }) => div(depth === 0 ? deepLeaf() : deepNode({ depth: depth - 1 })),
})

const deepApp = component('perf-deep-app', {
  setup: (self, { depth }) => {
    handles.deep = initState(self, 'perf.deep', 0)
    return deepNode({ depth })
  },
})

const counterApp = component('perf-counter-app', {
  setup: (self) => {
    handles.count = initState(self, 'perf.count', 0)
    return span({ class: 'count' }, handles.count.text())
  },
})

const editorApp = component('perf-editor-app', {
  setup: (self, { markdown }) => {
    handles.note = initState(self, 'perf.note', markdown)
    return richTextEditor({ value: handles.note, label: 'Note' })
  },
})

const shadowFind = (root, selector) => {
  const found = root.querySelector(selector)
  if (found) return found
  for (const node of root.querySelectorAll('*')) {
    const inner = node.shadowRoot && shadowFind(node.shadowRoot, selector)
    if (inner) return inner
  }
  return null
}

const caretAt = (area, pick) => {
  const block = pick(area)
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let last = null
  while (walker.nextNode()) last = walker.currentNode
  area.focus()
  getSelection().setBaseAndExtent(last, last.length, last, last.length)
}

const middleParagraph = (area) => {
  const paragraphs = [...area.children].filter((node) =>
    node.localName === 'p' && !node.querySelector('img')
  )
  return paragraphs[paragraphs.length >> 1]
}

const imageParagraph = (area) => area.querySelector('img').parentElement

const typeInto = (pick, count) => {
  const area = shadowFind(document.body, '.area')
  caretAt(area, pick)
  for (let step = 0; step < count; step++) document.execCommand('insertText', false, 'x')
}

const setRows = (update) => handles.rows.set(update)

const ops = {
  mountList: (count) => {
    handles.nextId = count + 1
    handles.unmountList = mount('#app', () => listApp({ items: makeRows(count) }))
  },
  mountPlainList: (count) => {
    handles.nextId = count + 1
    handles.unmountList = mount('#app', () => plainListApp({ items: makeRows(count) }))
  },
  unmountList: async () => {
    handles.unmountList()
    handles.unmountList = null
    await settle()
  },
  updateOne: (index) => {
    const version = ++handles.version
    setRows((items) => items.map((it, at) => (at === index ? relabel(it, version) : it)))
  },
  updateOneLocal: (index) => {
    const item = handles.rows.get()[index]
    handles.local.get(item.id).set(relabel(item, ++handles.version).label)
  },
  updateEvery: (step) => {
    const version = ++handles.version
    setRows((items) => items.map((it, at) => (at % step === 0 ? relabel(it, version) : it)))
  },
  updateAll: () => {
    const version = ++handles.version
    setRows((items) => items.map((it) => relabel(it, version)))
  },
  swapRows: () => setRows(swapEnds),
  select: (index) => handles.selected.set(handles.rows.get()[index].id),
  append: (count) => {
    const added = makeRows(count, handles.nextId)
    handles.nextId += count
    setRows((items) => [...items, ...added])
  },
  removeMiddle: () => setRows(withoutMiddle),
  clear: async () => {
    setRows([])
    await settle()
  },
  mountDeep: (depth) => {
    handles.unmountDeep = mount('#app', () => deepApp({ depth }))
  },
  updateDeep: () => handles.deep.set((value) => value + 1),
  unmountDeep: async () => {
    handles.unmountDeep()
    handles.unmountDeep = null
    await settle()
  },
  mountCounter: () => {
    handles.unmountCounter = mount('#app', () => counterApp())
  },
  burst: (count) => {
    for (let step = 1; step <= count; step++) handles.count.set(step)
  },
  mountEditor: async () => {
    const markdown = await makeRichTextDocument()
    handles.unmountEditor = mount('#app', () => editorApp({ markdown }))
  },
  typeInParagraph: (count) => typeInto(middleParagraph, count),
  typeBesideImage: (count) => typeInto(imageParagraph, count),
  checkTyped: (count) => {
    if (!handles.note.get().includes('x'.repeat(count))) {
      throw new Error('the value of the editor does not hold the typed text')
    }
  },
  unmountEditor: async () => {
    handles.unmountEditor()
    handles.unmountEditor = null
    await settle()
  },
  unmountCounter: async () => {
    handles.unmountCounter()
    handles.unmountCounter = null
    await settle()
  },
}

globalThis.__bench = { framework: 'imp', ops }
