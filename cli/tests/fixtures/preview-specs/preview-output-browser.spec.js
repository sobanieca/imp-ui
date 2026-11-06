import { test } from 'imp/test'
import { base } from './server.js'

const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

test('the exported preview embeds in a page and shares its address', async ({ page: host }) => {
  const browser = host.browser()
  const helpers = () => {
    globalThis.impAll = (name, from = document) => {
      const found = []
      const walk = (root) => {
        for (const element of root.querySelectorAll('*')) {
          if (element.localName === name) found.push(element)
          if (element.shadowRoot) walk(element.shadowRoot)
        }
      }
      walk(from)
      if (from.shadowRoot) walk(from.shadowRoot)
      return found
    }
    globalThis.impOne = (name, from) => globalThis.impAll(name, from)[0] ?? null
    globalThis.impHeadShown = () => {
      const head = globalThis.impOne('imp-preview-head')
      return head !== null && globalThis.impOne('imp-heading', head) !== null
    }
    globalThis.impText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.data
      const scope = node.shadowRoot ?? node
      return [...scope.childNodes].map(globalThis.impText).join('')
    }
  }
  const frameOf = async (page) => {
    await page.waitForFunction(() =>
      document.querySelector('imp-preview')?.shadowRoot?.querySelector('iframe')?.contentDocument
        ?.querySelector('imp-preview-page')?.shadowRoot
    )
    const frame = page.frames().find((candidate) => candidate.url().startsWith('blob:'))
    await frame.evaluate(helpers)
    return frame
  }
  const shown = (frame) =>
    frame.evaluate(() => {
      const head = globalThis.impOne('imp-preview-head')
      const heading = head === null ? null : globalThis.impOne('imp-heading', head)
      return {
        index: globalThis.impOne('imp-preview-index') !== null,
        head: heading === null ? 'none' : globalThis.impText(heading).trim(),
        route: location.hash,
        title: document.title,
      }
    })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/gallery`, { waitUntil: 'load' })
  const frame = await frameOf(page)
  const index = await shown(frame)
  const frameUrl = frame.url()
  const frameIcon = await frame.evaluate(() => document.querySelector('link[rel="icon"]').href)
  await frame.evaluate(() => {
    const shell = globalThis.impOne('imp-shell')
    const link = [...shell.shadowRoot.querySelectorAll('a')]
      .find((anchor) => anchor.textContent.includes('Counter'))
    link.click()
  })
  await frame.waitForFunction(() => globalThis.impHeadShown())
  const component = await shown(frame)
  const hostAfterClick = new URL(page.url())
  await page.evaluate(() => {
    location.hash = '#/'
  })
  await frame.waitForFunction(() => globalThis.impOne('imp-preview-index'))
  const followed = await shown(frame)
  const hostAfterFollow = new URL(page.url())

  const deep = await browser.newPage()
  await deep.setViewport({ width: 1400, height: 900 })
  await deep.goto(`${base}/gallery#/widgets/counter?scenario=startsAtFive`, {
    waitUntil: 'load',
  })
  const deepFrame = await frameOf(deep)
  await deepFrame.waitForFunction(() => globalThis.impHeadShown())
  const deepLink = await shown(deepFrame)
  const selectedTab = await deepFrame.evaluate(() =>
    globalThis.impOne('imp-tabs', globalThis.impOne('imp-preview-scenario-tabs')).shadowRoot
      .querySelector('[aria-selected="true"]')?.textContent.trim()
  )
  const themeShown = () =>
    deepFrame.evaluate(() => document.documentElement.style.getPropertyValue('color-scheme'))
  const hostTheme = () =>
    deep.evaluate(() => document.querySelector('imp-preview').getAttribute('theme'))
  const themeBeforeOffer = await themeShown()
  await deep.evaluate(() => {
    globalThis.impThemeEvents = []
    const preview = document.querySelector('imp-preview')
    preview.addEventListener('imp-preview-theme', (event) => {
      globalThis.impThemeEvents.push(event.detail)
    })
    preview.theme = 'imp-dark'
  })
  await deepFrame.waitForFunction(() =>
    document.documentElement.style.getPropertyValue('color-scheme') === 'dark'
  )
  const themeAfterOffer = await themeShown()
  await deepFrame.evaluate(() => {
    globalThis.impAll('button')
      .find((candidate) => candidate.getAttribute('aria-label')?.includes('next theme'))
      .click()
  })
  await deep.waitForFunction(() =>
    document.querySelector('imp-preview').getAttribute('theme') !== 'imp-dark'
  )
  const themeAfterPick = { host: await hostTheme(), frame: await themeShown() }
  const themeEvents = await deep.evaluate(() => globalThis.impThemeEvents)
  const framedPage = await browser.newPage()
  framedPage.on('pageerror', (error) => errors.push(error.message))
  await framedPage.goto(`${base}/gallery#/components/todos?scenario=routed`, { waitUntil: 'load' })
  const scenarioFrameOf = async () => {
    for (let attempt = 0; attempt < 150; attempt++) {
      for (const frame of framedPage.frames()) {
        const ready = await frame.evaluate(() => {
          globalThis.impDeepIn = (root, selector) => {
            const direct = root.querySelector(selector)
            if (direct) return direct
            for (const element of root.querySelectorAll('*')) {
              const found = element.shadowRoot && globalThis.impDeepIn(element.shadowRoot, selector)
              if (found) return found
            }
            return null
          }
          globalThis.impFramed = (selector) => globalThis.impDeepIn(document, selector)
          return globalThis.name.startsWith('imp-preview-frame:') &&
            globalThis.impFramed('demo-todos')?.shadowRoot.querySelectorAll('.todo').length === 2
        }).catch(() => false)
        if (ready) return frame
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('the framed scenario never rendered its todos')
  }
  const scenarioFrame = await scenarioFrameOf()
  const galleryFrame = scenarioFrame.parentFrame()
  const framedUrl = scenarioFrame.url()
  await scenarioFrame.evaluate(() =>
    globalThis.impFramed('imp-link').shadowRoot.querySelector('a').click()
  )
  await scenarioFrame.waitForFunction(() =>
    location.hash === '#/done' && globalThis.impFramed('.done-title') !== null
  )
  const framedAfter = {
    gallery: await galleryFrame.evaluate(() => location.hash),
    host: new URL(framedPage.url()).hash,
  }
  await framedPage.evaluate(() => {
    document.querySelector('imp-preview').theme = 'imp-dark'
  })
  await scenarioFrame.waitForFunction(() =>
    document.documentElement.style.getPropertyValue('color-scheme') === 'dark'
  )
  const framedTheme = await scenarioFrame.evaluate(() =>
    document.documentElement.style.getPropertyValue('color-scheme')
  )

  const report = [
    `host page keeps its own document: ${await page.evaluate(() =>
      document.querySelector('h1').textContent
    )}`,
    `frame url is a blob of the host origin: ${frameUrl.startsWith(`blob:${base}/`)}`,
    `root-relative link of the entry resolves on the host: ${
      frameIcon === `${base}/favicon.svg`
    }`,
    `index shown first: ${index.index}, route ${
      JSON.stringify(index.route)
    }, title ${index.title}`,
    `after a click: ${component.head}, route ${component.route}, title ${component.title}`,
    `host address after the click: ${hostAfterClick.pathname}${hostAfterClick.hash}`,
    `host hash change followed: index ${followed.index}, route ${JSON.stringify(followed.route)}`,
    `host address after the follow: ${hostAfterFollow.pathname}${hostAfterFollow.hash}`,
    `deep link: ${deepLink.head}, route ${deepLink.route}, tab ${selectedTab}`,
    `sidebar without the imp brand: ${await deepFrame.evaluate(() =>
      globalThis.impOne('imp-app-logo') === null
    )}`,
    `theme before the host offers one: ${themeBeforeOffer}`,
    `theme after the host offers imp-dark: ${themeAfterOffer}`,
    `theme after a pick in the gallery: host ${themeAfterPick.host}, frame ${themeAfterPick.frame}`,
    `theme events on the element: ${themeEvents.join(', ')}`,
    `framed scenario loads the gallery page: ${framedUrl.startsWith(`blob:${base}/`)}, at ${new URL(framedUrl).hash}`,
    `a link in the frame moves the frame only: gallery ${framedAfter.gallery}, host ${framedAfter.host}`,
    `framed scenario follows the theme of the host: ${framedTheme}`,
    `page errors: ${errors.length ? errors.join(' | ') : 'none'}`,
  ].join('\n')
  console.log(`IMP-REPORT-BEGIN\n${report}\nIMP-REPORT-END`)
}, { timeout: 300000 })
