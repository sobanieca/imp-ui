export const reviewWidget = ({
  size,
  margin,
  logViews,
  chipColors,
  html,
  positionKey,
  reviewEndpoint,
  reportModule,
  themeEditorModule,
  telemetryEntries,
  previewFrameNamePrefix,
}) => {
  const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  if (!LOOPBACK.has(location.hostname)) return
  if (globalThis.name.startsWith(previewFrameNamePrefix)) return

  const DRAG_THRESHOLD = 4

  const host = document.createElement('div')
  host.id = 'imp-review'
  host.setAttribute('dir', 'ltr')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = html

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

  const load = () => (engine ??= import(reportModule))

  const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

  const place = (x, y) => {
    const left = clamp(x, margin, Math.max(margin, innerWidth - size - margin))
    const top = clamp(y, margin, Math.max(margin, innerHeight - size - margin))
    host.style.insetInlineEnd = 'auto'
    host.style.insetBlockEnd = 'auto'
    host.style.insetInlineStart = `${Math.round(left)}px`
    host.style.insetBlockStart = `${Math.round(top)}px`
  }

  const remember = () => {
    const rect = host.getBoundingClientRect()
    try {
      localStorage.setItem(positionKey, JSON.stringify({ x: rect.left, y: rect.top }))
    } catch {
      return
    }
  }

  const restore = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(positionKey))
      if (typeof stored?.x === 'number' && typeof stored?.y === 'number') place(stored.x, stored.y)
    } catch {
      return
    }
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
      status.textContent = `The review tools could not be loaded - ${error.message}`
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
      const response = await fetch(reviewEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...report, comment: text }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
      status.textContent = `Saved ${body.path}`
    } catch (error) {
      status.textContent = `Could not save the review - ${error.message}`
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
    const from = entry.mock ? ` (mock: ${entry.mock})` : ''
    const what = entry.destination ? ` (${entry.destination})` : ''
    return {
      level: result,
      text: `${entry.method} ${entry.url} ${entry.ms}ms${what}${from}`,
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
    chips.replaceChildren(
      ...logViews[tool].filters.map((group) => {
        const row = document.createElement('div')
        row.className = 'chips'
        row.dataset.group = group.key
        row.append(
          ...group.options.map((name) => {
            const chip = document.createElement('button')
            chip.type = 'button'
            chip.className = 'chip'
            chip.dataset.filter = name
            chip.style.setProperty('--chip', chipColors[name])
            chip.setAttribute('aria-pressed', String(name === active[group.key]))
            chip.textContent = name
            return chip
          }),
        )
        return row
      }),
    )
  }

  const entryFor = (entry) => {
    const { level, text, tone } = describe(entry)
    const item = document.createElement('li')
    const row = document.createElement('button')
    row.type = 'button'
    row.className = `entry ${tone}`
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
    const { empty, cleared: emptied } = logViews[tool]
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
    while (lines.children.length > telemetryEntries) lines.firstElementChild.remove()
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
    logTitle.textContent = logViews[name].title
    clearButton.setAttribute('aria-label', logViews[name].clear)
    clearButton.title = logViews[name].clear
    active = Object.fromEntries(logViews[name].filters.map((group) => [group.key, group.initial]))
    renderChips()
    showView('log')
    showPanel(true)
    render()
    unwatch = globalThis.__impTelemetry?.watch(append) ?? null
  }

  const loadEditor = () => (editor ??= import(themeEditorModule))

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
      themeStatus.textContent = `The theme editor could not be loaded - ${error.message}`
      return
    }
    if (tool !== 'theme') return
    card.replaceChildren(module.themeEditor({ theme: module.appliedThemeName(), tokensOnly: true }))
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

  addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || actions.hidden || stopPicking) return
      collapse()
    },
    true,
  )

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
}
