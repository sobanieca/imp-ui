import { defineComponent } from '../shared/define.js'
import {
  caption,
  div,
  el,
  label,
  span,
  table as tableElement,
  tbody,
  td,
  th,
  thead,
  tr,
} from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { bindText, bindValue, oneOf } from '../shared/args.js'
import { ALIGNMENTS } from '../shared/css.js'
import { chevronDownIcon } from '../shared/icons.js'
import { createKeyedRows } from '../shared/keyed-rows.js'
import { createLoadMore, LOAD_MORE_PROPS, loadMoreMessages } from '../shared/load-more.js'
import { ownEvents } from '../shared/own-events.js'
import { emptyState } from '../display/empty-state.js'
import { tableStyles } from './table-css.js'
import { filterRows, isSorted, nextSortDirection, sortRows } from './table-rows.js'

const NAME = 'table'

const SELECTIONS = ['none', 'single', 'multiple']

const KNOWN_PROPS = [
  'label',
  'columns',
  'rows',
  'rowKey',
  'filter',
  'selection',
  'selected',
  ...LOAD_MORE_PROPS,
  'events',
]

const ROW_SELECT_EVENT = 'rowSelect'

const SORT_EVENT = 'sort'

const SELECT_ROW_KEY = 'imp.table.selectRow'

const SELECT_ALL_KEY = 'imp.table.selectAll'

const SELECTION_KEY = 'imp.table.selection'

const INTERACTIVE = ['a', 'button', 'input', 'select', 'textarea', 'label', 'summary']

const messages = {
  [SELECT_ROW_KEY]: 'Select row {row}',
  [SELECT_ALL_KEY]: 'Select all rows',
  [SELECTION_KEY]: 'Selection',
  ...loadMoreMessages,
}

const normalizeColumns = (columns) => {
  if (!Array.isArray(columns)) {
    impLogger.warn(`${NAME}: 'columns' must be an array of { key, label } - showing none`)
    return []
  }
  return columns.flatMap((column) => {
    if (!column || typeof column !== 'object' || typeof column.key !== 'string') {
      impLogger.warn(`${NAME}: a column is not an object with a string 'key' - skipping it`)
      return []
    }
    return [{
      key: column.key,
      label: column.label ?? column.key,
      align: oneOf(NAME, 'align', column.align, ALIGNMENTS, 'start'),
      sortable: Boolean(column.sortable),
      sortValue: column.sortValue,
      render: typeof column.render === 'function' ? column.render : null,
    }]
  })
}

const asKeys = (value) => (Array.isArray(value) ? value : [])

const current = (value) => (isStateShaped(value) ? value.get() : value)

const textOf = (value) => (value === null || value === undefined ? '' : String(value))

const isInteractive = (node) =>
  INTERACTIVE.includes(node.localName) || node.getAttribute?.('role') === 'button'

