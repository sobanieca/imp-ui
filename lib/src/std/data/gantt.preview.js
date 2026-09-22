import { component } from 'imp'
import { initState } from 'imp/state'
import { text } from 'imp/std'
import { gantt } from 'imp/std/data'
import { stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Gantt'
export const group = groups.data

const sprintTasks = () => [
  { id: 'brief', label: 'Write the brief', start: '2026-09-14', end: '2026-09-16', progress: 100 },
  { id: 'wireframes', label: 'Wireframes', start: '2026-09-16', end: '2026-09-22', progress: 80 },
  { id: 'review', label: 'Design review', start: '2026-09-23', end: '2026-09-23' },
  { id: 'build', label: 'Build the screens', start: '2026-09-22', end: '2026-10-02', progress: 25 },
  { id: 'qa', label: 'Test on devices', start: '2026-09-30', end: '2026-10-06', progress: 0 },
]

const releaseTasks = () => [
  {
    id: 'research',
    label: 'Customer research',
    start: '2026-08-17',
    end: '2026-09-04',
    progress: 100,
    color: 'violet',
    group: 'Design',
  },
  {
    id: 'design',
    label: 'Interface design',
    start: '2026-09-01',
    end: '2026-09-25',
    progress: 70,
    color: 'violet',
    group: 'Design',
  },
  {
    id: 'api',
    label: 'Public API',
    start: '2026-09-07',
    end: '2026-10-16',
    progress: 45,
    color: 'blue',
    group: 'Engineering',
  },
  {
    id: 'apps',
    label: 'Web and mobile apps',
    start: '2026-09-21',
    end: '2026-11-06',
    progress: 10,
    color: 'blue',
    group: 'Engineering',
  },
  {
    id: 'freeze',
    label: 'Code freeze',
    start: '2026-11-09',
    end: '2026-11-09',
    color: 'blue',
    group: 'Engineering',
  },
  {
    id: 'campaign',
    label: 'Launch campaign',
    start: '2026-10-19',
    end: '2026-11-20',
    progress: 0,
    color: 'orange',
    group: 'Marketing',
  },
  {
    id: 'launch',
    label: 'Launch',
    start: '2026-11-23',
    end: '2026-11-23',
    color: 'orange',
    group: 'Marketing',
  },
]

const roadmapTasks = () => [
  { id: 'billing', label: 'New billing', start: '2026-03-02', end: '2026-07-31', progress: 100 },
  { id: 'search', label: 'Search', start: '2026-06-15', end: '2026-11-13', progress: 55 },
  { id: 'audit', label: 'Security audit', start: '2026-10-01', end: '2026-10-01', color: 'red' },
  { id: 'offline', label: 'Offline mode', start: '2026-09-01', end: '2027-02-26', progress: 8 },
  { id: 'v2', label: 'Version 2', start: '2027-03-15', end: '2027-03-15', color: 'green' },
]

export const byDay = {
  scenario: 'By day',
  component: gantt({ label: 'Sprint plan', tasks: sprintTasks() }),
}

export const byWeek = {
  scenario: 'By week, with groups and milestones',
  component: gantt({ label: 'Release plan', scale: 'week', tasks: releaseTasks() }),
}

export const byMonth = {
  scenario: 'By month',
  component: gantt({ label: 'Product roadmap', scale: 'month', tasks: roadmapTasks() }),
}

export const selectable = {
  scenario: 'Selectable tasks',
  component: component('gantt-select-demo', {
    setup: (self) => {
      const selected = initState(self, 'gantt.selected', 'nothing yet')
      return stack(
        { gap: 3 },
        gantt({
          label: 'Sprint plan',
          tasks: sprintTasks(),
          events: { select: (event) => selected.set(event.detail.id) },
        }),
        text({ tone: 'secondary' }, 'Selected: ', selected.text()),
      )
    },
  })(),
}

export const limitedHeight = {
  scenario: 'Limited height',
  component: () => {
    const host = gantt({ label: 'Release plan', scale: 'week', tasks: releaseTasks() })
    host.style.setProperty('--imp-gantt-max-block-size', '14rem')
    return host
  },
}
