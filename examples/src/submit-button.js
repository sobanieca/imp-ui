import { component } from 'imp'
import { computed, useState } from 'imp/state'
import { button } from 'imp/std'
import { submitForm } from 'imp/std/inputs'
import { tr } from './translate.js'

export const submitButton = component('todo-submit-button', {
  setup: (self, labelKey) =>
    button(
      {
        variant: 'primary',
        loading: useState(self, 'imp.form.submitting'),
        events: { click: submitForm },
      },
      tr(labelKey),
    ),
})

export const saveChangesButton = component('todo-save-changes-button', {
  setup: (self, labelKey) =>
    button(
      {
        variant: 'primary',
        loading: useState(self, 'imp.form.submitting'),
        disabled: computed([useState(self, 'imp.form.dirty')], (dirty) => !dirty),
        events: { click: submitForm },
      },
      tr(labelKey),
    ),
})
