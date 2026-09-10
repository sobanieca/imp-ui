import { form, textArea } from 'imp/std/inputs'
import { groups } from '../preview-groups.js'

export const name = 'Text area'
export const group = groups.inputs

const wrap = (...fields) => form({ initialValues: { note: '' } }, ...fields)

export const basic = {
  scenario: 'Basic',
  component: wrap(textArea({ field: 'note', label: 'Notes' })),
}
export const tall = {
  scenario: 'Tall',
  component: wrap(textArea({ field: 'note', label: 'Notes', rows: 8 })),
}
export const counted = {
  scenario: 'Counted',
  component: wrap(
    textArea({ field: 'note', label: 'Notes', maxLength: 500, help: 'Up to 500 characters' }),
  ),
}
