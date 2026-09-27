import { div, el, span } from '../../api/html.js'
import { lang, t } from '../../api/i18n.js'
import {
  luFaceSlightlySmiling,
  luHand,
  luHeart,
  luLeaf,
  luLightbulb,
  luPizza,
  luPlane,
  luTrophy,
} from '../../icons/lucide-icons.js'
import { impLogger } from '../../logger.js'
import { icon } from '../general/icon.js'
import { describeEmoji, emojiCategories, emojiKey } from './emoji-catalog.js'
import { focusRing, fontFamily, hiddenRule, quietScrollbar, token } from './css.js'

const COLUMNS = 8

const SEARCH_THRESHOLD = 16

const SEARCH_KEY = 'imp.emoji.search'

const NO_MATCHES_KEY = 'imp.emoji.noMatches'

const CATEGORY_ICONS = {
  smileys: luFaceSlightlySmiling,
  people: luHand,
  nature: luLeaf,
  food: luPizza,
  activities: luTrophy,
  travel: luPlane,
  objects: luLightbulb,
  symbols: luHeart,
}

const categoryKey = (id) => `imp.emoji.${id}`

export const EMOJI_PANEL_MESSAGES = {
  [SEARCH_KEY]: 'Search emoji',
  [NO_MATCHES_KEY]: 'No emoji found',
  [categoryKey('smileys')]: 'Smileys',
  [categoryKey('people')]: 'People and gestures',
  [categoryKey('nature')]: 'Animals and nature',
  [categoryKey('food')]: 'Food and drink',
  [categoryKey('activities')]: 'Activities',
  [categoryKey('travel')]: 'Travel and places',
  [categoryKey('objects')]: 'Objects',
  [categoryKey('symbols')]: 'Symbols',
}

export const emojiPanelStyles = () => `
  ${hiddenRule}

  .emoji-panel {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    box-sizing: border-box;
    inline-size: calc(${COLUMNS} * 2.25rem + 2 * ${token('space-2')});
    max-inline-size: 100%;
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .emoji-search {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  .emoji-search:focus-visible {
    ${focusRing()}
    outline-offset: 0;
  }

  .emoji-categories {
    display: flex;
    justify-content: space-between;
    padding-block-end: ${token('space-1')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .emoji-category {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: ${token('space-1')};
    border: 0;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-secondary')};
    cursor: pointer;
    transition:
      background-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  .emoji-category:hover {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-text')};
  }

  .emoji-category[aria-current='true'] {
    color: ${token('color-primary')};
  }

  .emoji-category:focus-visible {
    ${focusRing()}
  }

  .emoji-scroller {
    position: relative;
    max-block-size: 15rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    ${quietScrollbar()}
  }

  .emoji-section + .emoji-section {
    margin-block-start: ${token('space-2')};
  }

  .emoji-title {
    margin: 0;
    padding-block: ${token('space-1')};
    color: ${token('color-secondary')};
    font-size: 0.75rem;
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(${COLUMNS}, 2.25rem);
  }

  .emoji-choice {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    font-size: 1.375rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color ${token('duration-fast')} ease-out;
  }

  .emoji-choice:hover,
  .emoji-choice:focus-visible {
    background-color: ${token('color-surface-hover')};
  }

  .emoji-choice:focus-visible {
    ${focusRing()}
    outline-offset: -2px;
  }

  .emoji-empty {
    margin: 0;
    padding-block: ${token('space-4')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    text-align: center;
  }

  .emoji-preview {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    min-block-size: 2rem;
    padding-block-start: ${token('space-1')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
    font-size: ${token('font-size-sm')};
  }

  .emoji-preview-glyph {
    font-size: 1.5rem;
    line-height: 1;
  }

  .emoji-preview-name {
    overflow: hidden;
    color: ${token('color-secondary')};
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .emoji-category, .emoji-choice { transition: none }
  }

  @media (forced-colors: active) {
    .emoji-panel { border-color: CanvasText }
    .emoji-category[aria-current='true'] { color: Highlight }
  }
`

