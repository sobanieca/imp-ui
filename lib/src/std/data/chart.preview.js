import { component } from 'imp'
import { initState } from 'imp/state'
import { button } from 'imp/std'
import { chart } from 'imp/std/data'
import { stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Chart'
export const group = groups.data

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const thousands = (value) => `${value}k`

export const singleSeries = {
  scenario: 'Column, one series',
  component: chart({
    label: 'New customers per quarter',
    labels: QUARTERS,
    series: [{ name: 'New customers', values: [184, 231, 207, 296] }],
  }),
}

export const grouped = {
  scenario: 'Column, grouped',
  component: chart({
    label: 'Revenue per quarter, by line of business',
    labels: QUARTERS,
    format: thousands,
    series: [
      { name: 'Product', values: [120, 180, 95, 220] },
      { name: 'Services', values: [50, 70, 110, 80] },
      { name: 'Support', values: [32, 38, 41, 47] },
    ],
  }),
}

export const stackedColumns = {
  scenario: 'Column, stacked',
  component: chart({
    label: 'Revenue per quarter, stacked by line of business',
    labels: QUARTERS,
    stacked: true,
    format: thousands,
    series: [
      { name: 'Product', values: [120, 180, 95, 220] },
      { name: 'Services', values: [50, 70, 110, 80] },
      { name: 'Support', values: [32, 38, 41, 47] },
    ],
  }),
}

export const horizontalBars = {
  scenario: 'Bar',
  component: chart({
    type: 'bar',
    label: 'Open tickets per team',
    labels: ['Platform', 'Billing', 'Mobile apps', 'Data pipeline', 'Customer success'],
    series: [{ name: 'Open tickets', values: [42, 17, 28, 9, 33], color: 'teal' }],
  }),
}

export const stackedBars = {
  scenario: 'Bar, stacked',
  component: chart({
    type: 'bar',
    stacked: true,
    label: 'Tickets per team, by state',
    labels: ['Platform', 'Billing', 'Mobile apps', 'Data pipeline'],
    series: [
      { name: 'Open', values: [42, 17, 28, 9] },
      { name: 'In review', values: [12, 6, 14, 3] },
      { name: 'Closed', values: [88, 64, 51, 40] },
    ],
  }),
}

export const lines = {
  scenario: 'Line, three series',
  component: chart({
    type: 'line',
    label: 'Response time per month, in milliseconds',
    labels: MONTHS,
    format: (value) => `${value} ms`,
    series: [
      { name: 'p50', values: [118, 121, 117, 124, 130, 127, 122, 119, 125, 131, 128, 123] },
      { name: 'p95', values: [240, 251, 236, 262, 284, 270, 259, 248, 266, 291, 277, 263] },
      { name: 'p99', values: [410, 432, 398, 455, 497, 471, 440, 422, 463, 512, 480, 451] },
    ],
  }),
}

export const negativeValues = {
  scenario: 'Negative values',
  component: chart({
    label: 'Net cash flow per quarter',
    labels: QUARTERS,
    format: thousands,
    series: [{ name: 'Net cash flow', values: [42, -18, -31, 65], color: 'green' }],
  }),
}

const SALES_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const randomWeek = (low, high) =>
  SALES_LABELS.map(() => Math.round(low + Math.random() * (high - low)))

const randomSales = () => [
  { name: 'Online', values: randomWeek(40, 160) },
  { name: 'In store', values: randomWeek(20, 90) },
]

export const liveData = {
  scenario: 'Live data from a state',
  component: component('chart-live-demo', {
    setup: (self) => {
      const sales = initState(self, 'chart.sales', randomSales())
      return stack(
        { gap: 3 },
        chart({ label: 'Orders per day, this week', labels: SALES_LABELS, series: sales }),
        button({ events: { click: () => sales.set(randomSales()) } }, 'Load another week'),
      )
    },
  })(),
}
