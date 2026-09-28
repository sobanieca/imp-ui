import { env } from 'imp'
import { batch, onAnalytics } from 'imp/analytics'

const postRecords = (records) =>
  fetch(`${env.API_URL}/analytics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(records),
    keepalive: true,
  })

export const sendAnalytics = () => onAnalytics(batch(postRecords))
