import { form, textArea } from 'imp/std/inputs'

export const name = 'Text area'
export const category = 'Inputs'
export const description =
  "Run 'imp skill std/textArea' to learn what textArea can do before using it."

const wrap = (...fields) => form({ initialValues: { note: '' } }, ...fields)

export const basic = wrap(textArea({ field: 'note', label: 'Notes' }))
export const tall = wrap(textArea({ field: 'note', label: 'Notes', rows: 8 }))
export const counted = wrap(
  textArea({ field: 'note', label: 'Notes', maxLength: 500, help: 'Up to 500 characters' }),
)
