import { codeBlock, markdown } from 'imp/std/display'
import { form, richTextEditor } from 'imp/std/inputs'
import { stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { component } from 'imp'
import { groups } from '../preview-groups.js'

export const name = 'Rich text editor'
export const group = groups.inputs

const post = [
  '# Release notes',
  '',
  'This release adds a **rich text editor**. Its value is _markdown_, so it fits any store.',
  '',
  '- Bold, italic and ~~strikethrough~~',
  '- Lists, quotes and `code`',
  '  - Nested items too',
  '',
  '> Paste an image, and it lands here, resized and embedded.',
  '',
  '<p align="center">See the <a href="https://imp.dev">docs</a> for more.</p>',
].join('\n')

export const basic = {
  scenario: 'In a form',
  component: form(
    { initialValues: { post } },
    richTextEditor({ field: 'post', label: 'Post', rows: 8 }),
  ),
}

const mirrored = component('preview-rich-text-editor-live', {
  setup: (self) => {
    const body = initState(self, 'preview.richTextEditor.body', post)
    return stack(
      { gap: 3 },
      richTextEditor({ value: body, label: 'Edit', rows: 6 }),
      codeBlock({ code: body, language: 'md', label: 'Markdown' }),
    )
  },
})

export const live = {
  scenario: 'Bound to a state, shown as markdown',
  component: mirrored(),
}

const messaged = component('preview-rich-text-editor-message', {
  setup: (self) => {
    const comment = initState(
      self,
      'preview.richTextEditor.comment',
      'Ship it on **Friday** - see [pricing](https://imp.dev/pricing).',
    )
    return stack(
      { gap: 3 },
      richTextEditor({ value: comment, ariaLabel: 'Comment', rows: 2, format: 'message' }),
      markdown({ text: comment, format: 'message' }),
    )
  },
})

export const message = {
  scenario: 'A comment, in the message format',
  component: messaged(),
}

export const chosenTools = {
  scenario: 'A toolbar with chosen tools, in their order',
  component: form(
    { initialValues: { reply: 'Looks good :)' } },
    richTextEditor({
      field: 'reply',
      label: 'Reply',
      rows: 2,
      format: 'message',
      tools: ['bold', 'italic', 'strike', 'link', 'emoji'],
    }),
  ),
}

export const empty = {
  scenario: 'Empty, with a placeholder',
  component: form(
    { initialValues: { note: '' } },
    richTextEditor({
      field: 'note',
      label: 'Note',
      rows: 4,
      placeholder: 'Write a note...',
      help: 'Paste an image to embed it.',
    }),
  ),
}

export const readOnly = {
  scenario: 'Read only',
  component: form(
    { initialValues: { post } },
    richTextEditor({ field: 'post', label: 'Post', rows: 4, readonly: true }),
  ),
}

export const disabled = {
  scenario: 'Disabled',
  component: form(
    { initialValues: { post } },
    richTextEditor({ field: 'post', label: 'Post', rows: 4, disabled: true }),
  ),
}
