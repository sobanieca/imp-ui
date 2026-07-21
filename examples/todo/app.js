import {
  button,
  component,
  computed,
  details,
  div,
  el,
  env,
  footer,
  form,
  h1,
  h2,
  header,
  html,
  initState,
  input,
  label,
  li,
  mount,
  p,
  section,
  small,
  span,
  strong,
  summary,
  ul,
  useState,
} from 'imp'

const STAGES = [
  { id: 'new', label: 'new', accent: '#7fb1ff' },
  { id: 'progress', label: 'in progress', accent: '#ffcf66' },
  { id: 'done', label: 'done', accent: '#63d68a' },
]

const FILTERS = ['all', 'open', 'done']

const SEED_TODOS = [
  { id: 'seed-readme', title: 'read the demo script in README.md', done: false },
  { id: 'seed-drag', title: 'drag a card between columns', done: false },
  { id: 'seed-theme', title: 'flip the theme', done: true },
]

const TIPS = [
  'drag a card mid-edit — the input keeps its text while the stage badge rebinds',
  'notes typed on a list item survive toggles of other items — the keyed each keeps their DOM',
  'toggle the session clock — unmounting clears its interval, remounting starts it fresh',
  null,
  'switch themes — a headless component syncs body[data-theme] and localStorage',
]

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const logActivity = (activity, entry) => activity.set((entries) => [entry, ...entries].slice(0, 6))

const baseStyles = `
  * { box-sizing: border-box }
`

const buttonStyles = `
  button {
    background: var(--panel-2);
    color: var(--text);
    border: 1px solid var(--border-2);
    border-radius: 8px;
    padding: 8px 12px;
    font: inherit;
    cursor: pointer;
  }
  button:hover { border-color: var(--focus) }
  button.primary {
    background: var(--primary);
    border-color: var(--primary-border);
    color: #fff;
  }
  button.ghost { background: transparent }
  button.danger:hover {
    border-color: #a84a4a;
    color: #e07777;
  }
`

const fieldStyles = `
  input:not([type='checkbox']) {
    background: var(--field);
    border: 1px solid var(--border-2);
    border-radius: 8px;
    padding: 8px 10px;
    color: var(--text);
    font: inherit;
  }
  input:focus {
    outline: none;
    border-color: var(--focus);
  }
`

const themeSync = component('todo-theme-sync', {
  onMount: () => {
    const current = useState('todo.theme')
    current.watch((value) => {
      document.body.dataset.theme = value
      localStorage.setItem('imp-todo-theme', value)
    })
  },
})

let clockInterval = null

const sessionClock = component('todo-session-clock', {
  styles: `
    .clock {
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
  `,
  onMount: () => {
    const startedAt = Date.now()
    const face = span({ class: 'clock-face', style: 'font-variant-numeric: tabular-nums' }, '0s')
    clockInterval = setInterval(() => {
      face.textContent = `${Math.round((Date.now() - startedAt) / 1000)}s`
    }, 1000)
    return span({ class: 'clock' }, 'this mount: ', face)
  },
  onUnmount: () => clearInterval(clockInterval),
})

let tipCursor = 0

const tipText = component('todo-tip-text', {
  styles: `
    span { flex: 1 }
    .muted { color: var(--muted) }
  `,
  placeholder: () => span({ class: 'muted' }, 'fetching a tip…'),
  onMount: async () => {
    const tip = TIPS[tipCursor % TIPS.length]
    tipCursor++
    await delay(400)
    if (tip === null) throw new Error('the tip service failed — it does, every fourth tip')
    return span(tip)
  },
})

const tipRow = (epoch, content, actionLabel, errorClass) =>
  div(
    { class: ['tip', errorClass] },
    strong('tip'),
    content,
    button({ class: 'ghost', events: { click: () => epoch.set((n) => n + 1) } }, actionLabel),
  )

const tipBox = component('todo-tip-box', {
  styles: `
    ${buttonStyles}
    .tip {
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px dashed var(--border);
      border-radius: 12px;
      padding: 10px 16px;
      margin-bottom: 16px;
      color: var(--muted);
    }
    .tip strong {
      color: var(--text);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.08em;
    }
    .tip span { flex: 1 }
    .tip-error { border-color: #a84a4a }
  `,
  onMount: () => tipRow(useState('todo.tipEpoch'), tipText(), 'next tip'),
  onError: (error) => tipRow(useState('todo.tipEpoch'), span(error.message), 'retry', 'tip-error'),
})

