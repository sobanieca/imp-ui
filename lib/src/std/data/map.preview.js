import { component } from 'imp'
import { div } from 'imp/html'
import { luPlane } from 'imp/icons'
import { button, icon, text } from 'imp/std'
import { map } from 'imp/std/data'
import { stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Map'
export const group = groups.data

const OFFICES = [
  { id: 'warsaw', lat: 52.23, lng: 21.01, label: 'Warsaw office' },
  { id: 'lisbon', lat: 38.72, lng: -9.14, label: 'Lisbon office' },
  { id: 'austin', lat: 30.27, lng: -97.74, label: 'Austin office' },
  { id: 'singapore', lat: 1.35, lng: 103.82, label: 'Singapore office' },
  { id: 'sydney', lat: -33.87, lng: 151.21, label: 'Sydney office' },
]

export const world = {
  scenario: 'The world, with markers',
  component: map({
    label: 'Offices',
    pins: OFFICES,
    events: { select: (event) => console.log('selected', event.detail.id) },
  }),
}

export const centered = {
  scenario: 'A start view over Europe',
  component: map({
    label: 'Europe',
    center: [50, 12],
    zoom: 2.5,
    pins: OFFICES,
  }),
}

export const detailed = {
  scenario: 'High detail: the 1:50m world with major and secondary highways',
  component: map({
    label: 'Europe in detail',
    detail: 'high',
    center: [50, 10],
    zoom: 3,
    pins: OFFICES,
  }),
}

export const medium = {
  scenario: 'Medium detail: the 1:50m world with 1251 cities',
  component: map({
    label: 'The world in medium detail',
    detail: 'medium',
    center: [20, 0],
    zoom: 1,
  }),
}

const airport = (label) =>
  button(
    { variant: 'primary', size: 'sm', events: { click: () => console.log(label) } },
    icon(luPlane),
    label,
  )

export const components = {
  scenario: 'Any component as a pin',
  component: map({
    label: 'Airports',
    center: [45, 0],
    zoom: 1.5,
    pins: [
      { id: 'lhr', lat: 51.47, lng: -0.46, content: airport('LHR'), anchor: 'bottom' },
      { id: 'cdg', lat: 49.01, lng: 2.55, content: airport('CDG'), anchor: 'bottom' },
      { id: 'ist', lat: 41.28, lng: 28.75, content: airport('IST'), anchor: 'bottom' },
    ],
  }),
}

const bound = component('imp-preview-map-bound', {
  setup: (self) => {
    const center = initState(self, 'preview.map.center', [40, -3])
    const zoom = initState(self, 'preview.map.zoom', 2)
    const readout = () =>
      text(
        { tone: 'secondary' },
        center.text(([lat, lng]) => `Center ${lat}, ${lng}`),
        zoom.text((value) => ` at zoom ${value}`),
      )
    return stack(
      { gap: 2 },
      div(readout()),
      map({ label: 'Bound view', center, zoom, pins: OFFICES }),
      button({ events: { click: () => center.set([52.23, 21.01]) } }, 'Go to Warsaw'),
    )
  },
})

export const live = {
  scenario: 'The view bound to a state',
  component: bound(),
}
