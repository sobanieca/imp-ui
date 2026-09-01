import { icon } from 'imp/std'
import { luCheck, luClock, luLayoutGrid, luSettings } from 'imp/icons'

const sections = [
  { id: 'all', group: 'lists', label: 'All tasks', short: 'All', href: '/', icon: luLayoutGrid },
  {
    id: 'active',
    group: 'lists',
    label: 'Active',
    href: '/active',
    icon: luClock,
    color: 'blue',
  },
  { id: 'done', group: 'lists', label: 'Done', href: '/done', icon: luCheck, color: 'green' },
  { id: 'settings', group: 'app', label: 'Settings', href: '/settings', icon: luSettings },
]

export const navGroups = [
  { id: 'lists', label: 'Lists' },
  { id: 'app', label: 'App' },
]

export const navItems = (counts, { grouped, short }) =>
  sections.map((section) => ({
    id: section.id,
    label: short ? section.short ?? section.label : section.label,
    href: section.href,
    group: grouped ? section.group : undefined,
    icon: icon(section.icon),
    tag: counts[section.id] && { text: counts[section.id], color: section.color },
  }))

export const sectionFor = (path) => sections.find((section) => section.href === path)?.id ?? null
