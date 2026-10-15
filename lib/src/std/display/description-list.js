import { defineComponent } from '../shared/define.js'
import { div, el } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText, oneOf } from '../shared/args.js'
import { normalizeItems } from '../shared/items.js'
import { fontFamily, token } from '../shared/css.js'

const NAME = 'descriptionList'

const KNOWN_PROPS = ['items', 'layout', 'columns']

const LAYOUTS = ['horizontal', 'vertical']

const COLUMNS = [1, 2, 3]

const TERM_TRACK = 'fit-content(40%)'

const DETAILS_TRACK = 'minmax(0, 1fr)'

const besideTracks = (columns) => `repeat(${columns}, ${TERM_TRACK} ${DETAILS_TRACK})`

const aboveTracks = (columns) => `repeat(${columns}, ${DETAILS_TRACK})`

const columnRules = () =>
  COLUMNS.map(
    (columns) => `
  .horizontal.columns-${columns} { grid-template-columns: ${besideTracks(columns)} }
  .vertical.columns-${columns} { grid-template-columns: ${aboveTracks(columns)} }`,
  ).join('\n')

const styles = () => `
  :host {
    display: block;
    inline-size: 100%;
  }

  .box {
    container-type: inline-size;
  }

  .list {
    display: grid;
    column-gap: ${token('space-6')};
    row-gap: ${token('space-3')};
    margin: 0;
    ${fontFamily()}
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
  }

  .pair {
    min-inline-size: 0;
  }

  .horizontal .pair {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: span 2;
    column-gap: ${token('space-3')};
  }

  .term {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    overflow-wrap: anywhere;
  }

  .horizontal .term {
    line-height: calc(${token('font-size-md')} * ${token('line-height-normal')});
  }

  .details {
    margin: 0;
    min-inline-size: 0;
    color: ${token('color-text')};
    overflow-wrap: anywhere;
  }
${columnRules()}

  @container (max-inline-size: 60rem) {
    .horizontal.columns-3 { grid-template-columns: ${besideTracks(2)} }
    .vertical.columns-3 { grid-template-columns: ${aboveTracks(2)} }
  }

  @container (max-inline-size: 40rem) {
    .horizontal.list { grid-template-columns: ${besideTracks(1)} }
    .vertical.list { grid-template-columns: ${aboveTracks(1)} }
  }

  @container (max-inline-size: 24rem) {
    .horizontal.list { grid-template-columns: ${aboveTracks(1)} }

    .horizontal .pair {
      display: block;
      grid-column: auto;
    }

    .horizontal .term {
      line-height: inherit;
    }
  }
`

const normalizePairs = (items) =>
  normalizeItems(NAME, items, {
    shape: '{ term, details }',
    key: 'term',
    item: ({ term, details }) => ({ term, details }),
  })

const detailsContent = (self, details) =>
  Array.isArray(details)
    ? details.map((part) => bindContent(self, part))
    : [bindContent(self, details)]

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every pair as 'items'`)
    }
    const layout = oneOf(NAME, 'layout', props.layout, LAYOUTS, 'horizontal')
    const columns = oneOf(NAME, 'columns', props.columns, COLUMNS, 1)
    const pairs = normalizePairs(props.items ?? []).map(({ term, details }) =>
      div(
        { class: 'pair' },
        el('dt', { class: 'term' }, bindText(self, term)),
        el('dd', { class: 'details' }, ...detailsContent(self, details)),
      ),
    )
    return div(
      { class: 'box' },
      el('dl', { class: ['list', layout, `columns-${columns}`] }, ...pairs),
    )
  },
}

export const descriptionList = (...args) => defineComponent(NAME, () => definition)(...args)
