import { comboBox, form, submitButton } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Combo box'
export const group = groups.inputs

const COUNTRIES = [
  { value: 'at', label: 'Austria' },
  { value: 'be', label: 'Belgium' },
  { value: 'cz', label: 'Czechia' },
  { value: 'dk', label: 'Denmark' },
  { value: 'fi', label: 'Finland' },
  { value: 'fr', label: 'France' },
  { value: 'de', label: 'Germany' },
  { value: 'gr', label: 'Greece' },
  { value: 'ie', label: 'Ireland' },
  { value: 'it', label: 'Italy' },
  { value: 'nl', label: 'Netherlands' },
  { value: 'no', label: 'Norway' },
  { value: 'pl', label: 'Poland' },
  { value: 'pt', label: 'Portugal' },
  { value: 'es', label: 'Spain' },
  { value: 'se', label: 'Sweden' },
  { value: 'ch', label: 'Switzerland' },
  { value: 'gb', label: 'United Kingdom' },
]

const SKILLS = [
  { value: 'js', label: 'JavaScript' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'a11y', label: 'Accessibility' },
  { value: 'sql', label: 'SQL' },
  { value: 'cobol', label: 'COBOL (no open roles)', disabled: true },
]

const PEOPLE = [
  { value: 'u1', label: 'Ada Lovelace' },
  { value: 'u2', label: 'Alan Turing' },
  { value: 'u3', label: 'Grace Hopper' },
  { value: 'u4', label: 'Katherine Johnson' },
  { value: 'u5', label: 'Margaret Hamilton' },
]

const findPeople = (text) =>
  new Promise((resolve) => {
    setTimeout(
      () =>
        resolve(
          PEOPLE.filter(({ label }) => label.toLowerCase().includes(text.toLowerCase())),
        ),
      700,
    )
  })

export const single = {
  scenario: 'Single',
  component: comboBox({
    value: 'pl',
    label: 'Country',
    placeholder: 'Type a country',
    options: COUNTRIES,
  }),
}

export const multiple = {
  scenario: 'Multiple',
  component: comboBox({
    value: ['js', 'css'],
    label: 'Skills',
    multiple: true,
    options: SKILLS,
  }),
}

export const customSingle = {
  scenario: 'Custom text',
  component: comboBox({
    value: 'Remote',
    label: 'Office',
    help: 'Choose an office, or type another place',
    custom: true,
    options: ['Warsaw', 'Lisbon', 'Berlin'],
  }),
}

export const tagInput = {
  scenario: 'Tag input',
  component: comboBox({
    value: ['bug', 'ui'],
    label: 'Labels',
    help: 'Press Enter or type a comma after each label',
    multiple: true,
    custom: true,
  }),
}

export const remote = {
  scenario: 'Remote search',
  component: comboBox({
    value: 'u3',
    label: 'Assignee',
    placeholder: 'Search people',
    options: PEOPLE.slice(2, 3),
    onSearch: findPeople,
  }),
}

export const inForm = {
  scenario: 'In a form with validation',
  component: form(
    {
      initialValues: { country: undefined, skills: [] },
      onSubmit: (values) => console.log(values),
    },
    comboBox({ field: 'country', label: 'Country', options: COUNTRIES, required: true }),
    comboBox({
      field: 'skills',
      label: 'Skills',
      multiple: true,
      options: SKILLS,
      validate: (skills) => ((skills ?? []).length < 2 ? 'Choose at least two skills' : null),
    }),
    submitButton('Save'),
  ),
}

export const disabled = {
  scenario: 'Disabled',
  component: comboBox({
    value: ['js', 'a11y'],
    label: 'Skills',
    multiple: true,
    options: SKILLS,
    disabled: true,
  }),
}
