import { fileUpload, form, resetForm, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { flex } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'File upload'
export const group = groups.inputs

const uploadOnSubmit = () => {
  let chosen = []
  return form(
    {
      initialValues: { title: '', attachments: [] },
      onSubmit: (values) => {
        const body = new FormData()
        for (const file of chosen) body.append('attachments', file)
        console.log(values, [...body.getAll('attachments')])
      },
    },
    fileUpload({
      field: 'attachments',
      label: 'Attachments',
      help: 'Add at least one file',
      multiple: true,
      required: true,
      accept: 'image/*,.pdf',
      maxSize: 5_000_000,
      onFiles: (files) => {
        chosen = files
      },
    }),
    flex(
      { gap: 2 },
      button({ variant: 'primary', events: { click: submitForm } }, 'Send'),
      button({ events: { click: resetForm } }, 'Start over'),
    ),
  )
}

export const single = {
  scenario: 'Single file',
  component: fileUpload({ value: [], label: 'Avatar', accept: 'image/*', maxSize: 2_000_000 }),
}

export const multiple = {
  scenario: 'Multiple files',
  component: fileUpload({ value: [], label: 'Attachments', multiple: true }),
}

export const withStoredFiles = {
  scenario: 'With stored files',
  component: fileUpload({
    value: [
      { id: 'stored-1', name: 'contract-2026.pdf', size: 482_113, type: 'application/pdf' },
      {
        id: 'stored-2',
        name: 'a-very-long-file-name-for-the-floor-plan-of-the-second-office-building.png',
        size: 3_204_551,
        type: 'image/png',
      },
    ],
    label: 'Documents',
    multiple: true,
    accept: '.pdf,image/*',
  }),
}

export const inForm = {
  scenario: 'In a form with validation',
  component: uploadOnSubmit(),
}

export const disabled = {
  scenario: 'Disabled',
  component: fileUpload({
    value: [{ id: 'stored-1', name: 'report.pdf', size: 120_400, type: 'application/pdf' }],
    label: 'Report',
    disabled: true,
  }),
}
