import { expect, test } from 'imp/test'

const deepMatches = (query, present) => {
  const search = (root) => {
    const found = root.querySelector(query)
    if (found) return found
    for (const node of root.querySelectorAll('*')) {
      if (!node.shadowRoot) continue
      const deep = search(node.shadowRoot)
      if (deep) return deep
    }
    return null
  }
  return Boolean(search(document)) === present
}

const waitFor = (page, selector) =>
  page.waitForFunction(deepMatches, { polling: 100 }, selector, true)

const waitGone = (page, selector) =>
  page.waitForFunction(deepMatches, { polling: 100 }, selector, false)

const textOf = (page, selector) => page.$eval(selector, (node) => node.textContent)

const focusedInShell = () =>
  document.querySelector('todo-app-root')?.shadowRoot
    ?.querySelector('todo-app-shell')?.shadowRoot
    ?.activeElement?.id ?? null

test('lists what the api answers', async ({ page }) => {
  await waitFor(page, '#todo-t1')
  expect(await textOf(page, '>>> #summary >>> p')).toContain('1 of 4 done')
})

test('filters the list as you type', async ({ page }) => {
  await page.type('>>> imp-search-field >>> input', 'polish')
  await waitGone(page, '#todo-t1')
  expect(await page.$('>>> #todo-t3')).not.toEqual(null)
})

test('adds a todo through the form', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/todos/new`)
  await waitFor(page, 'imp-text-field')
  await page.type('>>> imp-text-field >>> input', 'Write the e2e spec')
  await page.type('>>> imp-text-area >>> textarea', 'One session per spec file.')
  await page.click('>>> imp-submit-button >>> button')

  await waitFor(page, '#todo-t5')
  expect(await textOf(page, '>>> #summary >>> p')).toContain('1 of 5 done')
})

test('the switch on a row saves the todo', async ({ page }) => {
  await page.click('>>> #todo-t5 >>> input[type="checkbox"]')
  await waitFor(page, '#todo-t5.done')
  expect(await textOf(page, '>>> #summary >>> p')).toContain('2 of 5 done')
})

test('opens a todo and saves an edit', async ({ page }) => {
  await page.click('>>> #todo-t1 >>> a')
  await waitFor(page, 'imp-text-field')
  await (await page.$('>>> imp-text-field >>> input')).click({ clickCount: 3 })
  await page.type('>>> imp-text-field >>> input', 'Read every imp skill')
  await page.click('>>> imp-submit-button >>> button')

  await waitFor(page, '#todo-t1')
  expect(await textOf(page, '>>> #todo-t1 >>> a')).toEqual('Read every imp skill')
})

test('deletes a todo from its own screen', async ({ page }) => {
  await page.click('>>> #todo-t5 >>> a')
  await waitFor(page, '.variant-danger')
  await page.click('>>> .variant-danger')

  await waitFor(page, '#todo-t1')
  await waitGone(page, '#todo-t5')
  expect(await textOf(page, '>>> #summary >>> p')).toContain('1 of 4 done')
})

test('an unknown url renders the not-found panel', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/nowhere`)
  await waitFor(page, 'h2')
  expect(await textOf(page, '>>> h2')).toContain('does not exist')
})

test('the stats area loads on demand', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/stats`)
  await waitFor(page, '#stat-total')
  expect(await textOf(page, '>>> #stat-total >>> p')).toEqual('4')
  expect(await textOf(page, '>>> #stat-done >>> p')).toEqual('1')

  await page.click('>>> a[href="/stats/priority/high"]')
  await waitFor(page, '#todo-t1')
})

test('switching the language re-localizes without a reload', async ({ page, baseUrl }) => {
  await page.goto(baseUrl)
  await waitFor(page, '#todo-t1')
  await page.select('>>> imp-select >>> select', 'pl')

  await page.waitForFunction(() => document.documentElement.lang === 'pl')
  expect(await textOf(page, '>>> #summary >>> p')).toContain('1 z 4 zrobione')
})

test('navigating moves focus into the main region', async ({ page }) => {
  expect(await page.evaluate(focusedInShell)).not.toEqual('main')

  await page.click('>>> a[href="/about"]')
  await waitFor(page, 'h2')
  expect(await page.evaluate(focusedInShell)).toEqual('main')
})
