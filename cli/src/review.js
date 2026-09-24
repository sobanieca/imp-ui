import { join } from '@std/path'
import { bold, dim } from './colors.js'
import { logger } from './logger.js'

export const REVIEW_ENDPOINT = '/@imp/review'

const REVIEWS_FOLDER = 'reviews'

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '::1', 'localhost'])

const stripControl = (text, { keepLines = false } = {}) => {
  let kept = ''
  for (const character of text) {
    const code = character.codePointAt(0)
    if (code > 31 && code !== 127) kept += character
    else if (keepLines && (character === '\n' || character === '\t')) kept += character
  }
  return kept
}

const LIMITS = {
  page: 2000,
  title: 300,
  viewport: 40,
  scroll: 40,
  scheme: 20,
  motion: 20,
  lang: 40,
  dir: 20,
  element: 500,
  rect: 60,
  text: 500,
  html: 2000,
}

const BLOCK_LIMITS = { state: 60, controls: 60 }

const BLOCK_LINE = 600

const MAX_COMMENT = 20000

export const REVIEW_LOG_LINES = 20

export const TELEMETRY_ENTRIES = 2000

const WIDGET_MARK_URL = new URL('./templates/mark-dark.svg', import.meta.url)

export const readWidgetMark = async () =>
  (await Deno.readTextFile(WIDGET_MARK_URL))
    .replace(' role="img" aria-label="imp"', ' aria-hidden="true"')
    .trim()

export const reviewsDirectory = (root) => join(root, '.imp', REVIEWS_FOLDER)

export const reviewDisplayPath = (name) => `.imp/${REVIEWS_FOLDER}/${name}`

export const reviewFileName = (date, attempt = 0) =>
  `${date.toISOString().replaceAll(':', '-').replace('.', '-')}${attempt ? `-${attempt}` : ''}.txt`

export function isLocalRequest(info) {
  const address = info?.remoteAddr
  if (!address) return false
  if (address.transport === 'unix') return true
  const hostname = address.hostname ?? ''
  return LOOPBACK_HOSTNAMES.has(hostname) || hostname.startsWith('::ffff:127.')
}

const oneLine = (value, limit) =>
  stripControl(String(value ?? '')).replace(/\s+/g, ' ').trim().slice(0, limit)

const commentText = (value) =>
  stripControl(String(value ?? '').replaceAll('\r\n', '\n'), { keepLines: true })
    .trim().slice(0, MAX_COMMENT)

const blockLines = (value, most, describe) =>
  (Array.isArray(value) ? value : []).slice(0, most)
    .map((entry) => oneLine(describe(entry), BLOCK_LINE))
    .filter(Boolean)

