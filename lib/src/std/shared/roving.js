export const isRightToLeft = (element) => getComputedStyle(element).direction === 'rtl'

export const inlineStep = (key, element) => {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return 0
  return (key === 'ArrowRight') !== isRightToLeft(element) ? 1 : -1
}

export const blockStep = (key) => {
  if (key === 'ArrowDown') return 1
  if (key === 'ArrowUp') return -1
  return 0
}

const stepOf = (key, orientation, element) => {
  if (orientation === 'vertical') return blockStep(key)
  if (orientation === 'horizontal') return inlineStep(key, element)
  return inlineStep(key, element) || blockStep(key)
}

export const rovingMove = (key, { orientation = 'horizontal', element, edges = true } = {}) => {
  const step = stepOf(key, orientation, element)
  if (step !== 0) return { step }
  if (!edges) return null
  if (key === 'Home') return { edge: 1 }
  if (key === 'End') return { edge: -1 }
  return null
}

const nextUsable = (entries, from, direction, usable, { wrap = true } = {}) => {
  const count = entries.length
  let cursor = from
  for (let attempt = 0; attempt < count; attempt++) {
    cursor += direction
    if (wrap) cursor = (cursor + count) % count
    else if (cursor < 0 || cursor >= count) return null
    if (usable(entries[cursor])) return entries[cursor]
  }
  return null
}

const edgeUsable = (entries, direction, usable) =>
  (direction === 1 ? entries : [...entries].reverse()).find(usable) ?? null

export const rovingPick = (move, entries, from, usable = () => true, options) =>
  move.edge !== undefined
    ? edgeUsable(entries, move.edge, usable)
    : nextUsable(entries, from, move.step, usable, options)

const restOn = (nodes, target) => {
  for (const node of nodes) node.tabIndex = node === target ? 0 : -1
}

export const focusRoving = (nodes, target) => {
  if (!target) return
  restOn(nodes, target)
  target.focus()
}
