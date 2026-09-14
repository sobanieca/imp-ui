import { defineComponent } from '../shared/define.js'
import { a, figure, pre } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { resolveLanguage } from './code-languages.js'
import { tint } from './code-css.js'
import {
  CODE_MESSAGES,
  codeViewStyles,
  copyControl,
  createCodeView,
  LINE_KEY,
} from './code-view.js'
import { fontFamily, token } from '../shared/css.js'

const NAME = 'codeBlock'

const KNOWN_PROPS = ['code', 'language', 'lineNumbers', 'id', 'label']

const LINE_FRAGMENT = /^L(\d+)(?:-L(\d+))?$/

const NAMED_LINE_FRAGMENT = /^(.+?)-L(\d+)(?:-L(\d+))?$/

const selectedNumberBackground = () =>
  `color-mix(in oklab, ${token('color-primary')} 12%, ${token('color-surface-sunken')})`

const styles = () => `
  :host {
    display: block;
  }

  .block {
    --code-surface: ${token('color-surface-sunken')};
    position: relative;
    margin: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .code {
    overflow: auto;
    border-radius: inherit;
  }

  .line.selected {
    background-color: ${tint('primary', '12%')};
  }

  .line.selected .number {
    color: ${token('color-primary')};
    background-color: ${selectedNumberBackground()};
    border-inline-start-color: ${token('color-primary')};
  }

${codeViewStyles()}

  @media (forced-colors: active) {
    .block, .line.selected { border-color: CanvasText }
    .line.selected { outline: 2px solid Highlight; outline-offset: -2px }
  }
`

const fragmentFor = (id, start, end) => {
  const prefix = id === undefined ? '' : `${id}-`
  return end === undefined || end === start ? `${prefix}L${start}` : `${prefix}L${start}-L${end}`
}

const parseFragment = (hash) => {
  const anonymous = LINE_FRAGMENT.exec(hash)
  if (anonymous !== null) return { id: undefined, lines: anonymous.slice(1) }
  const named = NAMED_LINE_FRAGMENT.exec(hash)
  return named === null ? null : { id: named[1], lines: named.slice(2) }
}

const readSelection = (id) => {
  const parsed = parseFragment(decodeURIComponent(globalThis.location.hash.slice(1)))
  if (parsed === null || parsed.id !== id) return null
  const first = Number(parsed.lines[0])
  const second = parsed.lines[1] === undefined ? first : Number(parsed.lines[1])
  return { start: Math.min(first, second), end: Math.max(first, second) }
}

const mountedBlocks = new Set()

const writeSelection = (fragment) => {
  const target = new URL(globalThis.location.href)
  target.hash = fragment
  globalThis.history.replaceState(globalThis.history.state, '', target.href)
  for (const applySelection of mountedBlocks) applySelection()
}

const sourceOf = (props, children) => {
  if (children.length > 0) {
    impLogger.warn(`${NAME}: takes no children - pass the code as the 'code' prop`)
  }
  const { code: source } = props
  if (source === undefined || source === null) return ''
  if (typeof source === 'string' || isStateShaped(source)) return source
  impLogger.warn(`${NAME}: 'code' must be a string, or a state that holds one - showing none`)
  return ''
}

const trimEdges = (source) => {
  const text = typeof source === 'string' ? source : String(source ?? '')
  const start = text.startsWith('\n') ? 1 : 0
  const end = text.endsWith('\n') ? text.length - 1 : text.length
  return text.slice(start, Math.max(start, end))
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const language = resolveLanguage(NAME, props.language)
    const numbered = props.lineNumbers === true
    const id = typeof props.id === 'string' && props.id !== '' ? props.id : undefined
    let source = ''
    let anchorLine = null

    const select = (number, event) => {
      const selection = readSelection(id)
      const extend = event.shiftKey && (anchorLine ?? selection?.start) !== undefined
      const from = extend ? (anchorLine ?? selection.start) : number
      if (!extend) anchorLine = number
      writeSelection(fragmentFor(id, Math.min(from, number), Math.max(from, number)))
    }

    const lineLink = (number) => {
      const anchor = a({
        class: 'number',
        href: `#${fragmentFor(id, number)}`,
        'data-line': String(number),
        'aria-label': t(LINE_KEY, { number }),
      })
      anchor.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) return
        event.preventDefault()
        select(number, event)
      })
      return anchor
    }

    const view = createCodeView({ language, createNumber: numbered ? lineLink : null })
    if (numbered) view.listing.classList.add('numbered')
    const block = figure(
      { class: 'block', 'aria-label': typeof props.label === 'string' ? props.label : null },
      pre({ class: 'code' }, view.listing),
    )

    const lineAt = (number) => view.listing.children[number - 1] ?? null

    const applySelection = () => {
      const selection = readSelection(id)
      for (const [index, line] of [...view.listing.children].entries()) {
        const number = index + 1
        const selected = selection !== null && number >= selection.start &&
          number <= selection.end
        line.classList.toggle('selected', selected)
        const anchor = line.firstElementChild
        if (anchor === null) continue
        if (selected) anchor.setAttribute('aria-current', 'true')
        else anchor.removeAttribute('aria-current')
      }
      return selection
    }

    const labelNumbers = () => {
      for (const anchor of view.listing.querySelectorAll('.number')) {
        anchor.setAttribute('aria-label', t(LINE_KEY, { number: anchor.dataset.line }))
      }
    }

    bindValue(self, sourceOf(props, children), (value) => {
      source = trimEdges(value)
      view.render(source)
      applySelection()
    })
    lang.watch(self, labelNumbers)

    const reveal = () => {
      const selection = applySelection()
      if (selection !== null) lineAt(selection.start)?.scrollIntoView({ block: 'center' })
    }
    mountedBlocks.add(applySelection)
    globalThis.addEventListener('hashchange', reveal)
    stopOnRemove(self, () => {
      mountedBlocks.delete(applySelection)
      globalThis.removeEventListener('hashchange', reveal)
    })
    self.revealSelection = reveal

    block.append(copyControl(self, NAME, () => source))
    return block
  },
  onMount: (self) => self.revealSelection(),
}

export const codeBlock = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(CODE_MESSAGES))(...args)
