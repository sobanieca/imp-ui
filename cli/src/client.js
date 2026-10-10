import { reviewWidgetScript, TELEMETRY_ENTRIES } from './review.js'
import { browserScript } from './browser-script.js'
import { devClient } from './browser/dev-client.js'

export const DEV_WORKER_PATH = '/@imp/sw.js'

export const EVENTS_ENDPOINT = '/@imp/events'

export const LOG_ENDPOINT = '/@imp/log'

const THEME_DRAFT_MODULE = '/@imp/theme-draft.js'

const THEME_DRAFT_PREFIX = 'imp.theme-draft.'

export const clientScript = (
  { mocks = false, ownWorker = false, mark = '', themeEditor = true } = {},
) =>
  browserScript(devClient, {
    eventsEndpoint: EVENTS_ENDPOINT,
    logEndpoint: LOG_ENDPOINT,
    workerPath: ownWorker ? null : DEV_WORKER_PATH,
    telemetryEntries: TELEMETRY_ENTRIES,
    mocks,
    themeEditor,
    themeDraftPrefix: THEME_DRAFT_PREFIX,
    themeDraftModule: THEME_DRAFT_MODULE,
  }) + `;${reviewWidgetScript({ mark, themeEditor })}`
