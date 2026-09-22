import { component } from 'imp'
import { luRocket } from 'imp/icons'
import { button } from 'imp/std'
import { notify, toast } from 'imp/std/feedback'
import { flex } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Toast'
export const group = groups.feedback
export const description = `
  An app mounts \`toast()\` once, as the first child of the content of \`shell\`.

  This page mounts every scenario at once, and a hidden panel cannot show a region. So the file
  puts its one region on the document body, and each scenario only calls \`notify\`.
`

const picture = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%237c9cff"/><circle cx="12" cy="9" r="4" fill="white"/><path d="M4 22a8 8 0 0116 0z" fill="white"/></svg>',
  )

const corner = { region: null, stages: 0 }

const leaveStage = () => {
  corner.stages -= 1
  if (corner.stages > 0) return
  corner.region.remove()
  corner.region = null
}

const stage = component('toast-preview-stage', {
  setup: (self, ...content) => {
    corner.stages += 1
    corner.region ??= document.body.appendChild(toast())
    self.abortSignal.addEventListener('abort', leaveStage, { once: true })
    return flex({ gap: 2, wrap: true }, ...content)
  },
})

const raise = (label, data) => button({ events: { click: () => notify(data) } }, label)

const upload = async () => {
  for (const percent of [10, 35, 60, 85]) {
    notify({ id: 'upload', title: 'Uploading report.pdf', description: `${percent}%`, duration: 0 })
    await new Promise((resolve) => setTimeout(resolve, 900))
  }
  notify({ id: 'upload', kind: 'success', title: 'Uploaded report.pdf' })
}

const askAboutInvoice = async () => {
  const choice = await notify({
    kind: 'warning',
    title: 'Invoice 1042 is overdue',
    description: 'The payment was due three days ago.',
    link: { href: '#invoice-1042', label: 'Open the invoice' },
    actions: [
      { id: 'remind', label: 'Send a reminder', variant: 'primary' },
      { id: 'ignore', label: 'Ignore' },
    ],
    duration: 0,
  })
  console.log('invoice 1042:', choice)
}

export const eachKind = {
  scenario: 'Each kind',
  component: stage(
    raise('Info', { title: 'A new version is ready' }),
    raise('Success', { kind: 'success', title: 'Report sent' }),
    raise('Warning', { kind: 'warning', title: 'The disk is almost full' }),
    raise('Error', { kind: 'error', title: 'The server did not answer' }),
  ),
}

export const aLongOne = {
  scenario: 'A long one',
  component: stage(
    raise('Raise a long notification', {
      kind: 'info',
      title: 'The quarterly revenue report for the European region finished its export',
      description:
        'The export holds 48,210 rows in 14 sheets. It includes every invoice from the first of July to the end of September, the credit notes, and the corrections that the finance team made last week.',
      duration: 10_000,
    }),
  ),
}

export const withAnImage = {
  scenario: 'With an image',
  component: stage(
    raise('From a person', {
      title: 'Ada Lovelace mentioned you',
      description: 'Can you check the numbers on page 3?',
      image: picture,
    }),
    raise('With its own icon', { title: 'Release 2.4 is live', icon: luRocket }),
  ),
}

export const withActions = {
  scenario: 'With actions',
  component: stage(
    button({ events: { click: askAboutInvoice } }, 'Ask about an invoice'),
  ),
}

export const progressInPlace = {
  scenario: 'Progress in place',
  component: stage(button({ events: { click: upload } }, 'Upload a file')),
}

export const aPlainToast = {
  scenario: 'A plain toast',
  component: stage(
    raise('Never listed', { kind: 'success', title: 'Copied', ttl: 0, duration: 2000 }),
  ),
}