const customEntry = (name, item) => {
  if (typeof item === 'string' && item.trim() !== '') {
    return describeEmoji(item) ?? { emoji: item, name: '', terms: '' }
  }
  if (typeof item?.emoji === 'string' && item.emoji.trim() !== '') {
    const known = describeEmoji(item.emoji)
    const label = typeof item.name === 'string' ? item.name : known?.name ?? ''
    const keywords = Array.isArray(item.keywords) ? item.keywords.join(' ') : ''
    return { emoji: item.emoji, name: label, terms: `${label} ${keywords} ${known?.terms ?? ''}` }
  }
  impLogger.warn(`${name}: an entry of 'emojis' must be an emoji or { emoji, name, keywords }`)
  return null
}

const readEmojiSet = (name, emojis) => {
  if (emojis === undefined) return emojiCategories()
  if (!Array.isArray(emojis) || emojis.length === 0) {
    impLogger.warn(`${name}: 'emojis' must be a non-empty array - offering every emoji`)
    return emojiCategories()
  }
  return [{ id: null, entries: emojis.map((item) => customEntry(name, item)).filter(Boolean) }]
}

const lowered = (text) => {
  try {
    return text.toLocaleLowerCase(lang.get())
  } catch {
    return text.toLocaleLowerCase()
  }
}

const matches = (terms, words) => {
  const haystack = lowered(terms)
  return words.every((word) => haystack.includes(word))
}

const isRightToLeft = (element) => getComputedStyle(element).direction === 'rtl'

