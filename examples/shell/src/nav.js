import { icon } from 'imp/std'

const sections = [
  { id: 'all', group: 'lists', label: 'All tasks', short: 'All', href: '/', glyph: 'grid' },
  {
    id: 'active',
    group: 'lists',
    label: 'Active',
    href: '/active',
    glyph: 'clock',
    color: 'blue',
  },
  { id: 'done', group: 'lists', label: 'Done', href: '/done', glyph: 'check', color: 'green' },
  { id: 'settings', group: 'app', label: 'Settings', href: '/settings', glyph: 'settings' },
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
    icon: icon({ name: section.glyph }),
    tag: counts[section.id] && { text: counts[section.id], color: section.color },
  }))

export const sectionFor = (path) => sections.find((section) => section.href === path)?.id ?? null