const asJson = (value) => {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

const stateLine = (entry) =>
  entry && typeof entry === 'object' ? `${entry.name} = ${asJson(entry.value)}` : ''

const controlLine = (entry) => {
  if (!entry || typeof entry !== 'object') return ''
  const shown = entry.value === null || entry.value === undefined
    ? `<${entry.length} characters, not recorded>`
    : asJson(String(entry.value))
  const flags = [entry.disabled && 'disabled', entry.readOnly && 'read-only']
    .filter(Boolean)
    .join(', ')
  return `${entry.name} = ${shown}${flags ? ` (${flags})` : ''}`
}

export function formatReview(payload, at, log = []) {
  const element = payload.element && typeof payload.element === 'object' ? payload.element : {}
  const field = (label, value) => (value ? `${label}: ${value}\n` : '')
  const block = (label, lines) =>
    lines.length ? `\n${label}:\n${lines.map((line) => `  ${line}`).join('\n')}\n` : ''
  return [
    field('time', at),
    field('page', oneLine(payload.page, LIMITS.page)),
    field('title', oneLine(payload.title, LIMITS.title)),
    field('viewport', oneLine(payload.viewport, LIMITS.viewport)),
    field('scroll', oneLine(payload.scroll, LIMITS.scroll)),
    field('scheme', oneLine(payload.scheme, LIMITS.scheme)),
    field('motion', oneLine(payload.motion, LIMITS.motion)),
    field('lang', oneLine(payload.lang, LIMITS.lang)),
    field('dir', oneLine(payload.dir, LIMITS.dir)),
    field('element', oneLine(element.path, LIMITS.element)),
    field('rect', oneLine(element.rect, LIMITS.rect)),
    field('text', oneLine(element.text, LIMITS.text)),
    field('html', oneLine(element.html, LIMITS.html)),
    block('state', blockLines(payload.state, BLOCK_LIMITS.state, stateLine)),
    block('controls', blockLines(payload.controls, BLOCK_LIMITS.controls, controlLine)),
    block('log', blockLines(log, REVIEW_LOG_LINES, (line) => line)),
    '\ncomment:\n',
    commentText(payload.comment),
    '\n',
  ].join('')
}

export async function writeReview(root, payload, { now = new Date(), log = [] } = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('a review needs a comment')
  if (!commentText(payload.comment)) throw new Error('a review needs a comment')
  const directory = reviewsDirectory(root)
  await Deno.mkdir(directory, { recursive: true })
  const contents = formatReview(payload, now.toISOString(), log)
  for (let attempt = 0; attempt < 100; attempt++) {
    const name = reviewFileName(now, attempt)
    try {
      await Deno.writeTextFile(join(directory, name), contents, { createNew: true })
      return reviewDisplayPath(name)
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) throw error
    }
  }
  throw new Error('too many reviews written in the same millisecond')
}

const COMMENT_SEPARATOR = '\ncomment:\n'

const FIELD_LINE = /^([a-z]+): (.+)$/
const BLOCK_OPENER = /^([a-z]+):$/

export function parseReview(contents) {
  const separator = contents.indexOf(COMMENT_SEPARATOR)
  const header = separator === -1 ? contents : contents.slice(0, separator)
  const comment = separator === -1
    ? ''
    : contents.slice(separator + COMMENT_SEPARATOR.length).trim()
  const fields = {}
  const blocks = {}
  let open = null
  for (const line of header.split('\n')) {
    if (open && line.startsWith('  ')) {
      blocks[open].push(line.slice(2))
      continue
    }
    const field = line.match(FIELD_LINE)
    if (field) {
      fields[field[1]] = field[2]
      open = null
      continue
    }
    const opener = line.match(BLOCK_OPENER)
    if (opener) {
      open = opener[1]
      blocks[open] = []
      continue
    }
    open = null
  }
  return { ...fields, blocks, comment }
}

