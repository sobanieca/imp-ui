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
  'no reviews yet - serve the app with imp start or imp preview, press the review button in the ' +
  'corner of the page, and pick the element you want to comment on'

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

const WIDGET_STYLES = `
  :host {
    all: initial;
    position: fixed;
    inset-block-end: 16px;
    inset-inline-end: 16px;
    z-index: 2147483647;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #e2e8f0;
  }

  [hidden] {
    display: none !important;
  }

  .outline {
    position: fixed;
    pointer-events: none;
    outline: 2px solid #38bdf8;
    background: rgb(56 189 248 / 18%);
  }

  .dock {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .toggle {
    display: grid;
    place-items: center;
    inline-size: 40px;
    block-size: 40px;
    padding: 0;
    border: 1px solid #334155;
    border-radius: 999px;
    background: #0f172a;
    color: #7dd3fc;
    box-shadow: 0 6px 20px rgb(2 6 23 / 45%);
    cursor: pointer;
  }

  .toggle[aria-expanded='true'] {
    border-color: #38bdf8;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    inline-size: 300px;
    max-inline-size: calc(100dvi - 32px);
    padding: 12px;
    border: 1px solid #334155;
    border-radius: 10px;
    background: #0f172a;
    box-shadow: 0 12px 32px rgb(2 6 23 / 55%);
  }

  .view {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .title {
    margin: 0;
    color: #f8fafc;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hint,
  .status {
    margin: 0;
    color: #94a3b8;
  }

  .status:empty {
    display: none;
  }

  .label {
    color: #cbd5e1;
    font-weight: 600;
  }

  textarea {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 8px;
    border: 1px solid #334155;
    border-radius: 6px;
    background: #020617;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  button {
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .primary {
    background: #0284c7;
    color: #f8fafc;
  }

  .primary:hover {
    background: #0369a1;
  }

  .ghost {
    border-color: #334155;
    background: transparent;
    color: #cbd5e1;
  }

  .ghost:hover {
    border-color: #64748b;
  }

  button:disabled {
    cursor: default;
    opacity: 0.6;
  }

  :focus-visible {
    outline: 2px solid #7dd3fc;
    outline-offset: 2px;
  }
`

const WIDGET_MARKUP = `<div class="outline" hidden></div>
<div class="dock">
  <div class="panel" id="imp-review-panel" hidden>
    <p class="title">imp review</p>
    <div class="view" data-view="idle">
      <p class="hint">Pick an element and leave a comment - imp writes it to .imp/reviews/ for an
        AI agent to read.</p>
      <button type="button" class="primary" data-action="pick">Add review</button>
      <p class="status" role="status"></p>
    </div>
    <div class="view" data-view="picking" hidden>
      <p class="hint">Click the element you want to review. Enter picks the highlighted one,
        Escape cancels.</p>
      <button type="button" class="ghost" data-action="cancel">Cancel</button>
    </div>
    <div class="view" data-view="commenting" hidden>
      <p class="hint">The element you picked stays outlined on the page.</p>
      <label class="label" for="imp-review-comment">Comment</label>
      <textarea id="imp-review-comment" rows="4"></textarea>
      <div class="row">
        <button type="button" class="primary" data-action="save">Save review</button>
        <button type="button" class="ghost" data-action="cancel">Cancel</button>
      </div>
    </div>
  </div>
  <button type="button" class="toggle" aria-label="imp review" aria-expanded="false"
    aria-controls="imp-review-panel"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    /></svg></button>
</div>`

export const reviewWidgetScript = () => `
(() => {
  const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  if (!LOOPBACK.has(location.hostname)) return

  const host = document.createElement('div')
  host.id = 'imp-review'
  host.setAttribute('dir', 'ltr')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = ${JSON.stringify(`<style>${WIDGET_STYLES}</style>\n${WIDGET_MARKUP}`)}

  const find = (selector) => shadow.querySelector(selector)
  const outline = find('.outline')
  const panel = find('.panel')
  const toggle = find('.toggle')
  const status = find('.status')
  const comment = find('textarea')
  const saveButton = find('[data-action="save"]')
  const views = {
    idle: find('[data-view="idle"]'),
    picking: find('[data-view="picking"]'),
    commenting: find('[data-view="commenting"]'),
  }

  let engine = null
  let stopPicking = null
  let report = null

  const load = () => (engine ??= import('${REPORT_MODULE}'))

  const showView = (name) => {
    for (const [key, node] of Object.entries(views)) node.hidden = key !== name
  }

  const openPanel = (open) => {
    panel.hidden = !open
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

  const reset = () => {
    stopPicking?.()
    stopPicking = null
    report = null
    outline.hidden = true
    showView('idle')
  }

  const pick = async () => {
    status.textContent = ''
    showView('picking')
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
        openPanel(true)
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
      reset()
      status.textContent = \`Saved \${body.path}\`
    } catch (error) {
      reset()
      status.textContent = \`Could not save the review - \${error.message}\`
    } finally {
      saveButton.disabled = false
    }
  }

  toggle.addEventListener('click', () => {
    if (panel.hidden) {
      openPanel(true)
      return
    }
    reset()
    openPanel(false)
  })

  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action
    if (action === 'pick') pick()
    else if (action === 'save') save()
    else if (action === 'cancel') reset()
  })

  comment.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  })

  addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden || stopPicking) return
    reset()
    openPanel(false)
  }, true)

  const attach = () => {
    if (!host.isConnected) document.body.append(host)
  }

  const install = () => {
    attach()
    new MutationObserver(attach).observe(document.body, { childList: true })
  }

  if (document.body) install()
  else addEventListener('DOMContentLoaded', install, { once: true })
})()
`
