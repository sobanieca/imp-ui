import { div, span } from '../../api/html.js'
import { lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, stopOnRemove } from './args.js'
import { token } from './css.js'
import { button } from '../general/button.js'
import { spinnerNode, spinnerStyles } from './spinner.js'

const LOADING_KEY = 'imp.loadMore.loading'

const FAILED_KEY = 'imp.loadMore.failed'

const RETRY_KEY = 'imp.loadMore.retry'

export const LOAD_MORE_PROPS = ['hasMore', 'onLoadMore']

export const loadMoreMessages = {
  [LOADING_KEY]: 'Loading more',
  [FAILED_KEY]: 'Could not load more',
  [RETRY_KEY]: 'Try again',
}

export const loadMoreStyles = () => `
  .load-more {
    position: sticky;
    inset-inline-start: 0;
    box-sizing: border-box;
    inline-size: 100%;
  }

  .load-more-sentinel {
    position: absolute;
    inset-block-end: 0;
    inset-inline-start: 0;
    inline-size: 100%;
    block-size: 12rem;
    pointer-events: none;
  }

  .load-more-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-2')};
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-3')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .load-more-row[hidden] {
    display: none;
  }

  .load-more-row .spinner {
    flex: none;
  }

  ${spinnerStyles()}
`

export const createLoadMore = (self, name, props, busyNode) => {
  if (props.onLoadMore === undefined) {
    if (props.hasMore !== undefined) {
      impLogger.warn(`${name}: 'hasMore' needs an 'onLoadMore' function - ignoring it`)
    }
    return null
  }
  if (typeof props.onLoadMore !== 'function') {
    impLogger.warn(`${name}: 'onLoadMore' must be a function that loads the next rows`)
    return null
  }
  if (props.hasMore === undefined) {
    impLogger.warn(`${name}: 'onLoadMore' needs 'hasMore' - pass a state that says more rows exist`)
  }

  const sentinel = div({ class: 'load-more-sentinel', 'aria-hidden': 'true' })
  const loadingRow = div(
    { class: 'load-more-row', role: 'status', hidden: true },
    spinnerNode(),
    span(lang.text(() => t(LOADING_KEY))),
  )
  const failedRow = div(
    { class: 'load-more-row', role: 'alert', hidden: true },
    span(lang.text(() => t(FAILED_KEY))),
    button(
      { size: 'sm', events: { click: () => retry() } },
      lang.text(() => t(RETRY_KEY)),
    ),
  )
  const root = div({ class: 'load-more' }, sentinel, loadingRow, failedRow)

  let hasMore = false
  let sentinelVisible = false
  let loading = false
  let failed = false
  let stopped = false

  const paint = () => {
    loadingRow.hidden = !loading
    failedRow.hidden = !failed
    busyNode.setAttribute('aria-busy', String(loading))
  }

  const observer = new IntersectionObserver((entries) => {
    sentinelVisible = entries.at(-1)?.isIntersecting === true
    loadWhenNeeded()
  })

  const observeAgain = () => {
    if (stopped) return
    sentinelVisible = false
    observer.unobserve(sentinel)
    observer.observe(sentinel)
  }

  const settle = (error) => {
    loading = false
    failed = error !== undefined
    if (failed) impLogger.error(`${name}: 'onLoadMore' rejected - showing the retry button`, error)
    paint()
    if (!failed) observeAgain()
  }

  const load = () => {
    loading = true
    failed = false
    paint()
    Promise.resolve()
      .then(() => props.onLoadMore())
      .then(
        () => settle(),
        (error) => settle(error ?? new Error('onLoadMore rejected')),
      )
  }

  function loadWhenNeeded() {
    if (!stopped && hasMore && sentinelVisible && !loading && !failed) load()
  }

  function retry() {
    if (!loading) load()
  }

  bindValue(self, props.hasMore, (value) => {
    hasMore = Boolean(value)
    if (!hasMore) failed = false
    paint()
    if (hasMore && !loading) observeAgain()
  })
  stopOnRemove(self, () => {
    stopped = true
    observer.disconnect()
  })
  paint()
  return root
}
