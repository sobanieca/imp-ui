export const toggle = (flag) => (!!flag ? 'on' : 'off')

// imp-lint-ignore no-extra-boolean-cast
export const keep = (flag) => (!!flag ? 'y' : 'n')

export const Widget = () => toggle(true)
