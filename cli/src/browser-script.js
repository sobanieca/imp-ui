import { scriptSafeJson } from './environments.js'

export const browserScript = (run, input) => `(${run})(${scriptSafeJson(input)})\n`
