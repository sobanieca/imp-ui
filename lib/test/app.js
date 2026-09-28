import { component, init, mount } from 'imp'
import { button, div, h1, input, li, span, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { applyTheme } from 'imp/theme'
import { lang, setLang, t } from 'imp/i18n'
import { button as stdButton, heading, icon, link, menuButton, text } from 'imp/std'
import { luTrash } from 'imp/icons'
import { accordion, codeBlock, emptyState, tooltip } from 'imp/std/display'
import {
  checkbox,
  codeEditor,
  colorPicker,
  comboBox,
  datePicker,
  form,
  imageUpload,
  radioGroup,
  richTextEditor,
  select,
  slider,
  submitForm,
  textField,
  toggle,
} from 'imp/std/inputs'
import { bugReport, notice, notify, progress, toast } from 'imp/std/feedback'
import { shell } from 'imp/std/shell'
import { dialog, drawer, flex, splitPane, stack, tabs } from 'imp/std/layout'
import { beforeLeave, navigate, useRoute } from 'imp/router'
import { calendar, chart, gantt, map, table, tree } from 'imp/std/data'

const demoMessages = {
  en: { demo: { title: 'Translations', notes: 'Notes: {total}' } },
  pl: {
    demo: { title: 'Tłumaczenia', notes: 'Notatki: {total}' },
    imp: { state: { empty: 'Nic tu jeszcze nie ma' } },
  },
}

await init({
  theme: 'imp-light',
  lang: 'en',
  translations: {
    en: () => Promise.resolve({ default: demoMessages.en }),
    pl: () => Promise.resolve({ default: demoMessages.pl }),
  },
})

const todoList = component('todo-list', {
  setup: (self) => {
    const items = useState(self, 'todo.items')
    const toggleItem = (index) => {
      items.set(
        items.get().map((item, i) => i === index ? { ...item, done: !item.done } : item),
      )
    }
    return ul(
      { id: 'list' },
      items.each((item, index) =>
        li(
          {
            class: { done: item.done },
            events: { click: () => toggleItem(index) },
          },
          item.text,
        )
      ),
    )
  },
})

const todoCount = component('todo-count', {
  loading: () => span({ id: 'count' }, '...'),
  setup: (self) => {
    const items = useState(self, 'todo.items')
    const remainingLabel = computed(
      [items],
      (current) => `${current.filter((item) => !item.done).length} left`,
    )
    return span({ id: 'count' }, remainingLabel.text())
  },
})

const boardCard = component('board-card', {
  setup: (self) => {
    const sort = useState(self, 'board.sort')
    return div(
      input({ id: 'card-input' }),
      span({ id: 'card-sort' }, sort.text()),
    )
  },
})

const boardColumn = component('board-column', {
  setup: (self, sortValue, slot) => {
    initState(self, 'board.sort', sortValue)
    return slot
  },
})

const todoBoard = component('todo-board', {
  setup: () => {
    const card = boardCard()
    const columnA = div({ id: 'column-a' }, card)
    const columnB = div({ id: 'column-b' })
    const moveCard = () => {
      const target = columnA.contains(card) ? columnB : columnA
      target.append(card)
    }
    return div(
      button({ id: 'move-card', events: { click: moveCard } }, 'move card'),
      boardColumn('alpha', columnA),
      boardColumn('beta', columnB),
    )
  },
})

const keyedNotes = component('keyed-notes', {
  setup: (self) => {
    const notes = initState(self, 'notes.items', [
      { id: 'one', title: 'first note', done: false },
      { id: 'two', title: 'second note', done: false },
    ])
    const toggleNote = (id) => {
      notes.set(
        notes.get().map((note) => note.id === id ? { ...note, done: !note.done } : note),
      )
    }
    return ul(
      { id: 'notes' },
      notes.each(
        (note) =>
          li(
            { id: `note-${note.id}`, class: { done: note.done } },
            span(note.title),
            input({ class: 'note-draft' }),
            button(
              { class: 'note-toggle', events: { click: () => toggleNote(note.id) } },
              'toggle',
            ),
          ),
        (note) => note.id,
      ),
    )
  },
})

const todoApp = component('todo-app', {
  setup: (self) => {
    const items = initState(self, 'todo.items', [])
    const draft = input({ id: 'draft', placeholder: 'what needs doing?' })
    const addItem = () => {
      const text = draft.value.trim()
      if (!text) return
      items.set([...items.get(), { text, done: false }])
      draft.value = ''
    }
    return div(
      h1('imp todo'),
      div(
        draft,
        button({ id: 'add', events: { click: addItem } }, 'add'),
      ),
      todoList(),
      todoCount(),
      button({ id: 'clear', events: { click: () => items.set([]) } }, 'clear'),
    )
  },
})

const stdShowcase = component('std-showcase', {
  setup: () =>
    div(
      { id: 'std' },
      heading({ level: 2 }, 'std components'),
      text({ tone: 'secondary' }, 'secondary copy'),
      stdButton(
        { variant: 'primary', events: { click: () => applyTheme('imp-dark') } },
        'go dark',
      ),
      link({ href: '/about' }, 'about'),
      div(
        { id: 'std-menu' },
        flex(
          { joined: true },
          stdButton('actions'),
          menuButton({
            items: [
              { id: 'copy', label: 'copy', onClick: ({ id }) => (globalThis.__impChose = id) },
              { id: 'rename', label: 'rename' },
              { id: 'archive', label: 'archive' },
            ],
          }),
        ),
      ),
    ),
})

const i18nShowcase = component('i18n-showcase', {
  setup: () =>
    div(
      { id: 'i18n' },
      span({ id: 'i18n-title' }, lang.text(() => t('demo.title'))),
      span({ id: 'i18n-notes' }, lang.text(() => t('demo.notes', { total: 3 }))),
      button({ id: 'to-polish', events: { click: () => setLang('pl') } }, 'polski'),
      button({ id: 'to-english', events: { click: () => setLang('en') } }, 'english'),
      emptyState({ description: 'nothing to show' }),
    ),
})

const submissions = []

const formShowcase = component('form-showcase', {
  setup: () =>
    div(
      { id: 'forms' },
      form(
        {
          initialValues: { user: { firstName: 'Ada' }, plan: 'pro', terms: false },
          onSubmit: (values) => {
            submissions.push(values)
            globalThis.__impSubmitted = JSON.stringify(values)
          },
        },
        textField({ field: 'user.firstName', label: 'First name', required: true }),
        select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
        checkbox({ field: 'terms', label: 'I accept the terms', required: true }),
        stdButton({ variant: 'primary', events: { click: submitForm } }, 'Save'),
      ),
      div(
        { id: 'failing-form' },
        form(
          {
            initialValues: { note: 'hello' },
            onSubmit: () => Promise.reject(new Error('The server did not answer')),
          },
          textField({ field: 'note', label: 'Note' }),
          stdButton({ variant: 'primary', events: { click: submitForm } }, 'Send'),
        ),
      ),
    ),
})

const layoutShowcase = component('layout-showcase', {
  setup: () =>
    div(
      { id: 'layouts' },
      div(
        { id: 'ltr-row', dir: 'ltr' },
        flex(span({ id: 'ltr-first' }, 'first'), span({ id: 'ltr-second' }, 'second')),
      ),
      div(
        { id: 'rtl-row', dir: 'rtl' },
        flex(span({ id: 'rtl-first' }, 'first'), span({ id: 'rtl-second' }, 'second')),
      ),
      div(
        { id: 'ltr-stack', dir: 'ltr' },
        stack({ horizontalAlign: 'start' }, span({ id: 'ltr-stacked' }, 'stacked')),
      ),
      div(
        { id: 'rtl-stack', dir: 'rtl' },
        stack({ horizontalAlign: 'start' }, span({ id: 'rtl-stacked' }, 'stacked')),
      ),
      div(
        { id: 'ltr-split', dir: 'ltr', style: 'inline-size: 400px; block-size: 120px' },
        splitPane({ label: 'Resize the demo' }, span('start'), span('end')),
      ),
      div(
        { id: 'rtl-split', dir: 'rtl', style: 'inline-size: 400px; block-size: 120px' },
        splitPane({ label: 'Resize the demo' }, span('start'), span('end')),
      ),
      div(
        { id: 'vertical-split', style: 'inline-size: 400px; block-size: 200px' },
        splitPane({ orientation: 'vertical' }, span('top'), span('bottom')),
      ),
    ),
})

const shellFrame = () => {
  const frame = shell(
    {
      logo: span({ id: 'shell-logo' }, 'Frame'),
      navbar: {
        label: 'Sections',
        selected: 'reports',
        items: [
          {
            id: 'reports',
            label: 'Reports',
            groups: [
              {
                label: 'Money',
                items: [
                  { id: 'one', label: 'One', href: '/one' },
                  {
                    id: 'two',
                    label: 'Two',
                    href: '/two',
                    children: [{ id: 'two-a', label: 'Two A', href: '/two/a' }],
                  },
                  { id: 'three', label: 'Three', href: '/three' },
                ],
              },
              {
                label: 'People',
                items: [
                  { id: 'four', label: 'Four', href: '/four' },
                  { id: 'five', label: 'Five', href: '/five' },
                  { id: 'six', label: 'Six', href: '/six' },
                ],
              },
            ],
          },
          { id: 'directory', label: 'Directory', href: '/directory' },
        ],
      },
      sidebar: {
        label: 'Filters',
        selected: 'one',
        extras: span({ id: 'shell-support' }, 'Support'),
        footer: [{ id: 'help', label: 'Help', href: '/help' }],
      },
      extras: span({ id: 'shell-tools' }, 'tools'),
    },
    span({ id: 'shell-page' }, 'page'),
  )
  frame.style.blockSize = '12rem'
  return frame
}

const shellShowcase = component('shell-showcase', {
  setup: () => div({ id: 'shell' }, shellFrame()),
})

const railFrame = () => {
  const frame = shell(
    {
      logo: span({ id: 'rail-logo' }, 'Frame'),
      sidebar: {
        label: 'Filters',
        selected: 'one',
        items: [
          { id: 'one', label: 'One', href: '/one', icon: span('1') },
          { id: 'two', label: 'Two', href: '/two', icon: span('2') },
        ],
      },
      extras: span({ id: 'rail-tools' }, 'tools'),
    },
    span('page'),
  )
  frame.style.blockSize = '12rem'
  return frame
}

const railShowcase = component('rail-showcase', {
  setup: () => div({ id: 'rail' }, railFrame()),
})

const dialogShowcase = component('dialog-showcase', {
  setup: (self) => {
    const modalOpen = initState(self, 'dialog.modal', false)
    const windowOpen = initState(self, 'dialog.window', false)
    const guardedOpen = initState(self, 'dialog.guarded', false)
    const refusals = initState(self, 'dialog.refusals', 0)
    const windowOpener = button(
      { id: 'open-window', events: { click: () => windowOpen.set(true) } },
      'window',
    )
    return div(
      { id: 'dialogs' },
      button({ id: 'open-modal', events: { click: () => modalOpen.set(true) } }, 'modal'),
      windowOpener,
      button({ id: 'open-guarded', events: { click: () => guardedOpen.set(true) } }, 'guarded'),
      span({ id: 'guarded-refusals' }, refusals.text(String)),
      div({ id: 'behind', style: 'block-size: 200vh' }, 'behind'),
      div(
        { id: 'guarded' },
        dialog(
          {
            title: 'Unsaved work',
            open: guardedOpen,
            beforeClose: () => {
              refusals.set(refusals.get() + 1)
              return false
            },
          },
          button({ id: 'guarded-done', events: { click: () => guardedOpen.set(false) } }, 'done'),
        ),
      ),
      div(
        { id: 'modal' },
        dialog(
          { title: 'Edit user', open: modalOpen },
          span('modal body'),
          input({ id: 'modal-field', placeholder: 'a field' }),
        ),
      ),
      div(
        { id: 'window' },
        dialog(
          { title: 'Inspector', modal: false, open: windowOpen, anchor: windowOpener },
          span('window body'),
        ),
      ),
    )
  },
})

const drawerShowcase = component('drawer-showcase', {
  setup: (self) => {
    const endOpen = initState(self, 'drawer.end', false)
    const panelOpen = initState(self, 'drawer.panel', false)
    const mirroredOpen = initState(self, 'drawer.mirrored', false)
    return div(
      { id: 'drawers' },
      button({ id: 'open-end', events: { click: () => endOpen.set(true) } }, 'end'),
      button({ id: 'open-panel', events: { click: () => panelOpen.set(true) } }, 'panel'),
      button({ id: 'open-mirrored', events: { click: () => mirroredOpen.set(true) } }, 'rtl'),
      div({ id: 'end' }, drawer({ title: 'Filters', open: endOpen }, span('end body'))),
      div(
        { id: 'panel' },
        drawer({ title: 'Inspector', modal: false, open: panelOpen }, span('panel body')),
      ),
      div(
        { id: 'mirrored', dir: 'rtl' },
        drawer({ title: 'Filters', open: mirroredOpen }, span('mirrored body')),
      ),
    )
  },
})

const bugShowcase = component('bug-showcase', {
  setup: (self) => {
    initState(self, 'bug.screen', { step: 'checkout', retries: 2 })
    return div(
      { id: 'bugs' },
      span({ id: 'faulty' }, 'the faulty bit'),
      input({ id: 'note', name: 'note', value: '' }),
      bugReport({
        onSubmit: (report) => {
          globalThis.__impBugReport = JSON.stringify(report)
        },
      }),
    )
  },
})

const codeShowcase = component('code-showcase', {
  setup: () =>
    div(
      { id: 'code', style: { maxWidth: '20rem' } },
      codeBlock({
        language: 'js',
        lineNumbers: true,
        id: 'demo',
        code: [
          '// a comment',
          "const greeting = 'hello'",
          'const long = greeting.repeat(40) + greeting.repeat(40) + greeting.repeat(40)',
          'export { greeting, long }',
        ].join('\n'),
      }),
    ),
})

const editorShowcase = component('editor-showcase', {
  setup: (self) => {
    const source = initState(self, 'demo.editorSource', 'const a = 1\n  const b = 2')
    return div(
      { id: 'editor', style: { maxWidth: '20rem' } },
      codeEditor({ value: source, label: 'Script', language: 'js', rows: 4 }),
      span({ id: 'editor-value' }, source.text()),
      input({ id: 'editor-after', placeholder: 'after the editor' }),
    )
  },
})

const numberedEditorShowcase = component('numbered-editor-showcase', {
  setup: () =>
    div(
      { id: 'numbered-editor', style: { maxWidth: '20rem' } },
      codeEditor({
        value: 'const first = 1\nconst second = first + first + first + first + first + first\n',
        label: 'Numbered',
        language: 'js',
        lineNumbers: true,
        rows: 3,
      }),
    ),
})

const richTextShowcase = component('rich-text-showcase', {
  setup: (self) => {
    const body = initState(self, 'demo.richText', 'Hello **world**')
    return div(
      { id: 'rich', style: { maxWidth: '32rem' } },
      richTextEditor({ value: body, label: 'Body', rows: 3, imageSize: 100 }),
      span({ id: 'rich-value' }, body.text()),
      input({ id: 'rich-after', placeholder: 'after the editor' }),
    )
  },
})

const imageUploadShowcase = component('image-upload-showcase', {
  setup: (self) => {
    const picture = initState(self, 'demo.picture', undefined)
    return div(
      { id: 'image', style: { maxWidth: '20rem' } },
      imageUpload({
        value: picture,
        label: 'Avatar',
        shape: 'circle',
        maxWidth: 100,
        maxHeight: 100,
      }),
      span({ id: 'image-value' }, picture.text()),
    )
  },
})

const sectionTabs = (label) =>
  tabs({
    label,
    items: [
      { id: 'one', label: 'One', content: input({ id: `${label}-inside`, placeholder: 'inside' }) },
      { id: 'two', label: 'Two', content: 'second panel' },
      { id: 'three', label: 'Three', disabled: true, content: 'third panel' },
      { id: 'four', label: 'Four', content: 'fourth panel' },
    ],
  })

const mapShowcase = component('map-showcase', {
  setup: () =>
    div(
      { id: 'maps' },
      div({ id: 'map-low' }, map({ label: 'World' })),
      div({ id: 'map-high' }, map({ label: 'Europe', detail: 'high', center: [50, 10], zoom: 3 })),
    ),
})

const accessibilityShowcase = component('accessibility-showcase', {
  setup: (self) => {
    const size = initState(self, 'a11y.size', 'medium')
    const alerts = initState(self, 'a11y.alerts', false)
    const country = initState(self, 'a11y.country', undefined)
    const volume = initState(self, 'a11y.volume', 40)
    const ink = initState(self, 'a11y.ink', '#3b6fe0')
    return div(
      { id: 'a11y' },
      div({ id: 'a11y-before' }, input({ id: 'a11y-start', placeholder: 'start here' })),
      div(
        { id: 'a11y-delete' },
        tooltip({ text: 'Delete' }, stdButton({ label: 'Delete', square: true }, icon(luTrash))),
      ),
      div({ id: 'a11y-loading' }, stdButton({ loading: true }, 'Saving')),
      div(
        { id: 'a11y-text-menu' },
        menuButton({ items: [{ id: 'copy', label: 'copy' }] }, 'Actions'),
      ),
      div(
        { id: 'a11y-chart' },
        chart({
          label: 'Revenue',
          labels: ['Q1', 'Q2'],
          series: [{ name: 'Product', values: [12, 18] }],
        }),
      ),
      div({ id: 'a11y-tabs' }, sectionTabs('Sections')),
      div({ id: 'a11y-tabs-rtl', dir: 'rtl' }, sectionTabs('Mirrored')),
      div(
        { id: 'a11y-radios' },
        radioGroup({ value: size, label: 'Size', options: ['small', 'medium', 'large'] }),
      ),
      div({ id: 'a11y-toggle' }, toggle({ value: alerts, label: 'Alerts' })),
      div(
        { id: 'a11y-combo' },
        comboBox({ value: country, label: 'Country', options: ['Peru', 'Poland', 'Portugal'] }),
      ),
      div({ id: 'a11y-slider' }, slider({ value: volume, label: 'Volume', step: 10 })),
      div({ id: 'a11y-color' }, colorPicker({ value: ink, label: 'Ink' })),
      div(
        { id: 'a11y-tree' },
        tree({
          label: 'Folders',
          items: [
            {
              id: 'src',
              label: 'src',
              children: [{ id: 'main', label: 'main.js' }, { id: 'util', label: 'util.js' }],
            },
            { id: 'readme', label: 'README.md' },
          ],
        }),
      ),
      div(
        { id: 'a11y-accordion' },
        accordion({
          items: [
            { id: 'shipping', title: 'Shipping', content: 'Ships in two days.' },
            { id: 'returns', title: 'Returns', content: 'Send it back within 30 days.' },
          ],
        }),
      ),
      div(
        { id: 'a11y-table' },
        table({
          label: 'Invoices',
          columns: [
            { key: 'number', label: 'Number', sortable: true },
            { key: 'total', label: 'Total', sortable: true },
          ],
          rows: [{ id: 1, number: 'B-2', total: 30 }, { id: 2, number: 'A-1', total: 10 }],
        }),
      ),
      div({ id: 'a11y-progress' }, progress({ label: 'Upload', value: 40 })),
      div(
        { id: 'a11y-notices' },
        notice({ kind: 'error', title: 'Could not save' }, 'The server did not answer.'),
        notice({ kind: 'success', title: 'Saved' }),
      ),
      div(
        { id: 'a11y-toast' },
        toast(),
        button(
          {
            id: 'a11y-notify',
            events: { click: () => notify({ kind: 'error', title: 'Disk is full', duration: 0 }) },
          },
          'notify',
        ),
      ),
    )
  },
})

const GEOMETRY_TASKS = [
  { id: 'design', label: 'Design', start: '2026-09-01', end: '2026-09-05' },
  { id: 'build', label: 'Build', start: '2026-09-10', end: '2026-09-20' },
]

const GEOMETRY_ITEMS = [
  { id: 'trip', title: 'Trip', start: '2026-09-22', end: '2026-09-24', color: 'teal' },
  { id: 'call', title: 'Call', start: '2026-09-21T09:00', end: '2026-09-21T10:00' },
]

const geometryPair = (name, direction) =>
  div(
    { id: `geometry-${direction}`, dir: direction, style: 'inline-size: 760px' },
    div(
      { class: 'geometry-chart' },
      chart({
        label: `Revenue ${name}`,
        labels: ['Q1', 'Q2', 'Q3'],
        series: [{ name: 'Product', values: [12, 18, 9] }],
      }),
    ),
    div({ class: 'geometry-gantt' }, gantt({ label: `Plan ${name}`, tasks: GEOMETRY_TASKS })),
    div(
      { class: 'geometry-calendar' },
      calendar({ label: `Calendar ${name}`, date: '2026-09-21', items: GEOMETRY_ITEMS }),
    ),
  )

const geometryShowcase = component('geometry-showcase', {
  setup: () => div({ id: 'geometry' }, geometryPair('ltr', 'ltr'), geometryPair('rtl', 'rtl')),
})

const COUNTRIES = [
  'Argentina',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'Chile',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Iceland',
  'Ireland',
  'Italy',
  'Japan',
  'Latvia',
]

const panelsShowcase = component('panels-showcase', {
  setup: (self) => {
    const day = initState(self, 'panels.day', '2026-09-21')
    const place = initState(self, 'panels.place', undefined)
    return div(
      { id: 'panels' },
      div({ id: 'panels-date' }, datePicker({ value: day, label: 'Due date' })),
      div({ id: 'panels-combo' }, comboBox({ value: place, label: 'Place', options: COUNTRIES })),
    )
  },
})

const leaveShowcase = component('leave-showcase', {
  setup: (self) => {
    const dirty = initState(self, 'leave.dirty', false)
    beforeLeave(self, () => !dirty.get())
    return div(
      { id: 'leave' },
      button({ id: 'leave-go', events: { click: () => navigate('/elsewhere') } }, 'go'),
      button({ id: 'leave-dirty', events: { click: () => dirty.set(!dirty.get()) } }, 'dirty'),
      span({ id: 'leave-route' }, useRoute().text((route) => route.path)),
    )
  },
})

mount(
  '#app',
  div(
    todoApp(),
    todoBoard(),
    keyedNotes(),
    stdShowcase(),
    formShowcase(),
    i18nShowcase(),
    layoutShowcase(),
    shellShowcase(),
    railShowcase(),
    dialogShowcase(),
    drawerShowcase(),
    bugShowcase(),
    codeShowcase(),
    editorShowcase(),
    numberedEditorShowcase(),
    richTextShowcase(),
    imageUploadShowcase(),
    accessibilityShowcase(),
    mapShowcase(),
    geometryShowcase(),
    panelsShowcase(),
    leaveShowcase(),
  ),
)
