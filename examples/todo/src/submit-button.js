import { component } from 'imp'
import { useState } from 'imp/state'
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
