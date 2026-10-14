import {
  createContext,
  createElement as h,
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'npm:react@19.3.0'
import { flushSync } from 'npm:react-dom@19.3.0'
import { createRoot } from 'npm:react-dom@19.3.0/client'
import { makeRows, relabel, swapEnds, withoutMiddle } from '../shared/bench-data.js'

const handles = {
  root: null,
  rows: null,
  setRows: null,
  setSelected: null,
  setDeep: null,
  setCount: null,
  local: new Map(),
  nextId: 1,
  version: 0,
}

const Row = memo(({ item, selected, onRemove }) => {
  const [override, setOverride] = useState(null)
  useEffect(() => {
    handles.local.set(item.id, setOverride)
    return () => {
      if (handles.local.get(item.id) === setOverride) handles.local.delete(item.id)
    }
  }, [item.id])
  return h(
    'li',
    { className: selected ? 'row selected' : 'row' },
    h('span', { className: 'label' }, override ?? item.label),
    h('button', { className: 'remove', onClick: () => onRemove(item.id) }, 'x'),
  )
})

const ListApp = ({ initialRows }) => {
  const [rows, setRows] = useState(initialRows)
  const [selected, setSelected] = useState(null)
  handles.rows = rows
  handles.setRows = setRows
  handles.setSelected = setSelected
  const onRemove = useCallback(
    (id) => setRows((items) => items.filter((it) => it.id !== id)),
    [],
  )
  return h(
    'ul',
    null,
    rows.map((item) => h(Row, { key: item.id, item, selected: selected === item.id, onRemove })),
  )
}

const DeepContext = createContext(0)

const DeepLeaf = () => h('span', { className: 'deep' }, String(useContext(DeepContext)))

const DeepNode = memo(({ depth }) =>
  h('div', null, depth === 0 ? h(DeepLeaf) : h(DeepNode, { depth: depth - 1 }))
)

const DeepApp = ({ depth }) => {
  const [value, setValue] = useState(0)
  handles.setDeep = setValue
  return h(DeepContext.Provider, { value }, h(DeepNode, { depth }))
}

const CounterApp = () => {
  const [count, setCount] = useState(0)
  handles.setCount = setCount
  return h('span', { className: 'count' }, String(count))
}

const render = (element, props) => {
  handles.root = createRoot(document.querySelector('#app'))
  flushSync(() => handles.root.render(h(element, props)))
}

const unmount = () => {
  handles.root.unmount()
  handles.root = null
}

const setRows = (update) => flushSync(() => handles.setRows(update))

const ops = {
  mountList: (count) => {
    handles.nextId = count + 1
    render(ListApp, { initialRows: makeRows(count) })
  },
  unmountList: unmount,
  updateOne: (index) => {
    const version = ++handles.version
    setRows((items) => items.map((it, at) => (at === index ? relabel(it, version) : it)))
  },
  updateOneLocal: (index) => {
    const item = handles.rows[index]
    const label = relabel(item, ++handles.version).label
    flushSync(() => handles.local.get(item.id)(label))
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
  select: (index) => flushSync(() => handles.setSelected(handles.rows[index].id)),
  append: (count) => {
    const added = makeRows(count, handles.nextId)
    handles.nextId += count
    setRows((items) => [...items, ...added])
  },
  removeMiddle: () => setRows(withoutMiddle),
  clear: () => setRows([]),
  mountDeep: (depth) => render(DeepApp, { depth }),
  updateDeep: () => flushSync(() => handles.setDeep((value) => value + 1)),
  unmountDeep: unmount,
  mountCounter: () => render(CounterApp, {}),
  burst: (count) => {
    for (let step = 1; step <= count; step++) flushSync(() => handles.setCount(step))
  },
  unmountCounter: unmount,
}

globalThis.__bench = { framework: 'react', ops }
