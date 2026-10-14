import {
  createApp,
  defineComponent,
  h,
  inject,
  nextTick,
  onUnmounted,
  provide,
  ref,
  shallowRef,
} from 'npm:vue@3.5.43'
import { makeRows, relabel, swapEnds, withoutMiddle } from '../shared/bench-data.js'

const handles = {
  app: null,
  rows: null,
  selected: null,
  deep: null,
  count: null,
  local: new Map(),
  nextId: 1,
  version: 0,
}

const Row = defineComponent({
  props: { item: Object, selected: Boolean, onRemove: Function },
  setup(props) {
    const override = ref(null)
    const id = props.item.id
    handles.local.set(id, override)
    onUnmounted(() => {
      if (handles.local.get(id) === override) handles.local.delete(id)
    })
    return () =>
      h('li', { class: { row: true, selected: props.selected } }, [
        h('span', { class: 'label' }, override.value ?? props.item.label),
        h('button', { class: 'remove', onClick: () => props.onRemove(id) }, 'x'),
      ])
  },
})

const ListApp = defineComponent({
  props: { initialRows: Array },
  setup(props) {
    const rows = shallowRef(props.initialRows)
    const selected = ref(null)
    handles.rows = rows
    handles.selected = selected
    const onRemove = (id) => {
      rows.value = rows.value.filter((it) => it.id !== id)
    }
    return () =>
      h(
        'ul',
        rows.value.map((item) =>
          h(Row, { key: item.id, item, selected: selected.value === item.id, onRemove })
        ),
      )
  },
})

const DeepLeaf = defineComponent({
  setup() {
    const deep = inject('perf.deep')
    return () => h('span', { class: 'deep' }, String(deep.value))
  },
})

const DeepNode = defineComponent({
  props: { depth: Number },
  setup(props) {
    return () => h('div', props.depth === 0 ? h(DeepLeaf) : h(DeepNode, { depth: props.depth - 1 }))
  },
})

const DeepApp = defineComponent({
  props: { depth: Number },
  setup(props) {
    handles.deep = ref(0)
    provide('perf.deep', handles.deep)
    return () => h(DeepNode, { depth: props.depth })
  },
})

const CounterApp = defineComponent({
  setup() {
    handles.count = ref(0)
    return () => h('span', { class: 'count' }, String(handles.count.value))
  },
})

const render = (component, props) => {
  handles.app = createApp(component, props)
  handles.app.mount('#app')
}

const unmount = () => {
  handles.app.unmount()
  handles.app = null
}

const setRows = async (update) => {
  handles.rows.value = typeof update === 'function' ? update(handles.rows.value) : update
  await nextTick()
}

const ops = {
  mountList: (count) => {
    handles.nextId = count + 1
    render(ListApp, { initialRows: makeRows(count) })
  },
  unmountList: unmount,
  updateOne: (index) => {
    const version = ++handles.version
    return setRows((items) => items.map((it, at) => (at === index ? relabel(it, version) : it)))
  },
  updateOneLocal: async (index) => {
    const item = handles.rows.value[index]
    handles.local.get(item.id).value = relabel(item, ++handles.version).label
    await nextTick()
  },
  updateEvery: (step) => {
    const version = ++handles.version
    return setRows((items) => items.map((it, at) => (at % step === 0 ? relabel(it, version) : it)))
  },
  updateAll: () => {
    const version = ++handles.version
    return setRows((items) => items.map((it) => relabel(it, version)))
  },
  swapRows: () => setRows(swapEnds),
  select: async (index) => {
    handles.selected.value = handles.rows.value[index].id
    await nextTick()
  },
  append: (count) => {
    const added = makeRows(count, handles.nextId)
    handles.nextId += count
    return setRows((items) => [...items, ...added])
  },
  removeMiddle: () => setRows(withoutMiddle),
  clear: () => setRows([]),
  mountDeep: (depth) => render(DeepApp, { depth }),
  updateDeep: async () => {
    handles.deep.value += 1
    await nextTick()
  },
  unmountDeep: unmount,
  mountCounter: () => render(CounterApp, {}),
  burst: async (count) => {
    for (let step = 1; step <= count; step++) {
      handles.count.value = step
      await nextTick()
    }
  },
  unmountCounter: unmount,
}

globalThis.__bench = { framework: 'vue', ops }