let draggedCard = null

const todoCard = component('todo-card', {
  styles: `
    ${baseStyles}
    ${buttonStyles}
    ${fieldStyles}
    .card {
      background: var(--panel);
      border: 1px solid var(--border-2);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-top strong {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .grip {
      cursor: grab;
      color: var(--muted);
      user-select: none;
    }
    .grip:active { cursor: grabbing }
    .badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .badge-new {
      background: #173157;
      color: #7fb1ff;
    }
    .badge-in-progress {
      background: #4a3a12;
      color: #ffcf66;
    }
    .badge-done {
      background: #14391f;
      color: #63d68a;
    }
    .card-note {
      margin: 0;
      color: var(--muted);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .card-edit {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card-edit input { min-width: 0 }
    .card-edit-actions {
      display: flex;
      gap: 8px;
    }
    button.icon {
      padding: 4px 8px;
      line-height: 1;
    }
  `,
  onMount: ({ title = 'untitled', note = '', startEditing = false } = {}) => {
    const stage = useState('todo.stage')
    const activity = useState('todo.activity')
    const cardTitle = initState('todo.cardTitle', title)
    const cardNote = initState('todo.cardNote', note)
    const editing = initState('todo.editing', startEditing)
    const titleField = input({ placeholder: 'card title…', 'aria-label': 'card title' })
    const noteField = input({ placeholder: 'notes…', 'aria-label': 'card notes' })
    const openEdit = () => {
      titleField.value = cardTitle.get()
      noteField.value = cardNote.get()
      editing.set(true)
      queueMicrotask(() => titleField.focus())
    }
    if (startEditing) {
      titleField.value = title
      noteField.value = note
      queueMicrotask(() => {
        titleField.focus()
        titleField.select()
      })
    }
    const save = () => {
      cardTitle.set(titleField.value.trim() || cardTitle.get())
      cardNote.set(noteField.value.trim())
      editing.set(false)
      logActivity(activity, `edited card “${cardTitle.get()}”`)
    }
    const startDrag = (event) => {
      draggedCard = event.target.getRootNode().host
      event.dataTransfer.setData('text/plain', 'todo-card')
      event.dataTransfer.effectAllowed = 'move'
    }
    return div(
      { class: 'card' },
      div(
        { class: 'card-top' },
        span(
          {
            class: 'grip',
            draggable: true,
            events: {
              dragstart: startDrag,
              dragend: () => {
                draggedCard = null
              },
            },
          },
          '⠿',
        ),
        strong(cardTitle.text()),
        stage.view((current) =>
          span({ class: ['badge', `badge-${current.replaceAll(' ', '-')}`] }, current)
        ),
        button(
          { class: 'ghost icon', 'aria-label': 'edit card', events: { click: openEdit } },
          '✎',
        ),
      ),
      editing.view((on) =>
        on
          ? div(
            { class: 'card-edit' },
            titleField,
            noteField,
            div(
              { class: 'card-edit-actions' },
              button({ class: 'primary', events: { click: save } }, 'save'),
              button({ class: 'ghost', events: { click: () => editing.set(false) } }, 'cancel'),
            ),
          )
          : cardNote.view((value) => value && p({ class: 'card-note' }, value))
      ),
    )
  },
})

const boardColumn = component('todo-board-column', {
  styles: `
    ${baseStyles}
    .column {
      background: var(--panel-2);
      border: 1px solid var(--border-2);
      border-radius: 12px;
      padding: 12px;
    }
    .column h2 {
      margin: 4px 4px 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }
    .column.drag-over { border-color: var(--accent) }
    .cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 180px;
    }
    @media (max-width: 720px) {
      .cards { min-height: 0 }
    }
  `,
  onMount: ({ label: stageLabel, accent, cards }) => {
    initState('todo.stage', stageLabel)
    const activity = useState('todo.activity')
    const acceptCard = (event) => {
      event.preventDefault()
      event.currentTarget.classList.remove('drag-over')
      if (!draggedCard) return
      cards.append(draggedCard)
      logActivity(activity, `card moved to “${stageLabel}”`)
    }
    return div(
      {
        class: 'column',
        style: { '--accent': accent },
        events: {
          dragover: (event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            event.currentTarget.classList.add('drag-over')
          },
          dragleave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              event.currentTarget.classList.remove('drag-over')
            }
          },
          drop: acceptCard,
        },
      },
      h2(stageLabel),
      cards,
    )
  },
})

