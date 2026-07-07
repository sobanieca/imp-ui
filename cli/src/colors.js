const colorsDisabled = Deno.noColor || !Deno.stdout.isTerminal()

const wrap = (code) => (text) => colorsDisabled ? `${text}` : `\x1b[${code}m${text}\x1b[0m`

export const red = wrap(31)
export const green = wrap(32)
export const yellow = wrap(33)
export const blue = wrap(34)
export const magenta = wrap(35)
export const cyan = wrap(36)
export const bold = wrap(1)
export const dim = wrap(2)
