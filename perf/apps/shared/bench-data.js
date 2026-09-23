export const makeRows = (count, firstId = 1) =>
  Array.from({ length: count }, (_, index) => ({
    id: firstId + index,
    label: `row ${firstId + index}`,
  }))

export const relabel = (item, version) => ({ id: item.id, label: `row ${item.id} v${version}` })

export const swapEnds = (items) => {
  const next = [...items]
  const last = next.length - 2
  ;[next[1], next[last]] = [next[last], next[1]]
  return next
}

export const withoutMiddle = (items) => items.filter((_, index) => index !== items.length >> 1)

export const settle = async () => {
  for (let turn = 0; turn < 4; turn++) await Promise.resolve()
}
