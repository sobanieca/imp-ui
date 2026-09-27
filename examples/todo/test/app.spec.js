import { expect, test } from 'imp/test'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const eventually = async (read, expected, { timeout = 5000 } = {}) => {
  const started = Date.now()
  let last
  while (Date.now() - started < timeout) {
    last = await read().catch((error) => `error: ${error.message}`)
    if (JSON.stringify(last) === JSON.stringify(expected)) return last
    await pause(50)
  }
  return last
}

const textOf = (page, selector) =>
  page.$eval(selector, (node) => (node.shadowRoot ?? node).textContent.trim())

const findButton = (page, text) =>
  page.evaluateHandle((wanted) => {
    const search = (root) => {
      for (const node of root.querySelectorAll('*')) {
        if (node.localName === 'button' && node.textContent.trim() === wanted) return node
        const found = node.shadowRoot ? search(node.shadowRoot) : null
        if (found) return found
      }
      return null
    }
    return search(document)
  }, text)

const clickButton = async (page, text) =>
  (await findButton(page, text)).evaluate((node) => node.click())

const isEnabled = async (page, text) =>
  (await findButton(page, text)).evaluate((node) => !node.disabled)

const titles = (page) =>
  page.$eval(
    'imp-list',
    (node) => [...node.shadowRoot.querySelectorAll('.title')].map((title) => title.textContent),
  )

const isPresent = (page, selector) => page.$(selector).then((node) => node !== null)

const ACCOUNT = 'button[aria-label="Account and settings"]'

const accountOpen = (page) =>
  page.$eval(
    'todo-account-menu',
    (node) => node.shadowRoot.querySelector('.panel').matches(':popover-open'),
  )

const openAccount = async (page) => {
  if (!(await accountOpen(page))) await page.click(ACCOUNT)
}

const pick = async (page, host, label) => {
  await openAccount(page)
  await page.click(`${host} >>> imp-menu-button >>> button`)
  await page.$eval(host, (node, wanted) => {
    const items = [
      ...node.shadowRoot.querySelector('imp-menu-button').shadowRoot
        .querySelectorAll('[role="menuitemradio"]'),
    ]
    items.find((item) => item.textContent.includes(wanted)).click()
  }, label)
}

const sectionsInView = (page) =>
  page.$eval('imp-shell', (node) => {
    const bar = node.shadowRoot.querySelector('.bar-body')
    const edge = bar.getBoundingClientRect()
    return [...bar.querySelectorAll('a')].filter((link) => {
      const box = link.getBoundingClientRect()
      return box.left >= edge.left && box.right <= edge.right + 1
    }).map((link) => link.textContent.trim().replace(/\d+$/, ''))
  })

test('a visitor without a session gets the sign-in form', async ({ page }) => {
  await page.setViewport({ width: 1200, height: 900 })
  expect(await eventually(() => isPresent(page, 'todo-sign-in'), true)).toEqual(true)
  expect(await textOf(page, 'todo-sign-in >>> h1')).toEqual('Sign in')
  expect(await isPresent(page, 'todo-list-screen')).toEqual(false)
})

test('the form checks the email before it signs in', async ({ page }) => {
  await page.type('input[type="text"]', 'Ada Lovelace')
  await page.type('input[type="email"]', 'not-an-email')
  await page.keyboard.press('Enter')
  await pause(200)
  expect(await isPresent(page, 'todo-list-screen')).toEqual(false)
  expect(await page.$eval('input[type="email"]', (node) => node.getAttribute('aria-invalid')))
    .toEqual('true')
})

test('a sign-in loads the todos, through one retried 503', async ({ page }) => {
  await page.$eval('input[type="email"]', (node) => node.select())
  await page.type('input[type="email"]', 'ada@example.com')
  await page.keyboard.press('Enter')
  expect(
    await eventually(() => titles(page), [
      'Write the first screen',
      'Ship it',
      'Read the imp skills',
    ]),
  ).toEqual(['Write the first screen', 'Ship it', 'Read the imp skills'])
  expect(await textOf(page, 'imp-user-card')).toContain('Ada Lovelace')
  expect(await page.title()).toEqual('Todos - Todo')
  expect(await textOf(page, 'todo-progress >>> .label')).toEqual('1 of 3 done')
})

test('the account menu holds the settings, so every section fits a narrow desktop bar', async ({ page }) => {
  await page.setViewport({ width: 800, height: 900 })
  expect(await eventually(() => sectionsInView(page), ['Todos', 'Stats', 'About']))
    .toEqual(['Todos', 'Stats', 'About'])
  expect(await accountOpen(page)).toEqual(false)
  await page.click(ACCOUNT)
  expect(await accountOpen(page)).toEqual(true)
  const trigger = await page.accessibility.snapshot({
    root: await page.$(ACCOUNT),
    interestingOnly: false,
  })
  expect({ role: trigger.role, name: trigger.name, expanded: trigger.expanded }).toEqual({
    role: 'button',
    name: 'Account and settings',
    expanded: true,
  })
  expect(await textOf(page, 'todo-account-menu >>> imp-user-card')).toContain('ada@example.com')
  await page.keyboard.press('Escape')
  expect(await eventually(() => accountOpen(page), false)).toEqual(false)
  await page.setViewport({ width: 1200, height: 900 })
})

