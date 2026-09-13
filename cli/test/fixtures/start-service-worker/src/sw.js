import { env } from 'imp'
import { startDevMode } from 'imp/service-worker'
import { greeting } from './greeting.js'

self.__fixture = { greeting, devTools: env.DEV_TOOLS }

if (env.DEV_TOOLS === 'on') startDevMode()
