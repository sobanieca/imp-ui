import { form, imageUpload, resetButton, submitButton } from 'imp/std/inputs'
import { flex } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Image upload'
export const group = groups.inputs

const STORED = `data:image/svg+xml,${
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#3b6fe0"/><circle cx="120" cy="30" r="14" fill="#f4d06f"/><path d="M0 90l50-45 40 30 30-20 40 35z" fill="#1d3f8f"/></svg>',
  )
}`

const profileForm = () => {
  let picture = null
  return form(
    {
      initialValues: { avatar: undefined },
      onSubmit: (values) => {
        const body = new FormData()
        if (picture) body.append('avatar', picture)
        console.log(values.avatar?.slice(0, 40), picture)
      },
    },
    imageUpload({
      field: 'avatar',
      label: 'Profile picture',
      help: 'A square picture, up to 256 pixels',
      shape: 'circle',
      maxWidth: 256,
      maxHeight: 256,
      required: true,
      onImage: (file) => {
        picture = file
      },
    }),
    flex({ gap: 2 }, submitButton('Save'), resetButton('Start over')),
  )
}

export const avatar = {
  scenario: 'Circle, 1:1',
  component: imageUpload({
    value: undefined,
    label: 'Profile picture',
    shape: 'circle',
    maxWidth: 256,
    maxHeight: 256,
  }),
}

export const banner = {
  scenario: 'Rectangle, 16:9',
  component: imageUpload({
    value: undefined,
    label: 'Cover image',
    aspect: 16 / 9,
    maxWidth: 1600,
    maxHeight: 900,
    maxSize: 10_000_000,
    previewSize: '16rem',
  }),
}

export const free = {
  scenario: 'The ratio of the picture',
  component: imageUpload({
    value: undefined,
    label: 'Photo',
    help: 'Resized to fit 1920 by 1920 pixels',
  }),
}

export const inForm = {
  scenario: 'In a form with validation',
  component: profileForm(),
}

export const stored = {
  scenario: 'With a stored picture',
  component: imageUpload({ value: STORED, label: 'Cover image', aspect: 16 / 9, previewSize: 240 }),
}

export const disabled = {
  scenario: 'Disabled',
  component: imageUpload({ value: undefined, label: 'Photo', disabled: true }),
}