async function reviewFileNames(directory) {
  const names = []
  try {
    for await (const entry of Deno.readDir(directory)) {
      if (entry.isFile && entry.name.endsWith('.txt')) names.push(entry.name)
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error
  }
  return names.sort()
}

export async function listReviews(root) {
  const directory = reviewsDirectory(root)
  const reviews = []
  for (const name of await reviewFileNames(directory)) {
    reviews.push({ name, ...parseReview(await Deno.readTextFile(join(directory, name))) })
  }
  return reviews
}

export async function clearReviews(root) {
  const directory = reviewsDirectory(root)
  const names = await reviewFileNames(directory)
  for (const name of names) await Deno.remove(join(directory, name))
  await Deno.remove(directory).catch(() => {})
  return names.length
}

const NOTHING_YET =
  'no reviews yet - serve the app with imp start or imp preview, press the imp mark on the page, ' +
  'press Add review, and pick the element you want to comment on'

const count = (total) => `${total} review${total === 1 ? '' : 's'}`

const recordedBlocks = (entry) =>
  Object.entries(entry.blocks)
    .filter(([, lines]) => lines.length)
    .map(([label, lines]) => `${label} (${lines.length})`)

function printReview(entry) {
  console.log(bold(reviewDisplayPath(entry.name)))
  console.log(dim(`  ${[entry.time, entry.page].filter(Boolean).join('  ')}`))
  if (entry.element) console.log(dim(`  ${entry.element}`))
  for (const line of entry.comment.split('\n')) console.log(`  ${line}`)
  const recorded = recordedBlocks(entry)
  if (recorded.length) console.log(dim(`  also recorded: ${recorded.join(', ')}`))
  console.log('')
}

export async function review({ root, args = [] }) {
  const [subcommand, ...extra] = args
  if (subcommand !== undefined && subcommand !== 'clear') {
    throw new Error(`unknown argument '${subcommand}' - imp review takes 'clear' or nothing`)
  }
  if (extra.length) {
    throw new Error(`unexpected argument '${extra[0]}' - imp review takes 'clear' or nothing`)
  }
  if (subcommand === 'clear') {
    const cleared = await clearReviews(root)
    if (cleared) logger.info(`cleared ${count(cleared)} from .imp/reviews`)
    else logger.info('no reviews to clear')
    return
  }
  const reviews = await listReviews(root)
  if (!reviews.length) {
    logger.info(NOTHING_YET)
    return
  }
  for (const entry of reviews) printReview(entry)
  logger.info(`${count(reviews.length)} in .imp/reviews - 'imp review clear' deletes them all`)
}

export const REPORT_MODULE = '/@imp/report.js'

export const THEME_EDITOR_MODULE = '/@imp/theme-editor.js'

const WIDGET_SIZE = 40

const WIDGET_MARGIN = 16

const WIDGET_POSITION_KEY = 'imp-review-position'

const WIDGET_STYLES = `
  :host {
    all: initial;
    position: fixed;
    inset-block-end: ${WIDGET_MARGIN}px;
    inset-inline-end: ${WIDGET_MARGIN}px;
    inline-size: ${WIDGET_SIZE}px;
    block-size: ${WIDGET_SIZE}px;
    z-index: 2147483647;
    --surface: var(--imp-color-surface, #0f172a);
    --sunken: var(--imp-color-surface-sunken, #020617);
    --hover: var(--imp-color-surface-hover, #1e293b);
    --text: var(--imp-color-text, #e2e8f0);
    --muted: var(--imp-color-secondary, #94a3b8);
    --border: var(--imp-color-border, #334155);
    --accent: var(--imp-color-primary, #38bdf8);
    --on-accent: var(--imp-color-on-primary, #f8fafc);
    --danger: var(--imp-color-danger, #f87171);
    --warning: var(--imp-color-warning, #fbbf24);
    --info: var(--imp-color-info, #22d3ee);
    --success: var(--imp-color-success, #4ade80);
    --radius: var(--imp-radius-container, 10px);
    --radius-item: var(--imp-radius-item, 6px);
    --shadow: var(--imp-shadow-lg, 0 12px 32px rgb(2 6 23 / 55%));
    font-family: var(--imp-font-family, ui-sans-serif, system-ui, sans-serif);
    font-size: 13px;
    line-height: 1.5;
    color: var(--text);
  }

  [hidden] {
    display: none !important;
  }

  .outline {
    position: fixed;
    pointer-events: none;
    outline: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .dock {
    position: absolute;
    inset-inline-end: 0;
    inset-block-end: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .dock.down {
    inset-block-end: auto;
    inset-block-start: 0;
    flex-direction: column-reverse;
  }

  .dock.start {
    inset-inline-end: auto;
    inset-inline-start: 0;
    align-items: flex-start;
  }

  .toggle {
    display: block;
    inline-size: ${WIDGET_SIZE}px;
    block-size: ${WIDGET_SIZE}px;
    box-sizing: border-box;
    padding: 9px;
    border: 1px solid var(--border);
    border-radius: 50%;
    overflow: hidden;
    background: #101010;
    box-shadow: var(--shadow);
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .toggle svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    pointer-events: none;
  }

  .toggle.dragging {
    cursor: grabbing;
  }

  .toggle[aria-expanded='true'] {
    border-color: var(--accent);
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .action {
    display: grid;
    place-items: center;
    inline-size: 36px;
    block-size: 36px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--accent);
    box-shadow: var(--shadow);
    cursor: pointer;
    transition: opacity 160ms ease, scale 160ms ease, border-color 160ms ease;
  }

  .action:nth-child(2) {
    transition-delay: 40ms;
  }

  .action:nth-child(3) {
    transition-delay: 80ms;
  }

  .action:nth-child(4) {
    transition-delay: 120ms;
  }

  @starting-style {
    .actions:not([hidden]) .action {
      opacity: 0;
      scale: 0.5;
    }
  }

  .action:hover,
  .action[aria-pressed='true'] {
    border-color: var(--accent);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-sizing: border-box;
    inline-size: 340px;
    max-inline-size: calc(100dvi - ${WIDGET_MARGIN * 2}px);
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .view {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .title {
    margin: 0;
    color: var(--text);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .clear {
    display: grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-item);
    background: transparent;
    color: var(--muted);
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
  }

  .clear svg {
    inline-size: 15px;
    block-size: 15px;
  }

  .clear:not(:disabled):hover {
    border-color: var(--danger);
    background: var(--hover);
    color: var(--danger);
  }

  .clear:disabled {
    opacity: 0.45;
  }

  .hint,
  .status {
    margin: 0;
    color: var(--muted);
  }

  .status:empty {
    display: none;
  }

  .label {
    color: var(--text);
    font-weight: 600;
  }

  textarea {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-item);
    background: var(--sunken);
    color: var(--text);
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
  }

  .lines {
    margin: 0;
    padding: 8px;
    max-block-size: min(240px, 40dvb);
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-item);
    background: var(--sunken);
    font-family: var(--imp-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    font-size: 12px;
    list-style: none;
    overflow-wrap: anywhere;
  }

  .entry {
    display: flex;
    gap: 8px;
    inline-size: 100%;
    padding: 2px 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .entry:hover {
    background: var(--hover);
  }

  .entry .level {
    flex: none;
    min-inline-size: 3.5em;
    color: var(--muted);
  }

  .entry .text {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .entry[aria-expanded='true'] .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .error .level,
  .failed .level {
    color: var(--danger);
  }

  .warn .level {
    color: var(--warning);
  }

  .info .level {
    color: var(--info);
  }

  .ok .level {
    color: var(--success);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    --chip: var(--muted);
    padding: 2px 10px;
    border: 1px solid color-mix(in srgb, var(--chip) 45%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--chip);
    font-size: 12px;
  }

  .chip:hover {
    border-color: var(--chip);
  }

  .chip[aria-pressed='true'] {
    border-color: var(--chip);
    background: color-mix(in srgb, var(--chip) 28%, var(--surface));
    color: var(--text);
  }

  .lines .empty {
    color: var(--muted);
  }

  .card {
    max-block-size: min(520px, 60dvb);
    overflow: auto;
    padding: 0;
  }

  .card:empty {
    display: none;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row .grow {
    flex: 1;
  }

  button {
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-item);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }

  .primary:hover {
    background: color-mix(in oklab, var(--accent) 88%, var(--text));
  }

  .ghost {
    border-color: var(--border);
    background: transparent;
    color: var(--text);
  }

  .ghost:hover {
    background: var(--hover);
  }

  button:disabled {
    cursor: default;
    opacity: 0.6;
  }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .action {
      transition: none;
    }
  }
`

const ICON = (paths) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const ICONS = {
  review: ICON('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  console: ICON('<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>'),
  network: ICON(
    '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
  ),
  clear: ICON(
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  ),
  theme: ICON(
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>' +
      '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>' +
      '<circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>' +
      '<circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>' +
      '<circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  ),
}

const themeAction = `
    <button type="button" class="action" data-action="theme" aria-label="Theme editor"
      title="Theme editor" aria-pressed="false">${ICONS.theme}</button>`

const widgetMarkup = (mark, themeEditor) =>
  `<div class="outline" hidden></div>
<div class="dock">
  <div class="panel" id="imp-review-panel" hidden>
    <div class="view" data-view="idle">
      <p class="title">imp review</p>
      <p class="status" role="status"></p>
    </div>
    <div class="view" data-view="picking" hidden>
      <p class="title">imp review</p>
      <p class="hint">Click the element you want to review. imp saves your comment on this
        machine, with the page and the element. Your AI agent reads the reviews with imp review,
        so it knows exactly which element you mean.</p>
      <button type="button" class="ghost" data-action="cancel">Cancel</button>
    </div>
    <div class="view" data-view="commenting" hidden>
      <p class="title">imp review</p>
      <p class="hint">The element you picked stays outlined on the page. Say what is wrong with
        it.</p>
      <label class="label" for="imp-review-comment">Comment</label>
      <textarea id="imp-review-comment" rows="4"></textarea>
      <div class="row">
        <button type="button" class="primary" data-action="save">Save review</button>
        <button type="button" class="ghost" data-action="cancel">Cancel</button>
      </div>
    </div>
    <div class="view" data-view="log" hidden>
      <div class="head">
        <p class="title" data-log-title></p>
        <button type="button" class="clear" data-action="clear" disabled>${ICONS.clear}</button>
      </div>
      <div class="chips" role="group" aria-label="Filter the lines" style="flex-direction: column"></div>
      <ol class="lines"></ol>
      <p class="hint">What the page did since it loaded, as it happens. Click a line to see all of
        it. Open the developer tools of the browser for more.</p>
    </div>
    <div class="view" data-view="theme" hidden>
      <p class="title">Theme editor</p>
      <p class="status" role="status" data-theme-status></p>
      <div class="card"></div>
      <p class="hint">The page re-skins as you type. imp keeps the draft for the applied theme
        across reloads, until you press reset. Copy or download theme.js and pass it to init().</p>
    </div>
  </div>
  <div class="actions" id="imp-review-actions" hidden>
    <button type="button" class="action" data-action="pick" aria-label="Add review"
      title="Add review">${ICONS.review}</button>
    <button type="button" class="action" data-action="console" aria-label="Console logs"
      title="Console logs" aria-pressed="false">${ICONS.console}</button>
    <button type="button" class="action" data-action="network" aria-label="Network logs"
      title="Network logs" aria-pressed="false">${ICONS.network}</button>${
    themeEditor ? themeAction : ''
  }
  </div>
  <button type="button" class="toggle" aria-label="imp tools" aria-expanded="false"
    aria-controls="imp-review-actions">${mark}</button>
</div>`

const LOG_VIEWS = {
  console: {
    title: 'Console logs',
    clear: 'Clear console logs',
    empty: 'Nothing logged since the page loaded.',
    cleared: 'Cleared. The next line appears as it happens.',
    filters: [{ key: 'level', options: ['All', 'Log', 'Info', 'Warn', 'Error'], initial: 'All' }],
  },
  network: {
    title: 'Network logs',
    clear: 'Clear network logs',
    empty: 'No requests since the page loaded.',
    cleared: 'Cleared. The next request appears as it happens.',
    filters: [
      { key: 'kind', options: ['Fetch', 'Resource', 'Any'], initial: 'Fetch' },
      { key: 'outcome', options: ['All', 'OK', 'Failed'], initial: 'All' },
    ],
  },
}

const CHIP_COLORS = {
  All: 'var(--muted)',
  Any: 'var(--muted)',
  Log: 'var(--text)',
  Info: 'var(--info)',
  Warn: 'var(--warning)',
  Error: 'var(--danger)',
  OK: 'var(--success)',
  Failed: 'var(--danger)',
  Fetch: 'var(--accent)',
  Resource: 'var(--imp-color-purple, #c084fc)',
}

export const reviewWidgetScript = ({ mark, themeEditor }) => `
(() => {
  const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  if (!LOOPBACK.has(location.hostname)) return

  const SIZE = ${WIDGET_SIZE}
  const MARGIN = ${WIDGET_MARGIN}
  const DRAG_THRESHOLD = 4
  const LOG_VIEWS = ${JSON.stringify(LOG_VIEWS)}

  const host = document.createElement('div')
  host.id = 'imp-review'
  host.setAttribute('dir', 'ltr')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = ${JSON.stringify(`<style>${WIDGET_STYLES}</style>\n`)} + ${
  JSON.stringify(widgetMarkup(mark, themeEditor))
}

  const find = (selector) => shadow.querySelector(selector)
  const outline = find('.outline')
  const dock = find('.dock')
  const panel = find('.panel')
  const actions = find('.actions')
  const toggle = find('.toggle')
  const status = find('.status')
  const comment = find('textarea')
  const saveButton = find('[data-action="save"]')
  const logTitle = find('[data-log-title]')
  const clearButton = find('[data-action="clear"]')
  const chips = find('.chips')
  const lines = find('.lines')
  const views = {
    idle: find('[data-view="idle"]'),
    picking: find('[data-view="picking"]'),
    commenting: find('[data-view="commenting"]'),
    log: find('[data-view="log"]'),
    theme: find('[data-view="theme"]'),
  }
  const card = find('.card')
  const themeStatus = find('[data-theme-status]')

  let engine = null
  let editor = null
  let stopPicking = null
  let report = null
  let tool = null
  let unwatch = null
  let active = {}
  const cleared = new Set()
  const CHIP_COLORS = ${JSON.stringify(CHIP_COLORS)}

  const load = () => (engine ??= import('${REPORT_MODULE}'))

  const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

  const place = (x, y) => {
    const left = clamp(x, MARGIN, Math.max(MARGIN, innerWidth - SIZE - MARGIN))
    const top = clamp(y, MARGIN, Math.max(MARGIN, innerHeight - SIZE - MARGIN))
    host.style.insetInlineEnd = 'auto'
    host.style.insetBlockEnd = 'auto'
    host.style.insetInlineStart = \`\${Math.round(left)}px\`
    host.style.insetBlockStart = \`\${Math.round(top)}px\`
  }

  const remember = () => {
    const rect = host.getBoundingClientRect()
    try {
      localStorage.setItem('${WIDGET_POSITION_KEY}', JSON.stringify({ x: rect.left, y: rect.top }))
    } catch { /* storage unavailable */ }
  }

  const restore = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('${WIDGET_POSITION_KEY}'))
      if (typeof stored?.x === 'number' && typeof stored?.y === 'number') place(stored.x, stored.y)
    } catch { /* nothing remembered */ }
  }

  const orient = () => {
    const rect = host.getBoundingClientRect()
    dock.classList.toggle('down', rect.top + rect.height / 2 < innerHeight / 2)
    dock.classList.toggle('start', rect.left + rect.width / 2 < innerWidth / 2)
  }

  const showView = (name) => {
    for (const [key, node] of Object.entries(views)) node.hidden = key !== name
  }

  const showPanel = (open) => {
    panel.hidden = !open
  }

  const pressToolButtons = () => {
    for (const button of actions.querySelectorAll('[aria-pressed]')) {
      button.setAttribute('aria-pressed', String(button.dataset.action === tool))
    }
  }

  const expand = (open) => {
    if (open) orient()
    actions.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
  }

  const highlight = (placeOverElement) => (node) => {
    if (!node) {
      outline.hidden = true
      return
    }
    placeOverElement(outline, node)
    outline.hidden = false
  }

  const stopTool = () => {
    unwatch?.()
    unwatch = null
    tool = null
    card.replaceChildren()
    themeStatus.textContent = ''
  }

  const reset = () => {
    stopPicking?.()
    stopPicking = null
    report = null
    stopTool()
    pressToolButtons()
    outline.hidden = true
    showView('idle')
    showPanel(Boolean(status.textContent))
  }

  const collapse = () => {
    reset()
    status.textContent = ''
    showPanel(false)
    expand(false)
  }

  const pick = async () => {
    status.textContent = ''
    stopTool()
    pressToolButtons()
    showView('picking')
    showPanel(true)
    let picker
    try {
      picker = await load()
    } catch (error) {
      engine = null
      showView('idle')
      status.textContent = \`The review tools could not be loaded - \${error.message}\`
      return
    }
    const { captureReport, pickElement, placeOverElement } = picker
    stopPicking = pickElement({
      ignore: [host],
      onHover: highlight(placeOverElement),
      onPick: (node) => {
        stopPicking = null
        highlight(placeOverElement)(node)
        report = captureReport(node)
        comment.value = ''
        status.textContent = ''
        showView('commenting')
        showPanel(true)
        comment.focus()
      },
      onCancel: () => {
        stopPicking = null
        reset()
      },
    })
  }

  const save = async () => {
    const text = comment.value.trim()
    if (!text || !report) return
    saveButton.disabled = true
    try {
      const response = await fetch('${REVIEW_ENDPOINT}', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...report, comment: text }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? \`the server answered \${response.status}\`)
      status.textContent = \`Saved \${body.path}\`
    } catch (error) {
      status.textContent = \`Could not save the review - \${error.message}\`
    } finally {
      saveButton.disabled = false
      reset()
    }
  }

  const CONSOLE_FILTERS = { log: 'Log', debug: 'Log', info: 'Info', warn: 'Warn', error: 'Error' }

  const describe = (entry) => {
    if (entry.type === 'console') {
      return {
        level: entry.level,
        text: entry.text,
        tone: entry.level,
        group: CONSOLE_FILTERS[entry.level] ?? 'Log',
      }
    }
    if (entry.type === 'page') {
      return { level: 'uncaught', text: entry.text, tone: 'error', group: 'Error' }
    }
    const result = entry.error ?? String(entry.status)
    const failed = entry.error !== undefined || entry.status >= 400
    const from = entry.mock ? \` (mock: \${entry.mock})\` : ''
    const what = entry.destination ? \` (\${entry.destination})\` : ''
    return {
      level: result,
      text: \`\${entry.method} \${entry.url} \${entry.ms}ms\${what}\${from}\`,
      tone: failed ? 'failed' : 'ok',
      group: failed ? 'Failed' : 'OK',
      kind: entry.kind === 'resource' ? 'Resource' : 'Fetch',
    }
  }

  const belongs = (entry) =>
    tool === 'network' ? entry.type === 'net' : entry.type === 'console' || entry.type === 'page'

  const matchesFilter = (entry) => {
    const described = describe(entry)
    const byGroup = active.level ?? active.outcome ?? 'All'
    if (byGroup !== 'All' && described.group !== byGroup) return false
    return !active.kind || active.kind === 'Any' || described.kind === active.kind
  }

  const renderChips = () => {
    chips.replaceChildren(...LOG_VIEWS[tool].filters.map((group) => {
      const row = document.createElement('div')
      row.className = 'chips'
      row.dataset.group = group.key
      row.append(...group.options.map((name) => {
        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'chip'
        chip.dataset.filter = name
        chip.style.setProperty('--chip', CHIP_COLORS[name])
        chip.setAttribute('aria-pressed', String(name === active[group.key]))
        chip.textContent = name
        return chip
      }))
      return row
    }))
  }

  const entryFor = (entry) => {
    const { level, text, tone } = describe(entry)
    const item = document.createElement('li')
    const row = document.createElement('button')
    row.type = 'button'
    row.className = \`entry \${tone}\`
    row.setAttribute('aria-expanded', 'false')
    const tag = document.createElement('span')
    tag.className = 'level'
    tag.textContent = level
    const body = document.createElement('span')
    body.className = 'text'
    body.textContent = text
    row.append(tag, body)
    item.append(row)
    return item
  }

  const emptyItem = (text) => {
    const item = document.createElement('li')
    item.className = 'empty'
    item.textContent = text
    return item
  }

  const render = () => {
    const { empty, cleared: emptied } = LOG_VIEWS[tool]
    const all = (globalThis.__impTelemetry?.entries() ?? []).filter(belongs)
    const shown = all.filter(matchesFilter)
    clearButton.disabled = !all.length
    lines.replaceChildren(...shown.map(entryFor))
    if (!shown.length) {
      const reason = all.length ? 'No line matches.' : cleared.has(tool) ? emptied : empty
      lines.append(emptyItem(reason))
    }
    lines.scrollTop = lines.scrollHeight
  }

  const clear = () => {
    globalThis.__impTelemetry?.clear(belongs)
    cleared.add(tool)
    render()
  }

  const append = (entry) => {
    if (!belongs(entry)) return
    clearButton.disabled = false
    if (!matchesFilter(entry)) return
    const atEnd = lines.scrollTop + lines.clientHeight >= lines.scrollHeight - 4
    lines.querySelector('.empty')?.remove()
    lines.append(entryFor(entry))
    while (lines.children.length > ${TELEMETRY_ENTRIES}) lines.firstElementChild.remove()
    if (atEnd) lines.scrollTop = lines.scrollHeight
  }

  const showLog = (name) => {
    stopPicking?.()
    stopPicking = null
    report = null
    outline.hidden = true
    status.textContent = ''
    stopTool()
    tool = name
    pressToolButtons()
    logTitle.textContent = LOG_VIEWS[name].title
    clearButton.setAttribute('aria-label', LOG_VIEWS[name].clear)
    clearButton.title = LOG_VIEWS[name].clear
    active = Object.fromEntries(LOG_VIEWS[name].filters.map((group) => [group.key, group.initial]))
    renderChips()
    showView('log')
    showPanel(true)
    render()
    unwatch = globalThis.__impTelemetry?.watch(append) ?? null
  }

  const loadEditor = () => (editor ??= import('${THEME_EDITOR_MODULE}'))

  const showTheme = async () => {
    stopPicking?.()
    stopPicking = null
    report = null
    outline.hidden = true
    status.textContent = ''
    stopTool()
    tool = 'theme'
    pressToolButtons()
    showView('theme')
    showPanel(true)
    let module
    try {
      module = await loadEditor()
    } catch (error) {
      editor = null
      if (tool !== 'theme') return
      themeStatus.textContent = \`The theme editor could not be loaded - \${error.message}\`
      return
    }
    if (tool !== 'theme') return
    card.replaceChildren(
      module.themeEditor({ theme: module.appliedThemeName(), tokensOnly: true }),
    )
  }

  let drag = null
  let dragged = false

  toggle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const rect = host.getBoundingClientRect()
    drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
    dragged = false
    toggle.setPointerCapture(event.pointerId)
  })

  toggle.addEventListener('pointermove', (event) => {
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!dragged) {
      dragged = true
      toggle.classList.add('dragging')
      collapse()
    }
    place(drag.left + dx, drag.top + dy)
  })

  const endDrag = () => {
    if (!drag) return
    drag = null
    toggle.classList.remove('dragging')
    if (dragged) remember()
  }

  toggle.addEventListener('pointerup', endDrag)
  toggle.addEventListener('pointercancel', endDrag)

  toggle.addEventListener('click', () => {
    if (dragged) {
      dragged = false
      return
    }
    if (actions.hidden) expand(true)
    else collapse()
  })

  actions.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action
    if (action === 'pick') pick()
    else if (action === 'console' || action === 'network' || action === 'theme') {
      if (tool === action) reset()
      else if (action === 'theme') showTheme()
      else showLog(action)
    }
  })

  panel.addEventListener('click', (event) => {
    const entry = event.target.closest('.entry')
    if (entry) {
      entry.setAttribute('aria-expanded', String(entry.getAttribute('aria-expanded') !== 'true'))
      return
    }
    const action = event.target.closest('[data-action]')?.dataset.action
    if (action === 'save') save()
    else if (action === 'cancel') reset()
    else if (action === 'clear') clear()
  })

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip')
    if (!chip || !tool) return
    active[chip.closest('[data-group]').dataset.group] = chip.dataset.filter
    renderChips()
    render()
  })

  comment.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  })

  addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || actions.hidden || stopPicking) return
    collapse()
  }, true)

  addEventListener('resize', () => {
    if (host.style.insetInlineStart) {
      place(parseFloat(host.style.insetInlineStart), parseFloat(host.style.insetBlockStart))
    }
  })

  const attach = () => {
    if (!host.isConnected) document.body.append(host)
  }

  const install = () => {
    restore()
    attach()
    new MutationObserver(attach).observe(document.body, { childList: true })
  }

  if (document.body) install()
  else addEventListener('DOMContentLoaded', install, { once: true })
})()
`
