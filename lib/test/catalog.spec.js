import { expect, test } from 'imp/test'

const CATALOG = 'catalog-showcase'

const inCatalog = (page, selector, read) =>
  page.evaluate(
    ([showcase, target, reader]) => {
      const scope = document.querySelector(showcase).shadowRoot
      const node = target.split(' >>> ').reduce(
        (root, part) => root.querySelector(part).shadowRoot ?? root.querySelector(part),
        scope,
      )
      return new Function('node', `return (${reader})(node)`)(node)
    },
    [CATALOG, selector, read.toString()],
  )

const focusedIn = (page) =>
  page.evaluate(() => {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return {
      tag: active?.localName ?? null,
      role: active?.getAttribute('role') ?? '',
      text: active?.textContent.trim() ?? '',
      label: active?.getAttribute('aria-label') ?? '',
      checked: active?.getAttribute('aria-checked') ?? '',
    }
  })

const recorded = (page, key) => page.evaluate((name) => globalThis.__impCatalog?.[name], key)

test('list names itself, renders a row per record, and reports a chosen row', async ({ page }) => {
  const host = '#catalog-list imp-list'
  expect(await inCatalog(page, `${host} >>> ul`, (ul) => ul.getAttribute('aria-label'))).toEqual(
    'People',
  )
  expect(await inCatalog(page, `${host} >>> ul`, (ul) => ul.querySelectorAll('li').length)).toEqual(
    2,
  )
  expect(await inCatalog(page, `${host} >>> imp-tag`, (node) => node.textContent.trim())).toEqual(
    'Admin',
  )
  await inCatalog(page, `${host} >>> .title`, (node) => node.click())
  expect(await recorded(page, 'list')).toEqual({
    id: 1,
    item: {
      id: 1,
      title: 'Ada Lovelace',
      description: 'Engineer',
      name: 'Ada Lovelace',
      tag: { text: 'Admin', color: 'blue' },
    },
  })
})

test('select is a labelled native select that changes from the keyboard', async ({ page }) => {
  const control = `${CATALOG} >>> #catalog-select imp-select >>> #control`
  expect(await inCatalog(page, '#catalog-select imp-select >>> #control', (node) => node.localName))
    .toEqual('select')
  expect(
    await inCatalog(
      page,
      '#catalog-select imp-select >>> label',
      (node) => node.textContent.trim(),
    ),
  ).toEqual('Flavour')
  await page.focus(control)
  await page.select(control, 'chocolate')
  expect(await inCatalog(page, '#catalog-select imp-select >>> #control', (node) => node.value))
    .toEqual('chocolate')
})

