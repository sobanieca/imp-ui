import { appMap } from 'imp'

export const app = appMap({
  home: { path: '/' },
  invoices: { $id: {} },
  settings: { nav: false },
})
