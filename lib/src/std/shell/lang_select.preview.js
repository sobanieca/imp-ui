import { langSelect } from 'imp/std/shell'

export const name = 'LangSelect'
export const category = 'Shell'
export const description =
  "Run 'imp skill std/langSelect' to learn what langSelect can do before using it."

export const codesNamedInTheirOwnLanguage = langSelect({
  remember: false,
  languages: ['en', 'pl', 'de', 'pt-BR'],
})

export const ownLabels = langSelect({
  remember: false,
  languages: [{ value: 'en', label: 'English' }, { value: 'pl', label: 'Polish' }],
})

export const named = langSelect({
  remember: false,
  languages: ['en', 'pl'],
  label: 'Interface language',
})

export const noLanguagesWarns = langSelect({ remember: false })