test('fileUpload takes a file through its input and lists it with a remove button', async ({ page }) => {
  const host = '#catalog-upload imp-file-upload'
  const listed = (present) =>
    page.waitForFunction(
      ([showcase, selector, wanted]) =>
        (document.querySelector(showcase).shadowRoot.querySelector(selector).shadowRoot
          .querySelector('.file') !== null) === wanted,
      {},
      [CATALOG, host, present],
    )
  expect(await inCatalog(page, `${host} >>> #control`, (node) => node.type)).toEqual('file')
  expect(await inCatalog(page, `${host} >>> label.label`, (node) => node.textContent.trim()))
    .toEqual('Attachments')
  await inCatalog(page, `${host} >>> #control`, (input) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await listed(true)
  expect(await inCatalog(page, `${host} >>> .file .name`, (node) => node.textContent.trim()))
    .toEqual('notes.txt')
  await page.click(`${CATALOG} >>> ${host} >>> .file imp-button >>> button`)
  await listed(false)
})

test('avatar, descriptionList, markdown, tag, loader and skeleton render their semantics', async ({ page }) => {
  expect(
    await inCatalog(
      page,
      '#catalog-avatar imp-avatar >>> .initials',
      (node) => node.textContent.trim(),
    ),
  ).toEqual('AL')
  expect(
    await inCatalog(
      page,
      '#catalog-avatar imp-avatar >>> .avatar',
      (node) => node.getAttribute('aria-label'),
    ),
  ).toEqual('Ada Lovelace')
  expect(
    await inCatalog(
      page,
      '#catalog-description imp-description-list >>> dl',
      (dl) => [...dl.querySelectorAll('dt')].map((dt) => dt.textContent.trim()),
    ),
  ).toEqual(['Name', 'Role'])
  expect(
    await inCatalog(
      page,
      '#catalog-markdown imp-markdown >>> .prose',
      (prose) => prose.querySelector('h1').textContent,
    ),
  ).toEqual('Title')
  expect(
    await inCatalog(
      page,
      '#catalog-markdown imp-markdown >>> .prose',
      (prose) => prose.querySelector('strong').textContent,
    ),
  ).toEqual('bold')
  expect(await inCatalog(page, '#catalog-tag', (box) => box.querySelectorAll('imp-tag').length))
    .toEqual(2)
  expect(
    await inCatalog(
      page,
      '#catalog-tag imp-tag:last-child >>> [role="img"]',
      (dot) => dot.getAttribute('aria-label'),
    ),
  ).toEqual('Offline')
  expect(
    await inCatalog(
      page,
      '#catalog-loader imp-loader >>> [role="status"]',
      (node) => node.textContent.trim(),
    ),
  ).toEqual('Loading people')
  expect(
    await inCatalog(
      page,
      '#catalog-skeleton imp-skeleton >>> .root',
      (root) => root.querySelectorAll('.bone').length,
    ),
  ).toEqual(3)
  expect(
    await inCatalog(
      page,
      '#catalog-skeleton imp-skeleton >>> .root',
      (root) => root.getAttribute('aria-hidden'),
    ),
  ).toEqual('true')
})

test('steps marks the current step and reports a done step from the keyboard', async ({ page }) => {
  const host = '#catalog-steps imp-steps'
  expect(await inCatalog(page, `${host} >>> ol`, (ol) => ol.getAttribute('aria-label'))).toEqual(
    'Checkout',
  )
  expect(
    await inCatalog(
      page,
      `${host} >>> [aria-current="step"] .label`,
      (node) => node.textContent.trim(),
    ),
  ).toEqual('Payment')
  await page.focus(`${CATALOG} >>> ${host} >>> li:first-child button`)
  await page.keyboard.press('Enter')
  expect(await recorded(page, 'steps')).toEqual({ id: 'cart', index: 0 })
})

test('reactions toggles a chip, and the add button opens the emoji panel', async ({ page }) => {
  const host = '#catalog-reactions imp-reactions'
  const chip = `${CATALOG} >>> ${host} >>> .chip`
  expect(await inCatalog(page, `${host} >>> .chip`, (node) => node.getAttribute('aria-pressed')))
    .toEqual('false')
  await page.click(chip)
  expect(await recorded(page, 'reacted')).toEqual({ emoji: '\u{1F44D}', reacted: true })
  await page.click(`${CATALOG} >>> ${host} >>> .add`)
  await page.waitForFunction(
    ([showcase, selector]) =>
      document.querySelector(showcase).shadowRoot.querySelector(selector).shadowRoot.querySelector(
        '.panel',
      ).matches(':popover-open'),
    {},
    [CATALOG, host],
  )
  await page.keyboard.press('Escape')
})

test('segmented is a radiogroup that moves its choice with the arrow keys', async ({ page }) => {
  const host = '#catalog-segmented imp-segmented'
  expect(await inCatalog(page, `${host} >>> [role="radiogroup"]`, (node) => node.localName))
    .toEqual('fieldset')
  await page.focus(`${CATALOG} >>> ${host} >>> .segment[tabindex="0"]`)
  expect((await focusedIn(page)).text).toEqual('day')
  await page.keyboard.press('ArrowRight')
  const after = await focusedIn(page)
  expect(after.text).toEqual('week')
  expect(after.checked).toEqual('true')
  await page.keyboard.press('End')
  expect((await focusedIn(page)).text).toEqual('week')
})

test('appLogo, breadcrumbs and userCard name what they show', async ({ page }) => {
  expect(
    await inCatalog(page, '#catalog-logo imp-app-logo >>> a', (node) => node.getAttribute('href')),
  ).toEqual('/')
  expect(
    await inCatalog(
      page,
      '#catalog-logo imp-app-logo >>> .label',
      (node) => node.textContent.trim(),
    ),
  ).toEqual('Acme')
  expect(
    await inCatalog(
      page,
      '#catalog-crumbs imp-breadcrumbs >>> nav',
      (nav) => nav.getAttribute('aria-label'),
    ),
  ).toEqual('Breadcrumb')
  expect(
    await inCatalog(
      page,
      '#catalog-crumbs imp-breadcrumbs >>> nav',
      (nav) => [...nav.querySelectorAll('.crumb')].map((crumb) => crumb.textContent.trim()),
    ),
  ).toEqual(['Home', 'People', 'Ada'])
  expect(
    await inCatalog(
      page,
      '#catalog-crumbs imp-breadcrumbs >>> [aria-current="page"]',
      (node) => node.textContent.trim(),
    ),
  ).toEqual('Ada')
  expect(
    await inCatalog(
      page,
      '#catalog-user imp-user-card >>> .name',
      (node) => node.textContent.trim(),
    ),
  ).toEqual('Ada Lovelace')
  expect(
    await inCatalog(
      page,
      '#catalog-user imp-user-card >>> .description',
      (node) => node.textContent.trim(),
    ),
  ).toEqual('ada@example.com')
})

const menuOf = (id, host) => `${CATALOG} >>> #${id} ${host} >>> imp-menu-button`

const openMenu = async (page, id, host) => {
  await page.keyboard.press('Escape')
  await page.click(`${menuOf(id, host)} >>> .trigger >>> .button`)
  await page.waitForFunction(
    ([showcase, box, name]) => {
      const scope = document.querySelector(showcase).shadowRoot
      const menu = scope.querySelector(`#${box} ${name}`).shadowRoot.querySelector(
        'imp-menu-button',
      )
      return menu.shadowRoot.querySelector('.panel').matches(':popover-open')
    },
    {},
    [CATALOG, id, host],
  )
}

test('orgSelect lists the tenants and reports a choice from the keyboard', async ({ page }) => {
  await openMenu(page, 'catalog-org', 'imp-org-select')
  const first = await focusedIn(page)
  expect(first.role).toEqual('menuitemradio')
  expect(first.checked).toEqual('true')
  await page.keyboard.press('ArrowDown')
  expect((await focusedIn(page)).checked).toEqual('false')
  await page.keyboard.press('Enter')
  expect((await recorded(page, 'org')).id).toEqual('globex')
})

test('langSelect switches the language and the html lang attribute', async ({ page }) => {
  await openMenu(page, 'catalog-lang', 'imp-lang-select')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.documentElement.lang === 'pl')
  await openMenu(page, 'catalog-lang', 'imp-lang-select')
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.documentElement.lang === 'en')
})

