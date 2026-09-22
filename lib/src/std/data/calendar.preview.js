import { component } from 'imp'
import { initState } from 'imp/state'
import { calendar } from 'imp/std/data'
import { text } from 'imp/std'
import { stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Calendar'
export const group = groups.data

const pad = (value) => String(value).padStart(2, '0')

const isoDay = (offset) => {
  const day = new Date()
  day.setDate(day.getDate() + offset)
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

const at = (offset, time) => `${isoDay(offset)}T${time}`

const busyMonth = () => [
  { id: 1, title: 'Standup', start: at(0, '09:00'), end: at(0, '09:15'), color: 'blue' },
  { id: 2, title: 'Design review', start: at(0, '09:00'), end: at(0, '10:30'), color: 'purple' },
  { id: 3, title: 'Lunch with Ada', start: at(0, '12:30'), end: at(0, '13:30'), color: 'green' },
  { id: 4, title: 'Release 4.2', start: at(0, '15:00'), end: at(0, '16:00'), color: 'red' },
  { id: 5, title: 'Team offsite', start: isoDay(2), end: isoDay(4), color: 'teal' },
  { id: 6, title: 'Standup', start: at(1, '09:00'), end: at(1, '09:15'), color: 'blue' },
  { id: 7, title: 'Customer call', start: at(1, '11:00'), end: at(1, '12:00'), color: 'orange' },
  { id: 8, title: 'Planning', start: at(1, '11:30'), end: at(1, '13:00'), color: 'indigo' },
  { id: 9, title: 'Dentist', start: at(-3, '08:00'), end: at(-3, '09:00'), color: 'pink' },
  { id: 10, title: 'Quarter report due', start: isoDay(-5), color: 'amber' },
  { id: 11, title: 'Board meeting', start: at(7, '14:00'), end: at(7, '17:00'), color: 'red' },
  { id: 12, title: 'Hiring sync', start: at(7, '10:00'), end: at(7, '10:45') },
  { id: 13, title: 'Night deploy', start: at(8, '22:30'), end: at(9, '01:30'), color: 'gray' },
  { id: 14, title: 'Holiday', start: isoDay(12), end: isoDay(16), color: 'lime' },
  { id: 15, title: 'Retro', start: at(-7, '15:00'), end: at(-7, '16:00'), color: 'violet' },
  { id: 16, title: 'Conference', start: isoDay(-10), end: isoDay(-9), color: 'sky' },
]

export const month = {
  scenario: 'Month',
  component: () => calendar({ label: 'Team calendar', items: busyMonth() }),
}

export const week = {
  scenario: 'Week',
  component: () => calendar({ label: 'Team calendar', items: busyMonth(), view: 'week' }),
}

export const day = {
  scenario: 'Day',
  component: () => calendar({ label: 'Team calendar', items: busyMonth(), view: 'day' }),
}

const planner = component('preview-calendar-planner', {
  setup: (self) => {
    const items = initState(self, 'preview.calendar.items', busyMonth().slice(0, 5))
    const view = initState(self, 'preview.calendar.view', 'week')
    const date = initState(self, 'preview.calendar.date', isoDay(0))
    const last = initState(self, 'preview.calendar.last', 'Press an empty slot to add an event.')
    return stack(
      { gap: 3 },
      text({ tone: 'secondary' }, last.text()),
      calendar({
        label: 'Planner',
        items,
        view,
        date,
        events: {
          select: (event) => last.set(`Selected the event ${event.detail.id}.`),
          slotSelect: ({ detail }) => {
            items.set((current) => [
              ...current,
              { id: Date.now(), title: 'New event', color: 'green', ...detail },
            ])
            last.set(`Added an event at ${detail.start}.`)
          },
        },
      }),
    )
  },
})

export const stateDriven = {
  scenario: 'State-driven, a slot adds an event',
  component: () => planner(),
}