export const createEmojiPanel = ({ self, name, emojis, onPick }) => {
  const sections = readEmojiSet(name, emojis)
  const total = sections.reduce((sum, { entries }) => sum + entries.length, 0)
  const searchable = total > SEARCH_THRESHOLD
  const grouped = sections.length > 1

  const previewGlyph = span({ class: 'emoji-preview-glyph' })
  const previewName = span({ class: 'emoji-preview-name' })
  const preview = div({ class: 'emoji-preview', 'aria-hidden': 'true' }, previewGlyph, previewName)
  const showPreview = (entry) => {
    previewGlyph.textContent = entry?.emoji ?? ''
    previewName.textContent = entry?.name ?? ''
  }

  const choices = []
  const built = sections.map((section) => {
    const title = section.id === null
      ? null
      : el('p', { class: 'emoji-title', 'aria-hidden': 'true' })
    const buttons = section.entries.map((entry) => {
      const choice = el('button', {
        type: 'button',
        class: 'emoji-choice',
        tabindex: '-1',
        ...(entry.name === '' ? {} : { title: entry.name }),
      }, entry.emoji)
      choices.push({ choice, entry, section: section.id })
      return choice
    })
    const grid = div({ class: 'emoji-grid', role: 'group' }, ...buttons)
    const root = div({ class: 'emoji-section' }, title, grid)
    return { id: section.id, root, title, grid, buttons }
  })

  const empty = el('p', { class: 'emoji-empty', role: 'status', hidden: true })
  const scroller = div({ class: 'emoji-scroller' }, ...built.map(({ root }) => root), empty)

  const categoryButtons = grouped
    ? built.map(({ id, root }) =>
      el('button', {
        type: 'button',
        class: 'emoji-category',
        'data-category': id,
        events: {
          click: () => {
            scroller.scrollTop = root.offsetTop
            focusChoice(visibleChoices().find((item) => item.section === id))
          },
        },
      }, icon(CATEGORY_ICONS[id], { size: 'sm' }))
    )
    : []
  const categoryBar = grouped ? div({ class: 'emoji-categories' }, ...categoryButtons) : null

  const search = searchable
    ? el('input', {
      type: 'search',
      class: 'emoji-search',
      autocomplete: 'off',
      spellcheck: 'false',
    })
    : null

  const visibleChoices = () => choices.filter(({ choice }) => !choice.hidden)

  const focusChoice = (item) => {
    if (!item) return
    for (const { choice } of choices) choice.tabIndex = choice === item.choice ? 0 : -1
    item.choice.focus()
    showPreview(item.entry)
  }

  const rowsOf = () =>
    built.flatMap(({ buttons }) => {
      const shown = buttons.filter((button) => !button.hidden)
      const rows = []
      for (let start = 0; start < shown.length; start += COLUMNS) {
        rows.push(shown.slice(start, start + COLUMNS))
      }
      return rows
    })

  const moveFrom = (button, key) => {
    const visible = visibleChoices()
    const index = visible.findIndex(({ choice }) => choice === button)
    const reversed = isRightToLeft(button)
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      const step = (key === 'ArrowRight') !== reversed ? 1 : -1
      return focusChoice(visible[index + step])
    }
    if (key === 'Home') return focusChoice(visible[0])
    if (key === 'End') return focusChoice(visible.at(-1))
    const rows = rowsOf()
    const row = rows.findIndex((cells) => cells.includes(button))
    const column = rows[row].indexOf(button)
    const target = rows[row + (key === 'ArrowDown' ? 1 : -1)]
    if (target) {
      const cell = target[Math.min(column, target.length - 1)]
      return focusChoice(visible.find(({ choice }) => choice === cell))
    }
    if (key === 'ArrowUp' && search) search.focus()
  }

  for (const item of choices) {
    item.choice.addEventListener('click', () => onPick(item.entry.emoji))
    item.choice.addEventListener('pointerenter', () => showPreview(item.entry))
    item.choice.addEventListener('focus', () => showPreview(item.entry))
    item.choice.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        return
      }
      event.preventDefault()
      moveFrom(item.choice, event.key)
    })
  }

  const markCategory = () => {
    if (!grouped) return
    const top = scroller.scrollTop + 1
    const current = built.findLast(({ root }) => root.offsetTop <= top) ?? built[0]
    for (const button of categoryButtons) {
      button.setAttribute('aria-current', String(button.dataset.category === current.id))
    }
  }
  scroller.addEventListener('scroll', markCategory, { passive: true })

  const filter = () => {
    const words = lowered(search?.value.trim() ?? '').split(/\s+/).filter(Boolean)
    for (const { choice, entry } of choices) choice.hidden = !matches(entry.terms, words)
    for (const { root, buttons } of built) {
      root.hidden = buttons.every((button) => button.hidden)
    }
    const visible = visibleChoices()
    empty.hidden = visible.length > 0
    if (categoryBar) categoryBar.hidden = words.length > 0
    for (const { choice } of choices) choice.tabIndex = -1
    if (visible[0]) visible[0].choice.tabIndex = 0
    showPreview(visible[0]?.entry)
    scroller.scrollTop = 0
    markCategory()
  }

  search?.addEventListener('input', filter)
  search?.addEventListener('keydown', (event) => {
    const first = visibleChoices()[0]
    if (event.key === 'ArrowDown' && first) {
      event.preventDefault()
      focusChoice(first)
    } else if (event.key === 'Enter' && first) {
      event.preventDefault()
      onPick(first.entry.emoji)
    }
  })

  lang.watch(self, () => {
    search?.setAttribute('aria-label', t(SEARCH_KEY))
    search?.setAttribute('placeholder', t(SEARCH_KEY))
    empty.textContent = t(NO_MATCHES_KEY)
    for (const { id, title, grid } of built) {
      if (id === null) continue
      title.textContent = t(categoryKey(id))
      grid.setAttribute('aria-label', t(categoryKey(id)))
    }
    for (const button of categoryButtons) {
      button.setAttribute('aria-label', t(categoryKey(button.dataset.category)))
    }
  })

  const root = div({ class: 'emoji-panel' }, search, categoryBar, scroller, preview)

  const nameOf = (emoji) =>
    choices.find(({ entry }) => emojiKey(entry.emoji) === emojiKey(emoji))?.entry.name ??
      describeEmoji(emoji)?.name ?? ''

  return {
    root,
    nameOf,
    reset: () => {
      if (search) search.value = ''
      filter()
    },
    focusStart: () => {
      if (search) search.focus()
      else focusChoice(visibleChoices()[0])
    },
  }
}
