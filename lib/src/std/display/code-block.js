import { defineComponent } from '../shared/define.js'
import { a, code, div, figure, pre, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { createState } from '../../state.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { tooltip } from './tooltip.js'
import { luCheck, luCopy } from '../../icons/lucide-icons.js'
import { resolveLanguage } from './code-languages.js'
import { tokenizeLines } from './code-tokens.js'
import { tint, tokenNodes, tokenStyles } from './code-css.js'
import { focusRing, fontFamily, token, visuallyHidden } from '../shared/css.js'

const NAME = 'codeBlock'

const KNOWN_PROPS = ['code', 'language', 'lineNumbers', 'id', 'label']

const COPY_KEY = 'imp.codeBlock.copy'

const COPIED_KEY = 'imp.codeBlock.copied'

const LINE_KEY = 'imp.codeBlock.line'

const messages = {
  [COPY_KEY]: 'Copy code',
  [COPIED_KEY]: 'Copied',
  [LINE_KEY]: 'Line {number}',
}

const COPIED_FEEDBACK_MS = 1500

const LINE_FRAGMENT = /^L(\d+)(?:-L(\d+))?$/

const NAMED_LINE_FRAGMENT = /^(.+?)-L(\d+)(?:-L(\d+))?$/

const selectedNumberBackground = () =>
  `color-mix(in oklab, ${token('color-primary')} 12%, ${token('color-surface-sunken')})`

const styles = () => `
  :host {
    display: block;
  }

  .block {
    position: relative;
    margin: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  pre {
    margin: 0;
    padding-block: ${token('space-3')};
    overflow: auto;
    border-radius: inherit;
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
    tab-size: 2;
  }

  code {
    display: block;
    min-inline-size: max-content;
    font: inherit;
    counter-reset: line;
  }

  .line {
    display: inline-block;
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: 1lh;
    vertical-align: top;
    padding-inline-start: ${token('space-3')};
    padding-inline-end: calc(${token('space-3')} + 2.5rem);
    counter-increment: line;
  }

  .numbered .line {
    padding-inline-start: 0;
  }

  .line.selected {
    background-color: ${tint('primary', '12%')};
  }

  .number {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    display: inline-block;
    box-sizing: content-box;
    min-inline-size: calc(var(--code-digits, 2) * 1ch);
    padding-inline: ${token('space-3')};
    margin-inline-end: ${token('space-2')};
    border-inline-start: 3px solid transparent;
    text-align: end;
    color: ${token('color-secondary')};
    background-color: ${token('color-surface-sunken')};
    text-decoration: none;
    user-select: none;
  }

  .number::before {
    content: counter(line);
  }

  .number:hover {
    color: ${token('color-text')};
  }

  .number:focus-visible {${focusRing()}
    outline-offset: -${token('focus-ring-width')};
  }

  .line.selected .number {
    color: ${token('color-primary')};
    background-color: ${selectedNumberBackground()};
    border-inline-start-color: ${token('color-primary')};
  }

  .toolbar {
    position: absolute;
    inset-block-start: ${token('space-2')};
    inset-inline-end: ${token('space-2')};
    user-select: none;
  }

  .status {${visuallyHidden}}

${tokenStyles()}

  @media (forced-colors: active) {
    .block, .line.selected { border-color: CanvasText }
    .line.selected { outline: 2px solid Highlight; outline-offset: -2px }
    .number { color: LinkText }
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

const copyControl = (self, readSource) => {
  const copied = createState('imp.codeBlock.copied', false)
  const label = createState('imp.codeBlock.label', t(COPY_KEY))
  const status = span({ class: 'status', role: 'status', 'aria-live': 'polite' })
  const relabel = () => label.set(t(copied.get() ? COPIED_KEY : COPY_KEY))
  lang.watch(self, relabel)
  copied.watch(self, relabel)
  let timer = 0
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(readSource())
    } catch (error) {
      impLogger.warn(`${NAME}: the clipboard refused the text`, error)
      return
    }
    copied.set(true)
    status.textContent = t(COPIED_KEY)
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.set(false)
      status.textContent = ''
    }, COPIED_FEEDBACK_MS)
  }
  stopOnRemove(self, () => clearTimeout(timer))
  const control = tooltip(
    { text: label },
    button(
      { size: 'sm', variant: 'ghost', label, events: { click: copy } },
      copied.view((done) => icon(done ? luCheck : luCopy)),
    ),
  )
  return div({ class: 'toolbar' }, control, status)
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const language = resolveLanguage(NAME, props.language)
    const numbered = props.lineNumbers === true
    const id = typeof props.id === 'string' && props.id !== '' ? props.id : undefined
    const listing = code({ class: numbered ? 'numbered' : null })
    const block = figure(
      { class: 'block', 'aria-label': typeof props.label === 'string' ? props.label : null },
      pre(listing),
    )
    let source = ''
    let anchorLine = null

    const lineAt = (number) => listing.children[number - 1] ?? null

    const applySelection = () => {
      const selection = readSelection(id)
      for (const [index, line] of [...listing.children].entries()) {
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

    const select = (number, event) => {
      const selection = readSelection(id)
      const extend = event.shiftKey && (anchorLine ?? selection?.start) !== undefined
      const from = extend ? (anchorLine ?? selection.start) : number
      if (!extend) anchorLine = number
      writeSelection(fragmentFor(id, Math.min(from, number), Math.max(from, number)))
    }

    const labelNumbers = () => {
      for (const anchor of listing.querySelectorAll('.number')) {
        anchor.setAttribute('aria-label', t(LINE_KEY, { number: anchor.dataset.line }))
      }
    }

    const render = (value) => {
      source = trimEdges(value)
      const lines = tokenizeLines(source, language)
      listing.style.setProperty('--code-digits', String(String(lines.length).length))
      const nodes = []
      lines.forEach((tokens, index) => {
        const number = index + 1
        const line = span({ class: 'line' })
        if (numbered) {
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
          line.append(anchor)
        }
        line.append(...tokenNodes(tokens, (className, text) => span({ class: className }, text)))
        nodes.push(line)
        if (index < lines.length - 1) nodes.push('\n')
      })
      listing.replaceChildren(...nodes)
      applySelection()
    }

    bindValue(self, sourceOf(props, children), render)
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

    block.append(copyControl(self, () => source))
    return block
  },
  onMount: (self) => self.revealSelection(),
}

export const codeBlock = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
