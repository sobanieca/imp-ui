import { icon } from 'imp/std'
import { luCheck, luClock, luLayoutGrid, luSettings } from 'imp/icons'

const filters = [
  { id: 'all', label: 'All tasks', href: '/', glyph: luLayoutGrid },
  { id: 'active', label: 'Active', href: '/active', glyph: luClock, color: 'blue' },
  { id: 'done', label: 'Done', href: '/done', glyph: luCheck, color: 'green' },
]

export const sections = (counts) => [
  {
    id: 'tasks',
    label: 'Tasks',
    href: '/',
    icon: icon(luCheck),
    groups: [{
      label: 'Filters',
      items: filters.map((filter) => ({
        id: filter.id,
        label: filter.label,
        href: filter.href,
        icon: icon(filter.glyph),
        tag: counts[filter.id] && { text: counts[filter.id], color: filter.color },
      })),
    }],
  },
  { id: 'settings', label: 'Settings', href: '/settings', icon: icon(luSettings) },
]

export const sectionFor = (path) => (path === '/settings' ? 'settings' : 'tasks')

export const filterFor = (path) => filters.find((filter) => filter.href === path)?.id ?? null
