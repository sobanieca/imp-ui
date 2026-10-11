export const add = (a, b) => a + b

export const greet = (name) => {
  if (!name) throw new Error('name required')
  return `hello ${name}`
}