test('themeSelect applies the chosen theme', async ({ page }) => {
  const scheme = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  await openMenu(page, 'catalog-theme', 'imp-theme-select')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).colorScheme === 'dark'
  )
  await openMenu(page, 'catalog-theme', 'imp-theme-select')
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).colorScheme === 'light'
  )
  expect(await scheme()).toEqual('light')
})
test('notifications counts a new notification and opens the list', async ({ page }) => {
  const host = '#catalog-bell imp-notifications'
  await page.click(`${CATALOG} >>> #catalog-notify`)
  await page.waitForFunction(
    ([showcase, selector]) =>
      document.querySelector(showcase).shadowRoot.querySelector(selector).shadowRoot
        .querySelector('.count imp-tag')?.shadowRoot.textContent.trim() === '1',
    {},
    [CATALOG, host],
  )
  expect(
    await inCatalog(
      page,
      `${host} >>> imp-button >>> button`,
      (node) => node.getAttribute('aria-label'),
    ),
  ).toContain('1')
  await page.click(`${CATALOG} >>> ${host} >>> imp-button >>> button`)
  const rowTitle = `${host} >>> imp-drawer >>> imp-notification-list >>> .item .title`
  await page.waitForFunction(
    ([showcase, selector]) => {
      const scope = document.querySelector(showcase).shadowRoot
      return selector.split(' >>> ').reduce(
        (root, part) => root?.querySelector(part)?.shadowRoot ?? root?.querySelector(part) ?? null,
        scope,
      ) !== null
    },
    {},
    [CATALOG, rowTitle],
  )
  expect(await inCatalog(page, rowTitle, (node) => node.textContent.trim()))
    .toEqual('Deploy finished')
  await page.keyboard.press('Escape')
  await page.waitForFunction(
    ([showcase, selector]) =>
      document.querySelector(showcase).shadowRoot.querySelector(selector).shadowRoot
        .querySelector('imp-drawer').shadowRoot.querySelector('.panel').open === false,
    {},
    [CATALOG, host],
  )
})

test('emojiPicker opens its panel and picks an emoji from the keyboard', async ({ page }) => {
  const host = '#catalog-emoji imp-emoji-picker'
  await page.keyboard.press('Escape')
  await page.click(`${CATALOG} >>> ${host} >>> #control`)
  await page.waitForFunction(
    ([showcase, selector]) =>
      document.querySelector(showcase).shadowRoot.querySelector(selector).shadowRoot
        .querySelector('#panel').matches(':popover-open'),
    {},
    [CATALOG, host],
  )
  await page.waitForFunction(() => {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return active?.classList.contains('emoji-search')
  })
  await page.keyboard.type('rocket')
  await page.waitForFunction(
    ([showcase, selector]) => {
      const panel = document.querySelector(showcase).shadowRoot.querySelector(selector).shadowRoot
      const shown = [...panel.querySelectorAll('.emoji-choice')].filter((choice) => !choice.hidden)
      return shown.length > 0 && shown.every((choice) => choice.title.includes('rocket'))
    },
    {},
    [CATALOG, host],
  )
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    ([showcase, selector]) =>
      document.querySelector(showcase).shadowRoot.querySelector(selector).shadowRoot
        .querySelector('.glyph').textContent.trim() !== '',
    {},
    [CATALOG, host],
  )
  expect(await inCatalog(page, `${host} >>> .glyph`, (node) => node.textContent.trim()))
    .toEqual('\u{1F680}')
})
