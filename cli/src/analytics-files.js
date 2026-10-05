import { analyticsNameProblem } from '../../lib/src/analytics-bus.js'

export const APP_ANALYTICS_FILE = 'app-analytics.json'

export const ANALYTICS_SUBJECTS = new Map([['zone', 'zone'], ['track', 'outcome']])

export const ANALYTICS_EXAMPLES = new Map([
  ['zone', 'myapp.invoice-summary'],
  ['track', 'myapp.invoice-sent'],
])

export const analyticsNameProblemOf = (helper, name) =>
  analyticsNameProblem(name, ANALYTICS_SUBJECTS.get(helper), ANALYTICS_EXAMPLES.get(helper))

export const appAnalyticsFile = ({ pages, zones, outcomes }) =>
  `${JSON.stringify({ pages, zones, outcomes }, null, 2)}\n`
