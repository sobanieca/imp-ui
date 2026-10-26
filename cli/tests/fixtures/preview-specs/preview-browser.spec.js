import { test } from 'imp/test'
import { base } from './server.js'

const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

test('imp preview renders scenarios in a browser', async ({ page: host }) => {
  const browser = host.browser()
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    globalThis.impResizeLoops = 0
    globalThis.impEventStreams = 0
    const PageEventSource = globalThis.EventSource
    globalThis.EventSource = class extends PageEventSource {
      constructor(...args) {
        super(...args)
        globalThis.impEventStreams++
      }
    }
    globalThis.impErrors = []
    globalThis.addEventListener('error', (event) => {
      if (String(event.message).includes('ResizeObserver loop')) globalThis.impResizeLoops++
    })
    const reportError = console.error.bind(console)
    console.error = (...args) => {
      globalThis.impErrors.push(args.map(String).join(' '))
      reportError(...args)
    }
    globalThis.impRoot = () => document.querySelector('imp-preview-page')?.shadowRoot ?? null
    globalThis.impAll = (name, from) => {
      const found = []
      const walk = (root) => {
        for (const element of root.querySelectorAll('*')) {
          if (element.localName === name) found.push(element)
          if (element.shadowRoot) walk(element.shadowRoot)
        }
      }
      const start = from ?? globalThis.impRoot()
      if (start) {
        walk(start)
        if (start.shadowRoot) walk(start.shadowRoot)
      }
      return found
    }
    globalThis.impOne = (name, from) => globalThis.impAll(name, from)[0] ?? null
    globalThis.impDeep = (selector, from) => {
      const search = (root) => {
        const direct = root.querySelector(selector)
        if (direct) return direct
        for (const element of root.querySelectorAll('*')) {
          if (element.shadowRoot) {
            const found = search(element.shadowRoot)
            if (found) return found
          }
        }
        return null
      }
      const start = from ?? globalThis.impRoot()
      return start ? search(start.shadowRoot ?? start) : null
    }
    globalThis.impScenarios = () => globalThis.impAll('imp-preview-scenario')
    globalThis.impCodeOf = (scenario) =>
      [...globalThis.impOne('imp-code-block', scenario).shadowRoot.querySelectorAll('.line')]
        .map((line) => line.textContent).join('\n')
    globalThis.impLabelled = (name, from) =>
      globalThis.impAll(name, from).map((host) => ({
        label: host.shadowRoot.querySelector('label')?.textContent.trim() ?? '',
        control: host.shadowRoot.querySelector('input, select'),
      }))
    globalThis.impPicker = (label) =>
      globalThis.impLabelled('imp-select').find((entry) => entry.label === label)?.control
    globalThis.impSwitcher = (label) => {
      const menu = globalThis.impAll('imp-menu-button').find((host) =>
        host.shadowRoot.querySelector('imp-button')?.shadowRoot
          .querySelector(`[aria-label="Choose a ${label}"]`) !== null
      )
      const step = menu.parentNode.querySelector('imp-button')
      return {
        items: () => [...menu.shadowRoot.querySelectorAll('[role="menuitem"]')],
        options: () =>
          [...menu.shadowRoot.querySelectorAll('[role="menuitem"]')]
            .map((item) => item.textContent),
        selected: () => step.shadowRoot.querySelector('.label').textContent,
        pick: (value) =>
          [...menu.shadowRoot.querySelectorAll('[role="menuitem"]')]
            .find((item) => item.textContent === value).click(),
        step: () => step.shadowRoot.querySelector('.button').click(),
      }
    }
    globalThis.impTextareas = (editor) =>
      [...editor.shadowRoot.querySelectorAll('imp-text-field')]
        .map((host) => host.shadowRoot.querySelector('textarea'))
  })
  await page.goto(`${base}/widgets/counter`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.impRoot() &&
    globalThis.impAll('imp-preview-state')
        .flatMap((editor) => globalThis.impTextareas(editor))
        .filter((field) => !field.disabled).length === 3
  )
  const counter = await page.evaluate(() => {
    const scenarios = globalThis.impScenarios()
    const read = (scenario) =>
      globalThis.impOne('demo-counter', scenario).shadowRoot.querySelector('#value').textContent
    return {
      names: scenarios.map((scenario) => scenario.shadowRoot.querySelector('h2').textContent),
      rendered: scenarios.map(read),
      states: scenarios.map((scenario) => {
        const editor = globalThis.impOne('imp-preview-state', scenario)
        const row = editor.shadowRoot
        return `${row.querySelector('.name').textContent} ${
          row.querySelector('.provider').textContent
        }=${globalThis.impTextareas(editor)[0].value}`
      }),
      handles: globalThis.impOne('imp-preview-stage', scenarios[0])
        .shadowRoot.querySelectorAll('.handle').length,
    }
  })
  const agent = await page.evaluate(() => {
    const skill = globalThis.impOne('imp-preview-skill')
    const strip = skill.shadowRoot.querySelector('.agent')
    const copy = globalThis.impOne('imp-button', strip)
    return {
      strips: globalThis.impAll('imp-preview-skill').length,
      region: strip.getAttribute('aria-label'),
      instruction: strip.querySelector('.instruction').textContent,
      copy: `${copy.shadowRoot.querySelector('button').getAttribute('aria-label')} button ` +
        `with ${globalThis.impAll('imp-icon', copy).length} icon, ${
          globalThis.impAll('imp-tooltip', strip).some((host) =>
              globalThis.impOne('imp-button', host) === copy
            )
            ? 'in a tooltip'
            : 'without a tooltip'
        }`,
    }
  })
  const codeAndSkill = await page.evaluate(async () => {
    const scenario = globalThis.impScenarios()[0]
    const toggle = globalThis.impAll('imp-button', scenario)
      .map((node) => node.shadowRoot.querySelector('button'))
      .find((node) => node?.textContent.includes('Code example'))
    const block = () => scenario.shadowRoot.querySelector('.code')
    const hidden = block().hidden
    const before = toggle.getAttribute('aria-pressed')
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
    toggle.click()
    await settle()
    toggle.click()
    await settle()
    const hiddenAgain = block().hidden
    toggle.click()
    await settle()
    const [pageTabs, scenarioTabs] = globalThis.impAll('imp-tabs')
    const labels = (host) =>
      [...host.shadowRoot.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent.trim())
    const selected = (host) =>
      host.shadowRoot.querySelector('[role="tab"][aria-selected="true"]').textContent.trim()
    const skill = globalThis.impOne('imp-preview-skill').shadowRoot
    return {
      hidden: `${hidden}, hidden again after a second click: ${hiddenAgain}`,
      toggle: `${before} -> ${toggle.getAttribute('aria-pressed')}`,
      code: globalThis.impCodeOf(scenario),
      stored: localStorage.getItem('imp.preview.code'),
      tabs: labels(pageTabs).join(', '),
      scenarioTabs: `${labels(scenarioTabs).join(', ')} (${
        scenarioTabs.shadowRoot.querySelector('[role="tablist"]').getAttribute('aria-orientation')
      }, selected ${selected(scenarioTabs)})`,
      heading: skill.querySelector('h1').textContent,
      rows: skill.querySelectorAll('table tr').length,
      link: skill.querySelector('p:last-of-type').textContent,
    }
  })
  const stateToggle = await page.evaluate(async () => {
    const scenario = globalThis.impScenarios()[0]
    const toggle = globalThis.impAll('imp-button', scenario)
      .find((node) => node.shadowRoot.querySelector('[aria-label="Edit state"]') !== null)
      .shadowRoot.querySelector('button')
    const dialog = globalThis.impOne('imp-dialog', scenario)
    const panel = dialog.shadowRoot.querySelector('dialog')
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
    const before = toggle.getAttribute('aria-pressed')
    toggle.click()
    await settle()
    const showing = () => panel.matches(':popover-open, [open]')
    const until = async (condition) => {
      for (let attempt = 0; attempt < 40 && !condition(); attempt++) await settle()
    }
    await until(showing)
    const opened = `${toggle.getAttribute('aria-pressed')}/${showing()}`
    dialog.shadowRoot.querySelector('.close').click()
    await until(() => !showing())
    const closed = `${toggle.getAttribute('aria-pressed')}/${showing()}`
    toggle.click()
    await settle()
    return { before, opened, closed }
  })
  const edited = await page.evaluate(() => {
    const scenario = globalThis.impScenarios()[0]
    const editor = globalThis.impOne('imp-preview-state', scenario)
    const field = globalThis.impTextareas(editor)[0]
    field.value = '42'
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    globalThis.impOne('imp-button', editor).shadowRoot.querySelector('button').click()
    return globalThis.impOne('demo-counter', scenario)
      .shadowRoot.querySelector('#value').textContent
  })
  const rejected = await page.evaluate(() => {
    const scenario = globalThis.impScenarios()[0]
    const editor = globalThis.impOne('imp-preview-state', scenario)
    const field = globalThis.impTextareas(editor)[0]
    field.value = '{ not json'
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    globalThis.impOne('imp-button', editor).shadowRoot.querySelector('button').click()
    return editor.shadowRoot.querySelector('.message').classList.contains('message--error')
  })
  const localized = await page.evaluate(async () => {
    const languages = globalThis.impPicker('Language')
    const directions = globalThis.impSwitcher('direction')
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
    const stage = () => globalThis.impOne('imp-preview-stage').shadowRoot.querySelector('.stage')
    const state = () =>
      `${document.documentElement.lang}/${document.documentElement.dir}/${stage().dir}`
    const pick = async (picker, value) => {
      picker.value = value
      picker.dispatchEvent(new Event('change'))
      await settle()
      return state()
    }
    const pin = async (value) => {
      directions.pick(value)
      await settle()
      return state()
    }
    const step = async () => {
      directions.step()
      await settle()
      return `${directions.selected()} ${state()}`
    }
    const chrome = () => globalThis.impOne('imp-shell').getAttribute('dir')
    const words = () => {
      const shadow = globalThis.impOne('demo-counter').shadowRoot
      return `${shadow.querySelector('#label').textContent}/${
        shadow.querySelector('#cancel').textContent
      }`
    }
    return {
      languages: [...languages.options].map((option) => option.value),
      directions: directions.options(),
      directionIcons: directions.items().every((item) => item.querySelector('imp-icon') !== null),
      english: words(),
      polish: await pick(languages, 'pl') && words(),
      arabic: await pick(languages, 'ar'),
      arabicWords: words(),
      arabicChrome: chrome(),
      pinnedLtr: await pin('ltr'),
      steppedToRtl: await step(),
      steppedToAuto: await step(),
      backToEnglish: await pick(languages, 'en'),
    }
  })

  const themed = await page.evaluate(() => {
    const themes = globalThis.impSwitcher('theme')
    const surface = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--imp-color-surface')
    const font = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--imp-font-family')
    const apply = (value) => {
      themes.pick(value)
      return surface()
    }
    const iconOf = (item) => item.querySelector('imp-icon') !== null
    const initial = themes.selected()
    const dark = apply('imp-dark')
    const darkFont = font()
    themes.step()
    const stepped = themes.selected()
    return {
      options: themes.options(),
      icons: themes.items().every(iconOf),
      selected: initial,
      dark,
      darkFont,
      stepped,
      custom: apply('brand'),
    }
  })

  const themeEdits = await page.evaluate(async () => {
    const open = globalThis.impAll('imp-button')
      .find((node) => node.shadowRoot.textContent.includes('edit theme'))
    open.shadowRoot.querySelector('button').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const editorHost = globalThis.impOne('imp-theme-editor')
    const panel = editorHost.shadowRoot
    const KNOB_HOSTS = ['imp-color-picker', 'imp-combo-box', 'imp-segmented']
    const knobHosts = []
    const walkKnobs = (root) => {
      for (const element of root.querySelectorAll('*')) {
        if (KNOB_HOSTS.includes(element.localName)) knobHosts.push(element)
        if (element.shadowRoot) walkKnobs(element.shadowRoot)
      }
    }
    walkKnobs(panel)
    const labelOf = (host) =>
      host.shadowRoot.querySelector('.label')?.textContent.trim() ?? '(no label)'
    const knobs = knobHosts.map((host) => `${labelOf(host)} (${host.localName})`)
    const host = (label) => knobHosts.find((candidate) => labelOf(candidate) === label)
    const token = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(`--imp-${name}`).trim()
    const type = (label, value) => {
      const node = host(label).shadowRoot.querySelector('#control')
      node.value = value
      node.dispatchEvent(new Event('input'))
    }
    const pick = (label, choice) =>
      [...host(label).shadowRoot.querySelectorAll('.segment')]
        .find((segment) => segment.textContent.trim() === choice).click()
    const contrast = () =>
      [...(globalThis.impDeep('.contrast', editorHost)?.querySelectorAll('imp-text') ?? [])]
        .map((line) => line.shadowRoot.textContent.trim()).join(', ') || 'no contrast problem'
    type('Primary', '#ffd400')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const yellow = `${contrast()} (primary ${token('color-primary')})`
    const json = globalThis.impDeep('textarea', globalThis.impOne('imp-code-editor', editorHost))
    json.value = JSON.stringify({ ...JSON.parse(json.value), 'color-primary': '#ffd400' })
    json.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const failing = contrast()
    type('Primary', '#8821ac')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const passing = contrast()
    const primary = token('color-primary')
    const derived = token('color-on-primary')
    pick('Border radius', 'none')
    const flat = token('radius-item')
    type('Shadow colour', '#ff0000')
    const shadow = token('color-shadow')
    const headingBefore = `${
      host('Heading colour').shadowRoot.querySelector('#control').value
    } (token ${token('color-heading')})`
    type('Heading colour', '#005500')
    const heading = token('color-heading')
    pick('Loader', 'dots')
    const loader = token('loader')
    return {
      knobs: knobs.join(', '),
      yellow,
      failing,
      passing,
      primary,
      derived,
      flat,
      shadow,
      headingBefore,
      heading,
      loader,
      usage: globalThis.impDeep('pre', globalThis.impDeep('.usage', editorHost)).textContent
        .split('\n')[0],
    }
  })

  const shell = await page.evaluate(() => {
    const menu = globalThis.impOne('imp-shell').shadowRoot.querySelector('.sidebar')
    const links = [...menu.querySelectorAll('li.child .link')]
    const deepText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.data
      const scope = node.shadowRoot ?? node
      return [...scope.childNodes].map(deepText).join('')
    }
    const parts = (link) =>
      `${link.querySelector('.label').textContent} ${deepText(link.querySelector('.tag'))}`
    return {
      sidebar: links.map((link) => link.textContent).join(', '),
      groups: [...menu.querySelectorAll('li:not(.child) .link')].map(parts).join(', '),
      groupIcons: [...menu.querySelectorAll('li:not(.child) .link')]
        .map((link) => link.querySelector('.icon imp-icon')?.shadowRoot?.querySelector('svg'))
        .map((svg) => (svg ? `${svg.querySelectorAll('*').length} shapes` : 'no icon'))
        .join(', '),
      current: links.find((link) => link.hasAttribute('aria-current'))?.textContent ?? 'none',
      head: globalThis.impOne('imp-heading', globalThis.impOne('imp-preview-head')).shadowRoot
        .textContent.trim(),
      description: globalThis.impOne('imp-preview-head').shadowRoot
        .querySelector('.md.description').innerHTML.replace(/\s+/g, ' ').trim(),
    }
  })

  await page.goto(`${base}/`, { waitUntil: 'load' })
  await page.waitForFunction(() => globalThis.impOne('imp-preview-index'))
  const index = await page.evaluate(() => {
    const root = globalThis.impOne('imp-preview-index').shadowRoot
    const hero = root.querySelector('.hero')
    const deepText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.data
      const scope = node.shadowRoot ?? node
      return [...scope.childNodes].map(deepText).join('')
    }
    const rendered = (name, from = hero) => deepText(globalThis.impOne(name, from)).trim()
    const groupLink = (head) => globalThis.impOne('imp-link', head).shadowRoot.querySelector('a')
    return {
      headline: `${rendered('imp-heading')} - ${rendered('imp-text')}`,
      cards: [...root.querySelectorAll('imp-card')]
        .map((host) => host.shadowRoot.querySelector('.header'))
        .map((head) =>
          `${rendered('imp-heading', head)} ${rendered('imp-tag', head)} -> ${
            groupLink(head).getAttribute('href')
          }`
        )
        .join(' | '),
    }
  })

  await page.goto(`${base}/widgets`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.impOne('imp-preview-group') &&
    globalThis.impOne('demo-counter', globalThis.impOne('imp-preview-group'))?.shadowRoot
      ?.querySelector('#value')
  )
  const group = await page.evaluate(() => {
    const root = globalThis.impOne('imp-preview-group').shadowRoot
    const cards = [...root.querySelectorAll('imp-card')]
      .map((host) => host.shadowRoot.querySelector('.card'))
    const card = cards[0]
    const specimen = globalThis.impDeep('.specimen', card)
    const hero = root.querySelector('.hero')
    return {
      headline: globalThis.impOne('imp-heading', hero).shadowRoot.textContent.trim(),
      description: globalThis.impOne('imp-markdown', hero).shadowRoot.querySelector('p')
        .innerHTML.trim(),
      cards: cards.map((node) =>
        `${node.getAttribute('aria-label')} (${
          globalThis.impDeep('.card-scenario', node).textContent
        })`
      ).join(', '),
      inert: specimen.hasAttribute('inert'),
      specimen: globalThis.impOne('demo-counter', specimen).shadowRoot.querySelector('#value')
        .textContent,
      href: card.getAttribute('href'),
      title: document.title,
    }
  })
  await page.evaluate(() =>
    globalThis.impOne('imp-preview-group').shadowRoot.querySelector('imp-card').shadowRoot
      .querySelector('.card').click()
  )
  await page.waitForFunction(() => globalThis.impScenarios().length > 0)
  const opened = await page.evaluate(() => `${location.pathname} - ${document.title}`)

  await page.goto(`${base}/widgets/counter?scenario=lazy`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.impRoot() && globalThis.impOne('demo-counter')?.shadowRoot?.children
  )
  const isolated = await page.evaluate(() => {
    const scenarioTabs = globalThis.impAll('imp-tabs')[1].shadowRoot
    const selectedTab = scenarioTabs.querySelector('[role="tab"][aria-selected="true"]')
    const panel = scenarioTabs.getElementById(selectedTab.getAttribute('aria-controls'))
    const scenario = panel.querySelector('imp-preview-scenario')
    return {
      panels: globalThis.impScenarios().length,
      name: selectedTab.textContent.trim(),
      shown: scenario.shadowRoot.querySelector('h2').textContent,
      hiddenPanels: scenarioTabs.querySelectorAll('[role="tabpanel"][hidden]').length,
      code: globalThis.impCodeOf(scenario).split('\n').at(-1),
    }
  })

  await page.goto(`${base}/components/todos`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.impRoot() &&
    globalThis.impOne('demo-todos')?.shadowRoot?.querySelectorAll('.todo').length === 2 &&
    globalThis.impOne('imp-preview-state') !== null
  )
  const todos = await page.evaluate(() => ({
    items: [...globalThis.impOne('demo-todos').shadowRoot.querySelectorAll('.todo')]
      .map((item) => item.textContent),
    state: [
      ...globalThis.impOne('imp-preview-state').shadowRoot.querySelectorAll('.name, .provider'),
    ]
      .map((node) => node.textContent).join(' '),
    agent: globalThis.impOne('imp-preview-skill').shadowRoot.querySelector('.missing')
      .textContent,
    skill: globalThis.impOne('imp-empty-state', globalThis.impOne('imp-preview-skill'))
      .shadowRoot.querySelector('.title').textContent.trim(),
  }))

  const scenarioFrameOf = async () => {
    for (let attempt = 0; attempt < 150; attempt++) {
      for (const frame of page.frames()) {
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
  await page.goto(`${base}/components/todos?scenario=routed`, { waitUntil: 'load' })
  const scenarioFrame = await scenarioFrameOf()
  const framedBefore = await scenarioFrame.evaluate(() => ({
    path: location.pathname,
    todos: [...globalThis.impFramed('demo-todos').shadowRoot.querySelectorAll('.todo')]
      .map((item) => item.textContent).join(', '),
    review: document.getElementById('imp-review') !== null,
    streams: globalThis.impEventStreams,
  }))
  const frameTitle = await page.evaluate(() =>
    globalThis.impDeep('iframe.scenario-frame')?.getAttribute('title')
  )
  await scenarioFrame.evaluate(() =>
    globalThis.impFramed('imp-link').shadowRoot.querySelector('a').click()
  )
  await scenarioFrame.waitForFunction(() =>
    location.pathname === '/done' && globalThis.impFramed('imp-empty-state') !== null
  )
  const framedAfter = await scenarioFrame.evaluate(() =>
    globalThis.impFramed('imp-empty-state').shadowRoot.querySelector('.title').textContent.trim()
  )
  const pageAfterFrameClick = new URL(page.url())
  const themeBeforeFollow = await page.evaluate(() => globalThis.impSwitcher('theme').selected())
  await page.evaluate(() => globalThis.impSwitcher('theme').pick('imp-dark'))
  await scenarioFrame.waitForFunction(() =>
    document.documentElement.style.getPropertyValue('color-scheme') === 'dark'
  )
  const framedTheme = await scenarioFrame.evaluate(() =>
    document.documentElement.style.getPropertyValue('color-scheme')
  )
  await page.evaluate((name) => globalThis.impSwitcher('theme').pick(name), themeBeforeFollow)
  const framed = {
    title: frameTitle,
    before: framedBefore,
    after: framedAfter,
    page: `${pageAfterFrameClick.pathname}${pageAfterFrameClick.search}`,
    theme: framedTheme,
  }
  await page.goto(`${base}/components/todos`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.impRoot() &&
    globalThis.impOne('demo-todos')?.shadowRoot?.querySelectorAll('.todo').length === 2
  )

  const panelWidths = () => {
    const scenario = globalThis.impScenarios()[0]
    const width = (node) => Math.round(node.getBoundingClientRect().width)
    const panel = width(scenario.shadowRoot.querySelector('.scenario'))
    const head = width(scenario.shadowRoot.querySelector('.scenario-head'))
    const frame = width(
      globalThis.impOne('imp-preview-stage', scenario).shadowRoot.querySelector('.frame'),
    )
    const canvas = globalThis.impOne('imp-preview-canvas').shadowRoot.querySelector('.scroll')
    const strip = globalThis.impAll('imp-tabs')[1].shadowRoot
    const fold = strip.querySelector('.fold')
    return {
      folded: fold.getAttribute('aria-expanded') === 'false',
      foldLabel: fold.getAttribute('aria-label'),
      tabsInert: strip.querySelector('[role="tablist"]').inert,
      overHalf: panel * 2 > canvas.clientWidth,
      filled: head === panel && frame === panel,
      scrolls: canvas.scrollWidth > canvas.clientWidth,
    }
  }
  const widenedTo = async (width) => {
    const scenario = globalThis.impScenarios()[0]
    const stage = globalThis.impOne('imp-preview-stage', scenario).shadowRoot
    const input = globalThis.impOne('imp-text-field', stage.querySelector('.sizes')).shadowRoot
      .querySelector('input')
    const canvas = globalThis.impOne('imp-preview-canvas').shadowRoot.querySelector('.scroll')
    const frame = stage.querySelector('.frame')
    const readout = stage.querySelector('.readout')
    const type = async (value) => {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (
          readout.textContent.startsWith(`${Math.round(frame.getBoundingClientRect().width)} x`)
        ) {
          break
        }
      }
    }
    await type(String(width))
    const result = {
      frame: Math.round(frame.getBoundingClientRect().width),
      readout: readout.textContent.split(' x ')[0],
      beyondScreen: frame.getBoundingClientRect().width > innerWidth,
      scrolls: canvas.scrollWidth > canvas.clientWidth,
      reachable: canvas.scrollWidth >= frame.getBoundingClientRect().right -
          canvas.getBoundingClientRect().left + canvas.scrollLeft,
    }
    await type('')
    const panel = scenario.shadowRoot.querySelector('.scenario').getBoundingClientRect().width
    result.released = Math.round(frame.getBoundingClientRect().width) === Math.round(panel)
    return result
  }
  const wide = await page.evaluate(panelWidths)
  const wideStage = await page.evaluate(widenedTo, 2000)
  await page.setViewport({ width: 390, height: 844 })
  await page.waitForFunction(() =>
    globalThis.impAll('imp-tabs')[1].shadowRoot.querySelector('.fold')
      .getAttribute('aria-expanded') === 'false'
  )
  const shrunk = await page.evaluate(panelWidths)
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.impScenarios().length > 0 &&
    globalThis.impOne('imp-preview-stage')?.shadowRoot?.querySelector('.frame')
  )
  const phone = await page.evaluate(panelWidths)
  const phoneStage = await page.evaluate(widenedTo, 1280)
  const unfolded = await page.evaluate(async () => {
    const strip = globalThis.impAll('imp-tabs')[1].shadowRoot
    strip.querySelector('.fold').click()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const tab = strip.querySelector('[role="tab"]')
    return {
      expanded: strip.querySelector('.fold').getAttribute('aria-expanded'),
      tabsInert: strip.querySelector('[role="tablist"]').inert,
      tabVisible: tab.getBoundingClientRect().width > 0,
      remembered: localStorage.getItem('imp.preview.tabs'),
    }
  })
  const anchored = await page.evaluate(async () => {
    const scenario = globalThis.impScenarios()[0]
    const toggle = globalThis.impAll('imp-button', scenario)
      .map((node) => node.shadowRoot.querySelector('[aria-label="Edit state"]'))
      .find((node) => node !== null)
    const panel = globalThis.impOne('imp-dialog', scenario).shadowRoot.querySelector('dialog')
    toggle.click()
    for (let attempt = 0; attempt < 40 && !panel.matches(':popover-open'); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    await Promise.all(panel.getAnimations().map(({ finished }) => finished.catch(() => {})))
    const toggleBox = toggle.getBoundingClientRect()
    const box = panel.getBoundingClientRect()
    const result = {
      anchored: panel.hasAttribute('data-anchored') &&
        getComputedStyle(panel).positionAnchor !== 'none',
      below: Math.round(box.top - toggleBox.bottom),
      inside: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
    }
    globalThis.impOne('imp-dialog', scenario).shadowRoot.querySelector('.close').click()
    for (let attempt = 0; attempt < 40 && panel.matches(':popover-open'); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return result
  })
  await page.setViewport({ width: 1280, height: 800 })
  const resizeLoops = await page.evaluate(() => globalThis.impResizeLoops)
  check(
    resizeLoops === 0,
    `the preview chrome drove ${resizeLoops} ResizeObserver feedback loops - something read a ` +
      'size and then wrote layout that changes it',
  )
  const errors = await page.evaluate(() => globalThis.impErrors)
  check(errors.length === 0, `the preview page logged errors:\n${errors.join('\n')}`)

  const readout = await page.evaluate(() => {
    const stage = globalThis.impOne('imp-preview-stage').shadowRoot
    const node = stage.querySelector('.readout')
    const restore = node.textContent
    const widthShowing = (text) => {
      node.textContent = text
      return node.getBoundingClientRect().width
    }
    const result = { narrow: widthShowing('1 x 1'), wide: widthShowing('1280 x 800') }
    node.textContent = restore
    return result
  })
  check(
    readout.narrow === readout.wide,
    'the stage size readout resizes with its own text (' +
      `${readout.narrow} vs ${readout.wide}px) - a ResizeObserver writes that text, so its ` +
      'width must not depend on it or measuring the stage changes the stage',
  )

  await page.evaluate(() => {
    const applied = localStorage.getItem('imp.preview.theme') ?? 'brand'
    localStorage.setItem(
      `imp.theme-draft.${applied}`,
      JSON.stringify({
        tokens: { 'color-primary': '#ff00ff' },
        base: { 'color-primary': '#00ff00' },
      }),
    )
  })
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => globalThis.impOne?.('imp-shell'))
  const staleDraft = await page.evaluate(() => ({
    applied:
      document.documentElement.style.getPropertyValue('--imp-color-primary').trim() === '#ff00ff',
    left: Object.keys(localStorage).filter((key) => key.startsWith('imp.theme-draft.')).length,
  }))

  const report = [
    `scenarios: ${counter.names.join(', ')}`,
    `rendered values: ${counter.rendered.join(', ')}`,
    `state rows: ${counter.states.join(', ')}`,
    `resize handles per stage: ${counter.handles}`,
    `scenario tabs on a wide screen: folded ${wide.folded} ('${wide.foldLabel}', tabs inert ${wide.tabsInert}), panel takes over half of the canvas ${wide.overHalf}, head and stage fill it ${wide.filled}, canvas scrolls sideways ${wide.scrolls}`,
    `stage typed to 2000px on a wide screen: frame ${wideStage.frame}px (readout ${wideStage.readout}), wider than the screen ${wideStage.beyondScreen}, canvas scrolls sideways ${wideStage.scrolls}, right edge reachable ${wideStage.reachable}, cleared box releases the width ${wideStage.released}`,
    `scenario tabs after the screen shrinks to a phone: folded ${shrunk.folded} ('${shrunk.foldLabel}', tabs inert ${shrunk.tabsInert})`,
    `scenario tabs on a phone: folded ${phone.folded} ('${phone.foldLabel}', tabs inert ${phone.tabsInert}), panel takes over half of the canvas ${phone.overHalf}, head and stage fill it ${phone.filled}, canvas scrolls sideways ${phone.scrolls}`,
    `stage typed to 1280px on a phone: frame ${phoneStage.frame}px (readout ${phoneStage.readout}), wider than the screen ${phoneStage.beyondScreen}, canvas scrolls sideways ${phoneStage.scrolls}, right edge reachable ${phoneStage.reachable}, cleared box releases the width ${phoneStage.released}`,
    `after a tap on the fold button: aria-expanded ${unfolded.expanded}, tabs inert ${unfolded.tabsInert}, a tab is visible ${unfolded.tabVisible}, remembered as '${unfolded.remembered}'`,
    `state editor on a phone: anchored ${anchored.anchored}, ${anchored.below}px under its toggle, inside the viewport ${anchored.inside}`,
    `agent instruction strips on the page: ${agent.strips} (region '${agent.region}')`,
    `agent instruction: ${agent.instruction}`,
    `agent instruction copy control: ${agent.copy}`,
    `code hidden before the toggle: ${codeAndSkill.hidden}`,
    `code toggle pressed: ${codeAndSkill.toggle} (remembered as ${codeAndSkill.stored})`,
    `scenario tabs: ${codeAndSkill.scenarioTabs}`,
    `state toggle: ${stateToggle.before} -> opened ${stateToggle.opened} -> closed ${stateToggle.closed}`,
    `code of the first scenario:\n${codeAndSkill.code}`,
    `tabs: ${codeAndSkill.tabs}`,
    `skill heading: ${codeAndSkill.heading}`,
    `skill table rows: ${codeAndSkill.rows}`,
    `skill link retargeted: ${codeAndSkill.link}`,
    `after setting demo.count to 42: ${edited}`,
    `invalid JSON rejected: ${rejected}`,
    `language options: ${localized.languages.join(', ')}`,
    `direction options: ${
      localized.directions.join(', ')
    } (every item has an icon: ${localized.directionIcons})`,
    `app + imp words in en: ${localized.english}`,
    `app + imp words in pl: ${localized.polish}`,
    `app + imp words in ar: ${localized.arabicWords}`,
    `lang/dir/stage after picking ar: ${localized.arabic}`,
    `chrome direction while previewing ar: ${localized.arabicChrome}`,
    `lang/dir/stage after pinning ltr: ${localized.pinnedLtr}`,
    `direction, lang/dir/stage after one step: ${localized.steppedToRtl}`,
    `direction, lang/dir/stage after one more step: ${localized.steppedToAuto}`,
    `lang/dir/stage back on en: ${localized.backToEnglish}`,
    `theme options: ${
      themed.options.join(', ')
    } (selected ${themed.selected}, every item has an icon: ${themed.icons})`,
    `theme after one step from imp-dark: ${themed.stepped}`,
    `imp-dark surface token: ${themed.dark}`,
    `imp-dark font token, from the theme file that replaces it: ${themed.darkFont}`,
    `brand surface token: ${themed.custom}`,
    `theme editor knobs: ${themeEdits.knobs}`,
    `contrast after a yellow primary: ${themeEdits.yellow}`,
    `contrast after a yellow primary by hand in the JSON: ${themeEdits.failing}`,
    `contrast after a purple primary: ${themeEdits.passing}`,
    `after picking a primary: ${themeEdits.primary} (on-primary ${themeEdits.derived})`,
    `after picking radius none: ${themeEdits.flat}`,
    `after picking a shadow colour: ${themeEdits.shadow}`,
    `heading colour knob before a pick: ${themeEdits.headingBefore}`,
    `after picking a heading colour: ${themeEdits.heading}`,
    `after picking the dots loader: ${themeEdits.loader}`,
    `theme editor usage line: ${themeEdits.usage}`,
    `sidebar groups: ${shell.groups}`,
    `sidebar group icons: ${shell.groupIcons}`,
    `sidebar components: ${shell.sidebar}`,
    `sidebar current: ${shell.current}`,
    `page head: ${shell.head}`,
    `page head description: ${shell.description}`,
    `index headline: ${index.headline}`,
    `index cards: ${index.cards}`,
    `group headline: ${group.headline}`,
    `group description: ${group.description}`,
    `group cards: ${group.cards}`,
    `group card specimen is inert: ${group.inert}, shows ${group.specimen}, links to ${group.href}`,
    `group title: ${group.title}`,
    `after a click on the card: ${opened}`,
    `?scenario=lazy: ${isolated.panels} panels mounted, ${isolated.hiddenPanels} hidden, tab ${isolated.name} shows ${isolated.shown}, call site ${isolated.code}`,
    `mocked todos: ${todos.items.join(', ')}`,
    `mocked todos state row: ${todos.state}`,
    `agent strip without a sidecar: ${todos.agent}`,
    `skill tab without a sidecar: ${todos.skill}`,
    `framed scenario '${framed.title}': opens at ${framed.before.path}, todos ${framed.before.todos}, review widget ${framed.before.review}, event streams ${framed.before.streams}`,
    `a link in the frame moves the frame only: frame shows ${framed.after}, page stays at ${framed.page}`,
    `framed scenario follows the theme of the page: ${framed.theme}`,
    `a draft of a theme that changed since: applied ${staleDraft.applied}, drafts left: ${staleDraft.left}`,
  ].join('\n')
  console.log(`IMP-REPORT-BEGIN\n${report}\nIMP-REPORT-END`)
}, { timeout: 300000 })
