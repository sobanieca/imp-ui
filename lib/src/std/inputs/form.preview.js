import { component } from 'imp'
import { form, resetForm, select, submitForm, textField } from 'imp/std/inputs'
import { button } from 'imp/std'
import { div } from 'imp/html'
import { computed, useState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Form'
export const group = groups.inputs

const fields = () => [
  textField({ field: 'user.firstName', label: 'First name', required: true }),
  textField({ field: 'user.email', label: 'Email', type: 'email', help: 'We never share it' }),
  select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
]

const values = { user: { firstName: 'Ada', email: 'ada@example.com' }, plan: 'pro' }

export const vertical = {
  scenario: 'Vertical',
  component: form(
    { initialValues: values, onSubmit: (submitted) => console.log(submitted) },
    ...fields(),
    div(
      { style: 'display: flex; flex-direction: row; gap: var(--imp-space-2, 8px)' },
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
      button({ events: { click: resetForm } }, 'Start over'),
    ),
  ),
}
export const horizontal = {
  scenario: 'Horizontal',
  component: form({ initialValues: values, layout: 'horizontal' }, ...fields()),
}
export const inline = {
  scenario: 'Inline',
  component: form(
    { initialValues: { term: '' }, layout: 'inline' },
    textField({ field: 'term', label: 'Search' }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Go'),
  ),
}
export const empty = {
  scenario: 'Empty',
  component: form(
    { initialValues: { name: '' } },
    textField({ field: 'name', label: 'Name', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  ),
}

const saveWhenChanged = component('preview-save-when-changed', {
  setup: (self) =>
    button({
      variant: 'primary',
      disabled: computed([useState(self, 'imp.form.dirty')], (dirty) => !dirty),
      events: { click: submitForm },
    }, 'Save changes'),
})

export const failedSave = {
  scenario: 'Failed save',
  component: form(
    {
      initialValues: { name: 'Ada' },
      onSubmit: () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('The server did not answer - try again')), 600)
        ),
    },
    textField({ field: 'name', label: 'Name', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  ),
}

export const saveWhenDirty = {
  scenario: 'Save when changed',
  component: form(
    { initialValues: { name: 'Ada' }, onSubmit: (submitted) => console.log(submitted) },
    textField({ field: 'name', label: 'Name', help: 'Change the name to enable Save' }),
    saveWhenChanged(),
  ),
}