const definition = {
  styles: tableStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the data as 'columns' and 'rows'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it names the table for a screen reader`)
    }
    const selection = oneOf(NAME, 'selection', props.selection, SELECTIONS, 'none')
    if (selection === 'none' && props.selected !== undefined) {
      impLogger.warn(`${NAME}: 'selected' needs a 'selection' of 'single' or 'multiple'`)
    }
    const selectable = selection !== 'none'
    const columns = normalizeColumns(props.columns)
    const rowKey = typeof props.rowKey === 'string' ? props.rowKey : 'id'
    const keyed = createKeyedRows(NAME, rowKey)
    const rowParts = new WeakMap()

    let rows = []
    let visibleRows = []
    let query = ''
    let sort = { key: null, direction: 'none', clientSide: true }
    let selectedKeys = []
    let moreRowsExist = false
    let shownEmptyVariant = null

    const rowName = (row) => (columns.length === 0 ? '' : textOf(row[columns[0].key]))

    const selectRowLabel = (row) => t(SELECT_ROW_KEY, { row: rowName(row) })

    const selectAll = selection === 'multiple'
      ? el('input', { type: 'checkbox', events: { change: () => toggleAll() } })
      : null

    const selectHeader = () =>
      th(
        {
          class: ['select-cell', selectAll === null ? 'plain' : null],
          scope: 'col',
          role: 'columnheader',
        },
        selectAll === null
          ? span({ class: 'select-text' }, lang.text(() => t(SELECTION_KEY)))
          : label(
            { class: 'check select-all' },
            selectAll,
            span({ class: 'select-text' }, lang.text(() => t(SELECT_ALL_KEY))),
          ),
      )

    const headers = columns.map((column) => {
      const text = span(bindText(self, column.label))
      return th(
        {
          class: [`align-${column.align}`, column.sortable ? null : 'plain'],
          scope: 'col',
          role: 'columnheader',
        },
        column.sortable
          ? el(
            'button',
            { class: 'sort', type: 'button', events: { click: () => changeSort(column) } },
            text,
            chevronDownIcon('sort-icon'),
          )
          : text,
      )
    })

    const paintHeaders = () => {
      for (const [index, column] of columns.entries()) {
        if (sort.key === column.key) headers[index].setAttribute('aria-sort', sort.direction)
        else headers[index].removeAttribute('aria-sort')
      }
    }

    const selectInput = (key, row) => {
      const attributes = {
        type: selection === 'single' ? 'radio' : 'checkbox',
        'aria-label': selectRowLabel(row),
        events: { change: (event) => toggleRow(key, event.target.checked) },
      }
      if (selection === 'single') attributes.name = 'imp-table-selected'
      return el('input', attributes)
    }

    const renderRow = (key, row) => {
      const picker = selectable ? selectInput(key, row) : null
      const rowNode = tr(
        { class: 'row', role: 'row' },
        picker === null
          ? null
          : td({ class: 'select-cell', role: 'cell' }, label({ class: 'check' }, picker)),
        ...columns.map((column) =>
          td(
            {
              class: `align-${column.align}`,
              role: 'cell',
              'data-label': textOf(current(column.label)),
            },
            div(
              { class: 'value' },
              column.render === null ? textOf(row[column.key]) : column.render(row),
            ),
          )
        ),
      )
      rowParts.set(rowNode, { key, row, picker })
      paintRow(rowNode)
      return rowNode
    }

    const body = tbody({ class: 'rows', role: 'rowgroup' }, keyed.region(renderRow))
    const emptyCell = td({ role: 'cell', colspan: String(columns.length + (selectable ? 1 : 0)) })
    const emptyBody = tbody(
      { class: 'empty', role: 'rowgroup', hidden: true },
      tr({ role: 'row' }, emptyCell),
    )
    const region = div(
      { class: 'region', role: 'region', tabindex: '0' },
      tableElement(
        { role: 'table' },
        caption(bindText(self, props.label)),
        thead(
          { role: 'rowgroup' },
          tr({ role: 'row' }, selectable ? selectHeader() : null, ...headers),
        ),
        body,
        emptyBody,
      ),
    )
    const root = div(
      {
        class: ['root', selectable ? 'selectable' : null],
        events: ownEvents(props.events, [ROW_SELECT_EVENT, SORT_EVENT]),
      },
      region,
    )

    const renderedRows = () => [...body.children].filter((node) => rowParts.has(node))

    function paintRow(rowNode) {
      if (!selectable) return
      const { key, picker } = rowParts.get(rowNode)
      const isSelected = selectedKeys.includes(key)
      rowNode.setAttribute('aria-selected', String(isSelected))
      picker.checked = isSelected
    }

    const paintSelection = () => {
      for (const rowNode of renderedRows()) paintRow(rowNode)
      if (selectAll === null) return
      const chosen = visibleRows.filter((row) => selectedKeys.includes(row[rowKey])).length
      selectAll.checked = visibleRows.length > 0 && chosen === visibleRows.length
      selectAll.indeterminate = chosen > 0 && chosen < visibleRows.length
      selectAll.disabled = visibleRows.length === 0
    }

    const paintEmpty = () => {
      const isEmpty = visibleRows.length === 0 && !moreRowsExist
      emptyBody.hidden = !isEmpty
      if (!isEmpty) return
      const variant = query === '' ? 'empty' : 'noResults'
      if (variant === shownEmptyVariant) return
      shownEmptyVariant = variant
      emptyCell.replaceChildren(emptyState({ variant }))
    }

    const refresh = () => {
      const sortColumn = sort.clientSide ? columns.find(({ key }) => key === sort.key) : null
      visibleRows = sortRows(
        filterRows(rows, columns, query),
        sortColumn,
        sort.direction,
        lang.get(),
      )
      keyed.show(visibleRows)
      paintEmpty()
      paintSelection()
    }

    const takeRows = (value) => {
      rows = keyed.take(value)
      refresh()
    }

    const commitSelection = (next) => {
      selectedKeys = next
      paintSelection()
      if (!isStateShaped(props.selected)) return
      if (typeof props.selected.set === 'function') props.selected.set(next)
      else {
        impLogger.warn(
          `${NAME}: 'selected' is a read-only state - pass a writable state so ${NAME} can write it back`,
        )
      }
    }

    function toggleRow(key, wanted) {
      const isSelected = selectedKeys.includes(key)
      if (isSelected === wanted) return paintSelection()
      const others = selection === 'single' ? [] : selectedKeys.filter((entry) => entry !== key)
      commitSelection(wanted ? [...others, key] : others)
      root.dispatchEvent(
        new CustomEvent(ROW_SELECT_EVENT, {
          bubbles: true,
          composed: true,
          detail: { key, row: keyed.rowOf(key), selected: wanted },
        }),
      )
    }

    function toggleAll() {
      const visibleKeys = visibleRows.map((row) => row[rowKey])
      const kept = selectedKeys.filter((key) => !visibleKeys.includes(key))
      commitSelection(selectAll.checked ? [...kept, ...visibleKeys] : kept)
    }

    function changeSort(column) {
      const direction = nextSortDirection(sort.key === column.key ? sort.direction : 'none')
      const clientSide = root.dispatchEvent(
        new CustomEvent(SORT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { key: column.key, direction },
        }),
      )
      sort = { key: isSorted(direction) ? column.key : null, direction, clientSide }
      paintHeaders()
      refresh()
    }

    body.addEventListener('click', (event) => {
      if (!selectable) return
      const path = event.composedPath()
      const rowNode = path.find((node) => rowParts.has(node))
      if (!rowNode || path.slice(0, path.indexOf(rowNode)).some(isInteractive)) return
      const { key } = rowParts.get(rowNode)
      toggleRow(key, selection === 'single' ? true : !selectedKeys.includes(key))
    })

    if (props.label !== undefined) {
      bindValue(self, props.label, (value) => region.setAttribute('aria-label', textOf(value)))
    }
    for (const [index, column] of columns.entries()) {
      if (!isStateShaped(column.label)) continue
      column.label.watch(self, (value) => {
        for (const rowNode of renderedRows()) {
          rowNode.children[index + (selectable ? 1 : 0)].setAttribute('data-label', textOf(value))
        }
      })
    }
    if (selectable) {
      bindValue(self, props.selected, (value) => {
        selectedKeys = asKeys(value)
        paintSelection()
      })
      lang.watch(self, () => {
        for (const rowNode of renderedRows()) {
          const { row, picker } = rowParts.get(rowNode)
          picker.setAttribute('aria-label', selectRowLabel(row))
        }
      })
    }
    bindValue(self, props.filter, (value) => {
      query = textOf(value).trim().toLowerCase()
      refresh()
    })
    const loadMore = createLoadMore(self, NAME, props, region)
    if (loadMore !== null) {
      region.append(loadMore)
      bindValue(self, props.hasMore, (value) => {
        moreRowsExist = Boolean(value)
        paintEmpty()
      })
    }
    bindValue(self, props.rows, takeRows)
    return root
  },
}

export const table = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
