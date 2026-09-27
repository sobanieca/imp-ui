import { init } from 'imp'
import { lang, setLang, t } from 'imp/i18n'
import { beforeAll, expect, test } from 'imp/test'
import en from '../locales/en.js'
import pl from '../locales/pl.js'
import statsEn from '../src/stats/locales/en.js'
import statsPl from '../src/stats/locales/pl.js'

const keysOf = (messages, prefix = '') =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`)
  )

const appKeys = (messages) => keysOf(messages).filter((key) => !key.startsWith('imp.'))

beforeAll(() =>
  init({
    lang: 'en',
    translations: { en: () => import('../locales/en.js'), pl: () => import('../locales/pl.js') },
  })
)

test('Polish carries every key of the app that English carries', () => {
  expect(appKeys(pl)).toEqual(appKeys(en))
})

test('the stats area carries the same keys in both languages', () => {
  expect(keysOf(statsPl)).toEqual(keysOf(statsEn))
})

test('a switch of language changes the text and the lang attribute', async () => {
  expect(t('todos.title')).toEqual('Todos')
  await setLang('pl')
  expect(t('todos.title')).toEqual('Zadania')
  expect(lang.get()).toEqual('pl')
  expect(document.documentElement.lang).toEqual('pl')
  await setLang('en')
})

test('a placeholder is filled from the values', () => {
  expect(t('todos.progress', { done: 2, total: 5 })).toEqual('2 of 5 done')
})
