import { impLogger } from './logger.js'

const RELOAD_MARK = 'imp:reloaded-build'

const ENTRY_SCRIPT = 'script[type="module"][src]'

const entryScriptOf = (document) => {
  const src = document.querySelector(ENTRY_SCRIPT)?.getAttribute('src')
  return src ? new URL(src, location.href).href : null
}

const reloadedFrom = (build) => {
  try {
    return sessionStorage.getItem(RELOAD_MARK) === build
  } catch {
    return true
  }
}

const markReload = (build) => {
  try {
    sessionStorage.setItem(RELOAD_MARK, build)
    return true
  } catch {
    return false
  }
}

const servedBuild = async () => {
  try {
    const response = await fetch(location.href, {
      cache: 'no-store',
      headers: { accept: 'text/html' },
    })
    if (!response.ok) return null
    const page = new DOMParser().parseFromString(await response.text(), 'text/html')
    return entryScriptOf(page)
  } catch {
    return null
  }
}

const reloadForNewBuild = async () => {
  const running = entryScriptOf(document)
  if (running === null || reloadedFrom(running)) return false
  const served = await servedBuild()
  if (served === null || served === running || !markReload(running)) return false
  impLogger.warn('a chunk of this build is gone from the server - loading the new build')
  location.reload()
  return true
}

export const loadChunk = async (load) => {
  try {
    return await load()
  } catch (error) {
    if (error instanceof TypeError && (await reloadForNewBuild())) return new Promise(() => {})
    throw error
  }
}
