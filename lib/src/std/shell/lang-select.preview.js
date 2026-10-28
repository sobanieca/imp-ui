import { langSelect } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'LangSelect'
export const group = groups.shell

export const codesNamedInTheirOwnLanguage = {
  scenario: 'Codes named in their own language',
  component: langSelect({
    languages: ['en', 'pl', 'de', 'pt-BR'],
  }),
}

export const ownLabels = {
  scenario: 'Own labels',
  component: langSelect({
    languages: [
      { value: 'en', label: 'English' },
      { value: 'pl', label: 'Polish' },
    ],
  }),
}

export const named = {
  scenario: 'Named',
  component: langSelect({
    languages: ['en', 'pl'],
    label: 'Interface language',
  }),
}

export const noLanguagesWarns = {
  scenario: 'No languages warns',
  component: langSelect(),
}