test('a new todo goes to the backend and into the list', async ({ page }) => {
  await page.type('todo-list-screen >>> input[type="text"]', 'Buy milk')
  await page.keyboard.press('Enter')
  expect(await eventually(() => titles(page).then((list) => list.includes('Buy milk')), true))
    .toEqual(true)
  expect(await textOf(page, 'todo-progress >>> .label')).toEqual('1 of 4 done')
  expect(await page.$eval('todo-list-screen >>> input[type="text"]', (node) => node.value))
    .toEqual('')
  expect(await eventually(() => isPresent(page, 'imp-toast'), true)).toEqual(true)
})

test('a check marks a todo as done, and the filters follow', async ({ page }) => {
  await page.$eval(`button[aria-label='Mark "Ship it" as done']`, (node) => node.click())
  expect(await eventually(() => textOf(page, 'todo-progress >>> .label'), '2 of 4 done'))
    .toEqual('2 of 4 done')
  await clickButton(page, 'Done')
  expect(await eventually(() => titles(page), ['Read the imp skills', 'Ship it']))
    .toEqual(['Read the imp skills', 'Ship it'])
  await clickButton(page, 'Open')
  expect(await eventually(() => titles(page), ['Write the first screen', 'Buy milk']))
    .toEqual(['Write the first screen', 'Buy milk'])
  await clickButton(page, 'All')
})

test('the flagged button clears every done todo', async ({ page }) => {
  expect(await eventually(() => isEnabled(page, 'Clear done'), true)).toEqual(true)
  await clickButton(page, 'Clear done')
  expect(await eventually(() => titles(page), ['Write the first screen', 'Buy milk']))
    .toEqual(['Write the first screen', 'Buy milk'])
})

test('a title opens the todo, and the edit dialog saves it', async ({ page }) => {
  await page.$eval('imp-list', (node) => node.shadowRoot.querySelector('a.title').click())
  expect(
    await eventually(() => textOf(page, 'todo-detail-screen >>> h1'), 'Write the first screen'),
  )
    .toEqual('Write the first screen')
  expect(page.url()).toMatch(/\/todos\/2$/)
  await clickButton(page, 'Edit')
  await page.waitForSelector('todo-detail-screen >>> textarea')
  await page.type('todo-detail-screen >>> textarea', 'Use **imp/std** components.')
  await clickButton(page, 'Save')
  expect(
    await eventually(
      () => textOf(page, 'todo-detail-screen >>> imp-markdown >>> strong'),
      'imp/std',
    ),
  )
    .toEqual('imp/std')
})

test('an unknown todo renders the error boundary', async ({ page }) => {
  await page.goto(new URL('/todos/404', page.url()).href)
  expect(await eventually(() => isPresent(page, 'todo-detail-screen >>> imp-empty-state'), true))
    .toEqual(true)
  expect(await textOf(page, 'todo-detail-screen >>> imp-empty-state')).toContain(
    'This todo does not exist',
  )
})

test('the language menu switches the whole app to Polish', async ({ page }) => {
  await page.goto(new URL('/todos', page.url()).href)
  await eventually(() => isPresent(page, 'imp-list'), true)
  await pick(page, 'imp-lang-select', 'Polski')
  expect(await eventually(() => textOf(page, 'todo-list-screen >>> h1'), 'Zadania')).toEqual(
    'Zadania',
  )
  expect(await page.$eval('html', (node) => node.lang)).toEqual('pl')
  expect(await eventually(() => page.title(), 'Zadania - Zadania')).toEqual('Zadania - Zadania')
  await pick(page, 'imp-lang-select', 'English')
  expect(await eventually(() => textOf(page, 'todo-list-screen >>> h1'), 'Todos')).toEqual('Todos')
})

test('the theme menu switches to the dark aurora theme and back', async ({ page }) => {
  const scheme = () => page.$eval('html', (node) => node.style.getPropertyValue('color-scheme'))
  expect(await scheme()).toEqual('light')
  await pick(page, 'imp-theme-select', 'Aurora dark')
  expect(await eventually(scheme, 'dark')).toEqual('dark')
  expect(
    await page.$eval('html', (node) => node.style.getPropertyValue('--imp-color-primary')),
  ).toEqual('#a18dff')
  await pick(page, 'imp-theme-select', 'Aurora light')
  expect(await eventually(scheme, 'light')).toEqual('light')
})

test('the stats area loads on demand, with its own translations', async ({ page }) => {
  await page.goto(new URL('/stats', page.url()).href)
  expect(await eventually(() => textOf(page, 'todo-stats-screen >>> h1'), 'Stats')).toEqual('Stats')
  expect(
    await eventually(() => textOf(page, 'todo-stats-screen >>> .subtitle'), '2 open, 0 done'),
  )
    .toEqual('2 open, 0 done')
})

test('a sign-out goes back to the sign-in form', async ({ page }) => {
  await openAccount(page)
  await clickButton(page, 'Sign out')
  expect(await eventually(() => isPresent(page, 'todo-sign-in'), true)).toEqual(true)
})
