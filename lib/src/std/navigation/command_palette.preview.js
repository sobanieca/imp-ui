import { commandPalette } from 'imp/std/navigation'

export const name = 'Command palette'
export const category = 'Navigation'
export const description =
  "Run 'imp skill std/commandPalette' to learn what commandPalette can do before using it."

const components = [
  { group: 'general', label: 'button' },
  { group: 'general', label: 'heading' },
  { group: 'general', label: 'link' },
  { group: 'general', label: 'text' },
  { group: 'layout', label: 'app' },
  { group: 'layout', label: 'sidebar' },
  { group: 'layout', label: 'flex' },
  { group: 'layout', label: 'grid' },
  { group: 'inputs', label: 'text_field' },
  { group: 'inputs', label: 'select' },
  { group: 'inputs', label: 'checkbox' },
  { group: 'navigation', label: 'tabs' },
  { group: 'navigation', label: 'nav_menu' },
]

const items = () =>
  components.map(({ group, label }) => ({
    id: `${group}/${label}`,
    group,
    label,
    description: `lib/src/std/${group}/${label}.js`,
  }))

export const withShortcut = commandPalette({
  label: 'Search components',
  placeholder: 'Search components…',
  shortcut: 'ctrl+p',
  items: items(),
})

export const withoutShortcut = commandPalette({
  label: 'Search components',
  placeholder: 'Type to filter…',
  items: items(),
})

export const shortList = commandPalette({
  label: 'Search components',
  limit: 3,
  items: items(),
})

export const withDisabledItem = commandPalette({
  label: 'Search commands',
  placeholder: 'Run a command…',
  items: [
    { id: 'save', label: 'Save', group: 'file' },
    { id: 'publish', label: 'Publish', group: 'file', disabled: true },
    { id: 'undo', label: 'Undo', group: 'edit' },
  ],
})

export const noItems = commandPalette({
  label: 'Search components',
  emptyMessage: 'Nothing is indexed yet',
  items: [],
})

export const reportingSelection = commandPalette({
  label: 'Search components',
  items: items(),
  events: { select: (event) => console.log('selected', event.detail.id) },
})