const todoApp = component('todo-app', {
  styles: `
    ${baseStyles}
    ${buttonStyles}
    ${fieldStyles}
    .app {
      max-width: 1040px;
      margin: 0 auto;
      padding: 0 24px;
    }
    .skeleton {
      max-width: 1040px;
      margin: 40px auto;
      padding: 40px 24px;
      border: 1px dashed var(--border);
      border-radius: 12px;
      text-align: center;
      color: var(--muted);
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 0 16px;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .clock-toggle {
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .panel h2 {
      margin: 0 0 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .panel-head h2 { margin: 0 }
    .add-form {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .add-form input { flex: 1 }
    .list-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .filters {
      display: flex;
      gap: 6px;
    }
    .chip {
      padding: 4px 12px;
      border-radius: 999px;
    }
    .chip.active {
      border-color: var(--focus);
      color: var(--focus);
    }
    .counts {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--panel-2);
      border: 1px solid var(--border-2);
      border-radius: 10px;
      padding: 8px 12px;
    }
    .item-check {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .item.done .item-check span {
      text-decoration: line-through;
      color: var(--muted);
    }
    .item .notes { width: 220px }
    .empty {
      color: var(--muted);
      text-align: center;
      margin: 12px 0 4px;
    }
    .spotlight {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 12px 0 0;
    }
    .pill {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--border-2);
      white-space: nowrap;
    }
    .pill-done {
      text-decoration: line-through;
      color: var(--muted);
    }
    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      align-items: start;
    }
    .activity {
      color: var(--muted);
      margin-bottom: 16px;
    }
    .activity summary { cursor: pointer }
    .activity ul { margin: 8px 0 0 }
    .app-footer {
      color: var(--muted);
      padding: 8px 0 32px;
    }
    .muted { color: var(--muted) }
    @media (max-width: 720px) {
      .app { padding: 0 16px }
      .toolbar {
        flex-wrap: wrap;
        gap: 12px;
        padding: 16px 0 12px;
      }
      .toolbar-actions {
        flex-wrap: wrap;
        gap: 10px;
      }
      .list-tools { flex-wrap: wrap }
      .board { grid-template-columns: 1fr }
      .item { flex-wrap: wrap }
      .item .notes {
        order: 1;
        width: 100%;
      }
    }
    @media (max-width: 480px) {
      .add-form { flex-wrap: wrap }
      .add-form input { flex: 1 1 100% }
    }
  `,
  placeholder: () => div({ class: 'skeleton' }, 'loading todos…'),
  onMount: async () => {
    const theme = initState('todo.theme', localStorage.getItem('imp-todo-theme') ?? 'dark')
    const items = initState('todo.items', [])
    const filter = initState('todo.filter', 'all')
    const activity = initState('todo.activity', [])
    const clockOn = initState('todo.clockOn', false)
    const tipEpoch = initState('todo.tipEpoch', 0)

    const log = (entry) => logActivity(activity, entry)

    const cardSlots = Object.fromEntries(
      STAGES.map((stage) => [stage.id, div({ class: 'cards' })]),
    )

    const matchesFilter = (kind, item) => kind === 'all' || (kind === 'done') === item.done

    const visible = computed(
      [items, filter],
      (list, kind) => list.filter((item) => matchesFilter(kind, item)),
    )

    const counts = computed(
      [items],
      (list) =>
        `${list.filter((item) => !item.done).length} open · ${
          list.filter((item) => item.done).length
        } done`,
    )

    const doneRatio = computed(
      [items],
      (list) => list.length === 0 ? 0 : list.filter((item) => item.done).length / list.length,
    )

    const completionMeter = el('meter', { min: 0, max: 1, value: 0, 'aria-label': 'completion' })
    doneRatio.watch((ratio) => {
      completionMeter.value = ratio
    })

    const titleField = input({
      id: 'draft',
      placeholder: 'what needs doing?',
      'aria-label': 'new todo title',
    })

    const addItem = (event) => {
      event.preventDefault()
      const title = titleField.value.trim()
      if (!title) return
      items.set((list) => [...list, { id: crypto.randomUUID(), title, done: false }])
      log(`added “${title}”`)
      titleField.value = ''
      titleField.focus()
    }

    const toggleItem = (id) =>
      items.set((list) => list.map((item) => item.id === id ? { ...item, done: !item.done } : item))

    const removeItem = (item) => {
      items.set((list) => list.filter((entry) => entry.id !== item.id))
      log(`removed “${item.title}”`)
    }

    const promoteItem = (item, note) => {
      items.set((list) => list.filter((entry) => entry.id !== item.id))
      cardSlots.new.prepend(todoCard({ title: item.title, note }))
      log(`promoted “${item.title}” to the board`)
    }

    const listItem = (item) => {
      const noteField = input({
        class: 'notes',
        placeholder: 'notes…',
        'aria-label': `notes for ${item.title}`,
      })
      return li(
        { class: { item: true, done: item.done }, 'data-id': item.id },
        label(
          { class: 'item-check' },
          input({
            type: 'checkbox',
            checked: item.done,
            events: { change: () => toggleItem(item.id) },
          }),
          span(item.title),
        ),
        noteField,
        button(
          { class: 'ghost', events: { click: () => promoteItem(item, noteField.value.trim()) } },
          'to board',
        ),
        button(
          {
            class: 'ghost danger',
            'aria-label': `remove ${item.title}`,
            events: { click: () => removeItem(item) },
          },
          '✕',
        ),
      )
    }

    const toolbar = header(
      { class: 'toolbar' },
      h1('imp todo'),
      div(
        { class: 'toolbar-actions' },
        clockOn.view((on) => on && sessionClock()),
        label(
          { class: 'clock-toggle' },
          input({
            type: 'checkbox',
            events: { change: (event) => clockOn.set(event.currentTarget.checked) },
          }),
          'session clock',
        ),
        button(
          {
            class: 'ghost',
            events: {
              click: () => theme.set((current) => current === 'dark' ? 'light' : 'dark'),
            },
          },
          theme.text((current) => current === 'dark' ? 'light mode' : 'dark mode'),
        ),
      ),
    )

    const listSection = section(
      { class: 'panel' },
      h2('quick list'),
      form(
        { class: 'add-form', events: { submit: addItem } },
        titleField,
        button('add', { id: 'add', class: 'primary', type: 'submit' }),
      ),
      div(
        { class: 'list-tools' },
        div(
          { class: 'filters' },
          filter.view((current) =>
            FILTERS.map((kind) =>
              button(
                {
                  class: { chip: true, active: current === kind },
                  events: { click: () => filter.set(kind) },
                },
                kind,
              )
            )
          ),
        ),
        span({ class: 'counts' }, counts.text(), completionMeter),
      ),
      ul({ class: 'list' }, visible.each(listItem, (item) => item.id)),
      visible.view((list) =>
        list.length === 0 && p({ class: 'empty' }, 'nothing here — add a todo or switch filters')
      ),
      filter.view((kind) =>
        p(
          { class: 'spotlight' },
          span({ class: 'muted' }, `spotlight · ${kind}:`),
          items.each((item) =>
            matchesFilter(kind, item) &&
            span({ class: ['pill', item.done && 'pill-done'] }, item.title)
          ),
        )
      ),
    )

    const boardSection = section(
      { class: 'panel' },
      div(
        { class: 'panel-head' },
        h2('board'),
        button(
          {
            class: 'primary',
            events: {
              click: () => {
                cardSlots.new.prepend(todoCard({ startEditing: true }))
                log('added a card to the board')
              },
            },
          },
          '+ new card',
        ),
      ),
      div(
        { class: 'board' },
        STAGES.map((stage) => boardColumn({ ...stage, cards: cardSlots[stage.id] })),
      ),
    )

    const activitySection = details(
      { class: 'activity' },
      summary('recent activity'),
      ul(activity.each((entry) => li(entry))),
    )

    const appFooter = footer(
      { class: 'app-footer' },
      small(`environment: ${env.APP_ENV ?? 'none — try imp start --env dev'}`),
    )

    const view = div(
      { class: 'app' },
      themeSync(),
      toolbar,
      listSection,
      boardSection,
      tipEpoch.view(() => tipBox()),
      activitySection,
      appFooter,
    )

    await delay(Number(env.SEED_DELAY_MS ?? 700))
    items.set(SEED_TODOS)
    log(`loaded ${SEED_TODOS.length} seed todos`)
    return view
  },
})

const dismissIntro = mount(
  '#intro',
  div(
    { class: 'intro' },
    html(
      '<p><strong>welcome!</strong> this little todo app exercises <em>every</em> imp feature — <code>README.md</code> next to it maps each one to the code.</p>',
    ),
    button({ class: 'ghost', events: { click: [() => dismissIntro(), { once: true }] } }, 'got it'),
  ),
)

mount('#app', todoApp())
