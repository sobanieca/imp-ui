import { icon } from 'imp/std'

const filters = [
  { id: 'all', label: 'All tasks', href: '/', glyph: 'grid' },
  { id: 'active', label: 'Active', href: '/active', glyph: 'clock', color: 'blue' },
  { id: 'done', label: 'Done', href: '/done', glyph: 'check', color: 'green' },
]

export const sections = (counts) => [
  {
    id: 'tasks',
    label: 'Tasks',
    href: '/',
    icon: icon({ name: 'check' }),
    groups: [{
      label: 'Filters',
      items: filters.map((filter) => ({
        id: filter.id,
        label: filter.label,
        href: filter.href,
        icon: icon({ name: filter.glyph }),
        tag: counts[filter.id] && { text: counts[filter.id], color: filter.color },
      })),
    }],
  },
  { id: 'settings', label: 'Settings', href: '/settings', icon: icon({ name: 'settings' }) },
]

export const sectionFor = (path) => (path === '/settings' ? 'settings' : 'tasks')

export const filterFor = (path) => filters.find((filter) => filter.href === path)?.id ?? null
