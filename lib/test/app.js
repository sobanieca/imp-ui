import { appMap, component, init, mount } from 'imp'
import { button, div, h1, input, li, span, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { applyTheme } from 'imp/theme'
import { lang, setLang, t } from 'imp/i18n'
import { button as stdButton, heading, icon, link, menuButton, text } from 'imp/std'
import { luTrash } from 'imp/icons'
import {
  accordion,
  avatar,
  codeBlock,
  descriptionList,
  emptyState,
  markdown,
  qrCode,
  steps,
  tag,
  tooltip,
} from 'imp/std/display'
import {
  checkbox,
  codeEditor,
  colorPicker,
  comboBox,
  datePicker,
  dateRangePicker,
  emojiPicker,
  fileUpload,
  form,
  FormError,
  imageUpload,
  radioGroup,
  richTextEditor,
  segmented,
  select,
  slider,
  submitForm,
  textField,
  toggle,
  treeSelect,
} from 'imp/std/inputs'
import {
  bugReport,
  loader,
  notice,
  notify,
  progress,
  reactions,
  skeleton,
  toast,
} from 'imp/std/feedback'
import {
  appLogo,
  breadcrumbs,
  langSelect,
  notifications,
  orgSelect,
  shell,
  themeSelect,
  userCard,
} from 'imp/std/shell'
import { dialog, drawer, flex, splitPane, stack, tabs } from 'imp/std/layout'
import { beforeLeave, navigate, router, useRoute } from 'imp/router'
import { calendar, chart, gantt, list, map, table, timeline, tree } from 'imp/std/data'

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
      items.set(items.get().map((item, i) => (i === index ? { ...item, done: !item.done } : item)))
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
        ),
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
    return div(input({ id: 'card-input' }), span({ id: 'card-sort' }, sort.text()))
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
      notes.set(notes.get().map((note) => (note.id === id ? { ...note, done: !note.done } : note)))
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
      div(draft, button({ id: 'add', events: { click: addItem } }, 'add')),
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
      stdButton({ variant: 'primary', events: { click: () => applyTheme('imp-dark') } }, 'go dark'),
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
      span(
        { id: 'i18n-title' },
        lang.text(() => t('demo.title')),
      ),
      span(
        { id: 'i18n-notes' },
        lang.text(() => t('demo.notes', { total: 3 })),
      ),
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
            onSubmit: () => Promise.reject(new FormError('The server did not answer')),
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

const shellMap = appMap({
  reports: {
    money: { one: {}, two: { twoA: {} }, three: {} },
    people: { four: {}, five: {}, six: {} },
  },
  directory: {},
})

const shellFrame = () => {
  const frame = shell(
    {
      map: shellMap,
      nav: {
        [shellMap.reports.money]: { group: true },
        [shellMap.reports.people]: { group: true },
      },
      logo: span({ id: 'shell-logo' }, 'Frame'),
      navbar: { label: 'Sections' },
      sidebar: { label: 'Filters', extras: span({ id: 'shell-support' }, 'Support') },
      extras: span({ id: 'shell-tools' }, 'tools'),
    },
    span({ id: 'shell-page' }, 'page'),
    router({ map: shellMap, screens: {} }),
  )
  frame.style.blockSize = '12rem'
  return frame
}

const shellShowcase = component('shell-showcase', {
  setup: () => div({ id: 'shell' }, shellFrame()),
})

const railMap = appMap({ one: {}, two: {} })

const railFrame = () => {
  const frame = shell(
    {
      map: railMap,
      nav: { [railMap.one]: { icon: span('1') }, [railMap.two]: { icon: span('2') } },
      navbar: false,
      logo: span({ id: 'rail-logo' }, 'Frame'),
      sidebar: { label: 'Filters' },
      extras: span({ id: 'rail-tools' }, 'tools'),
    },
    span('page'),
    router({ map: railMap, screens: {} }),
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

const QR_LINK = 'https://imp.example.com'

const qrShowcase = component('qr-showcase', {
  setup: (self) => {
    const value = initState(self, 'demo.qrValue', QR_LINK)
    return div(
      { id: 'qr' },
      qrCode({ value, label: 'Link to the demo' }),
      button({ id: 'qr-empty', events: { click: () => value.set('') } }, 'empty'),
      button({ id: 'qr-long', events: { click: () => value.set('x'.repeat(3000)) } }, 'long'),
      button({ id: 'qr-link', events: { click: () => value.set(QR_LINK) } }, 'link'),
    )
  },
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
        { id: 'control-heights' },
        flex(
          { wrap: true, verticalAlign: 'bottom' },
          stdButton('Save'),
          stdButton({ square: true, label: 'Delete' }, icon(luTrash)),
          segmented({ value: size, label: 'Size', options: ['small', 'medium', 'large'] }),
          textField({ value: country, label: 'Country name' }),
          select({ value: country, label: 'Country', options: ['Peru', 'Poland'] }),
          comboBox({ value: country, label: 'Country search', options: ['Peru', 'Poland'] }),
          datePicker({ value: country, label: 'Date' }),
          emojiPicker({ value: country, label: 'Emoji' }),
          colorPicker({ value: ink, label: 'Colour' }),
        ),
      ),
      div(
        { id: 'a11y-tree' },
        tree({
          label: 'Folders',
          items: [
            {
              id: 'src',
              label: 'src',
              children: [
                { id: 'main', label: 'main.js' },
                { id: 'util', label: 'util.js' },
              ],
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
          rows: [
            { id: 1, number: 'B-2', total: 30 },
            { id: 2, number: 'A-1', total: 10 },
          ],
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
    div(
      { class: 'geometry-timeline' },
      timeline({
        label: `History ${name}`,
        items: [
          { id: 'placed', time: '2026-09-21', title: 'Placed', description: 'Three items' },
          { id: 'shipped', time: '2026-09-23', title: 'Shipped', color: 'green' },
        ],
      }),
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
      span(
        { id: 'leave-route' },
        useRoute().text((route) => route.path),
      ),
    )
  },
})

globalThis.__impNavigate = navigate

const tallMap = appMap({ tallA: {}, tallB: {} })

const tallScreen = (id, next) => {
  const screen = div(
    { id },
    button({ id: `${id}-next`, events: { click: () => navigate(next) } }, 'next'),
  )
  screen.style.minBlockSize = '3000px'
  return screen
}

const tallFrame = (effect) => {
  const frame = shell(
    { map: tallMap, effect },
    router({
      map: tallMap,
      screens: {
        [tallMap.tallA]: () => tallScreen('tall-a', '/tall-b'),
        [tallMap.tallB]: () => tallScreen('tall-b', '/tall-a'),
      },
    }),
  )
  frame.style.blockSize = '12rem'
  return frame
}

const scrollShowcase = component('scroll-showcase', {
  setup: (self) => {
    const effect = initState(self, 'scroll.effect', 'none')
    return div(
      { id: 'scroll' },
      button({ id: 'scroll-start', events: { click: () => navigate('/tall-a') } }, 'start'),
      button({ id: 'scroll-slide', events: { click: () => effect.set('slide') } }, 'slide'),
      effect.view((value) => tallFrame(value)),
    )
  },
})

const shadowCard = component('a11y-shadow-card', {
  setup: () => div({ class: 'card', tabindex: '0' }, 'Open'),
})

const catalogShowcase = component('catalog-showcase', {
  setup: (self) => {
    const people = initState(self, 'catalog.people', [
      {
        id: 1,
        title: 'Ada Lovelace',
        description: 'Engineer',
        name: 'Ada Lovelace',
        tag: { text: 'Admin', color: 'blue' },
      },
      { id: 2, title: 'Grace Hopper', description: 'Admiral', name: 'Grace Hopper' },
    ])
    const org = initState(self, 'catalog.org', 'acme')
    const files = initState(self, 'catalog.files', [])
    const reactionItems = initState(self, 'catalog.reactions', [
      { emoji: '\u{1F44D}', count: 2, reacted: false },
    ])
    const remember = (name) => (event) => {
      globalThis.__impCatalog = { ...(globalThis.__impCatalog ?? {}), [name]: event.detail }
    }
    return div(
      { id: 'catalog' },
      div(
        { id: 'catalog-list' },
        list({ label: 'People', items: people, events: { select: remember('list') } }),
      ),
      div(
        { id: 'catalog-select' },
        select({ label: 'Flavour', value: 'vanilla', options: ['vanilla', 'chocolate'] }),
      ),
      div(
        { id: 'catalog-upload' },
        fileUpload({ label: 'Attachments', value: files, multiple: true }),
      ),
      div({ id: 'catalog-avatar' }, avatar({ name: 'Ada Lovelace' })),
      div(
        { id: 'catalog-description' },
        descriptionList({
          items: [
            { term: 'Name', details: 'Ada' },
            { term: 'Role', details: 'Engineer' },
          ],
        }),
      ),
      div({ id: 'catalog-markdown' }, markdown({ text: '# Title\n\nA **bold** word.' })),
      div(
        { id: 'catalog-steps' },
        steps({
          label: 'Checkout',
          current: 'pay',
          items: [
            { id: 'cart', label: 'Cart' },
            { id: 'pay', label: 'Payment' },
            {
              id: 'done',
              label: 'Done',
            },
          ],
          events: { select: remember('steps') },
        }),
      ),
      div(
        { id: 'catalog-tag' },
        tag({ color: 'green' }, 'Active'),
        tag({ dot: true, color: 'red', label: 'Offline' }),
      ),
      div({ id: 'catalog-loader' }, loader({ label: 'Loading people' })),
      div(
        { id: 'catalog-reactions' },
        reactions({
          items: reactionItems,
          onReact: (emoji, reacted) => {
            globalThis.__impCatalog = {
              ...(globalThis.__impCatalog ?? {}),
              reacted: { emoji, reacted },
            }
          },
        }),
      ),
      div({ id: 'catalog-skeleton' }, skeleton({ lines: 3 })),
      div(
        { id: 'catalog-segmented' },
        segmented({ label: 'View', value: 'day', options: ['day', 'week', 'month'] }),
      ),
      div({ id: 'catalog-logo' }, appLogo({ label: 'Acme', tagline: 'Tools' })),
      div(
        { id: 'catalog-crumbs' },
        breadcrumbs({
          items: [
            { label: 'Home', href: '/' },
            { label: 'People', href: '/people' },
            {
              label: 'Ada',
            },
          ],
        }),
      ),
      div({ id: 'catalog-lang' }, langSelect({ languages: ['en', 'pl'], remember: false })),
      div({ id: 'catalog-theme' }, themeSelect({ remember: false })),
      div(
        { id: 'catalog-org' },
        orgSelect({
          orgs: [
            { id: 'acme', name: 'Acme' },
            { id: 'globex', name: 'Globex' },
          ],
          selected: org,
          events: { select: remember('org') },
        }),
      ),
      div(
        { id: 'catalog-user' },
        userCard({ name: 'Ada Lovelace', description: 'ada@example.com' }),
      ),
      div({ id: 'catalog-bell' }, notifications()),
      div({ id: 'catalog-emoji' }, emojiPicker({ label: 'Icon' })),
      button(
        {
          id: 'catalog-notify',
          events: { click: () => notify({ title: 'Deploy finished', description: 'v2 is live' }) },
        },
        'Notify',
      ),
    )
  },
})

const LONG = 'Quarterly revenue of the northern region'
const LONG_URL = 'https://example.com/reports/2026/quarterly-revenue-of-the-northern-region'

const narrowCase = (name, ...children) =>
  div(
    { class: 'narrow-case', 'data-name': name, style: 'display: flex; flex-wrap: wrap' },
    ...children,
  )

const narrowShowcase = component('narrow-showcase', {
  setup: () =>
    div(
      { id: 'narrow', style: 'inline-size: 320px' },
      narrowCase(
        'segmented',
        segmented({
          label: 'Period',
          value: '30d',
          options: ['30 days', '3 months', '6 months', '1 year', '5 years'],
        }),
      ),
      narrowCase(
        'tabs',
        tabs({
          label: 'Reports',
          items: ['Overview', 'Revenue', 'Customers', 'Retention', 'Settings'].map((label) => ({
            id: label,
            label,
            content: label,
          })),
        }),
      ),
      narrowCase(
        'breadcrumbs',
        breadcrumbs({
          items: [
            { label: 'Home', href: '/' },
            { label: 'Organisations', href: '/o' },
            { label: 'Northern region', href: '/o/n' },
            { label: LONG },
          ],
        }),
      ),
      narrowCase(
        'steps',
        steps({
          label: 'Checkout',
          current: 'pay',
          items: ['Cart', 'Shipping address', 'Payment', 'Review', 'Done'].map((label) => ({
            id: label === 'Payment' ? 'pay' : label,
            label,
          })),
        }),
      ),
      narrowCase(
        'radio-group',
        radioGroup({ label: LONG, value: 'a', options: [LONG, 'Second option', 'Third'] }),
      ),
      narrowCase('tag', tag({ color: 'green' }, LONG), tag({}, LONG_URL)),
      narrowCase('button', stdButton(LONG + ' and the southern region')),
      narrowCase('menu-button', menuButton({ items: [{ id: 'a', label: LONG }] }, LONG)),
      narrowCase('select', select({ label: LONG, value: LONG, options: [LONG, 'Short'] })),
      narrowCase(
        'combo-box',
        comboBox({ label: LONG, value: [LONG], multiple: true, options: [LONG] }),
      ),
      narrowCase('text-field', textField({ label: LONG_URL, value: LONG_URL })),
      narrowCase('date-picker', datePicker({ label: LONG, value: '2026-09-30T14:30', time: true })),
      narrowCase(
        'tree-select',
        treeSelect({
          label: LONG,
          value: [LONG_URL, 'b'],
          items: [{ value: LONG_URL, label: LONG_URL, children: [{ value: 'b', label: LONG }] }],
        }),
      ),
      narrowCase(
        'date-range-picker',
        dateRangePicker({
          label: LONG,
          value: { preset: 'long' },
          presets: [
            {
              value: 'long',
              label: LONG,
              range: { start: '2026-01-01', end: '2026-09-30' },
            },
          ],
        }),
      ),
      narrowCase('slider', slider({ label: LONG, value: 40 })),
      narrowCase('checkbox', checkbox({ label: LONG_URL })),
      narrowCase('toggle', toggle({ label: LONG_URL })),
      narrowCase('color-picker', colorPicker({ label: LONG, value: '#336699' })),
      narrowCase('file-upload', fileUpload({ label: LONG, multiple: true })),
      narrowCase('progress', progress({ label: LONG_URL, value: 40 })),
      narrowCase('notice', notice({ kind: 'error', title: LONG }, LONG_URL)),
      narrowCase(
        'accordion',
        accordion({ items: [{ id: 'a', title: LONG_URL, content: LONG_URL }] }),
      ),
      narrowCase(
        'description-list',
        descriptionList({ items: [{ term: LONG, details: LONG_URL }] }),
      ),
      narrowCase(
        'markdown',
        markdown({
          text: `# ${LONG}\n\nSee ${LONG_URL} and \`${LONG_URL}\`.\n\n| A | B | C | D |\n|---|---|---|---|\n| ${LONG} | ${LONG} | ${LONG} | ${LONG} |`,
        }),
      ),
      narrowCase('code-block', codeBlock({ code: `const url = '${LONG_URL}'`, language: 'js' })),
      narrowCase('empty-state', emptyState({ title: LONG, description: LONG_URL })),
      narrowCase(
        'table',
        table({
          label: LONG,
          columns: ['one', 'two', 'three', 'four', 'five'].map((key) => ({ key, label: LONG })),
          rows: [{ id: 1, one: LONG, two: LONG, three: LONG, four: LONG, five: LONG }],
        }),
      ),
      narrowCase(
        'list',
        list({ label: LONG, items: [{ id: 1, title: LONG_URL, description: LONG_URL }] }),
      ),
      narrowCase(
        'tree',
        tree({
          label: LONG,
          items: [{ id: 'a', label: LONG_URL, children: [{ id: 'b', label: LONG_URL }] }],
        }),
      ),
      narrowCase(
        'timeline',
        timeline({
          label: LONG,
          items: [{ id: 'a', time: '2026-09-21', title: LONG_URL, description: LONG_URL }],
        }),
      ),
      narrowCase(
        'chart',
        chart({
          label: LONG,
          labels: [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ],
          series: ['North', 'South', 'East', 'West', 'Central', 'Overseas'].map((name, index) => ({
            name: `${name} ${LONG}`,
            values: Array.from({ length: 12 }, (_, month) => 1000000 * (index + month)),
          })),
        }),
      ),
      narrowCase(
        'chart-days',
        chart({
          label: LONG,
          labels: Array.from({ length: 30 }, (_, day) => `09-${String(day + 1).padStart(2, '0')}`),
          series: [{ name: 'Visits', values: Array.from({ length: 30 }, (_, day) => 400 + day) }],
        }),
      ),
      narrowCase('calendar', calendar({ label: LONG, date: '2026-09-21', items: GEOMETRY_ITEMS })),
      narrowCase('gantt', gantt({ label: LONG, tasks: GEOMETRY_TASKS })),
      narrowCase(
        'reactions',
        reactions({
          items: [
            '\u{1F44D}',
            '\u{1F389}',
            '\u{2764}',
            '\u{1F680}',
            '\u{1F440}',
            '\u{1F525}',
            '\u{1F44F}',
          ].map((emoji) => ({ emoji, count: 1234567, reacted: false })),
        }),
      ),
      narrowCase('user-card', userCard({ name: LONG, description: LONG_URL })),
      narrowCase('app-logo', appLogo({ label: LONG, tagline: LONG })),
      narrowCase('avatar', avatar({ name: LONG })),
    ),
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
    qrShowcase(),
    geometryShowcase(),
    panelsShowcase(),
    leaveShowcase(),
    scrollShowcase(),
    shadowCard(),
    catalogShowcase(),
    narrowShowcase(),
  ),
)
