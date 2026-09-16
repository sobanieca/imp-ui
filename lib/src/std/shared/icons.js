const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const svgNode = (tag, attributes) => {
  const node = document.createElementNS(SVG_NAMESPACE, tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  return node
}

const iconRoot = (className) =>
  svgNode('svg', {
    class: className,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true',
  })

const stroke = { stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }

export const menuIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  for (const y of ['6', '12', '18']) {
    icon.append(svgNode('path', { d: `M4 ${y}h16`, ...stroke }))
  }
  return icon
}

export const closeIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  icon.append(svgNode('path', { d: 'M6 6l12 12M18 6L6 18', ...stroke }))
  return icon
}

export const moreIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  for (const cx of ['5', '12', '19']) {
    icon.append(svgNode('circle', { cx, cy: '12', r: '1.75', fill: 'currentColor' }))
  }
  return icon
}

export const chevronIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  icon.append(svgNode('path', { d: 'M9 6l6 6-6 6', ...stroke }))
  return icon
}

export const chevronDownIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  icon.append(svgNode('path', { d: 'M6 9l6 6 6-6', ...stroke }))
  return icon
}

export const pinIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  icon.append(
    svgNode('path', {
      d: 'M9 3h6v3l-1 1v4l3 3v2H7v-2l3-3V7L9 6z',
      ...stroke,
      'stroke-linejoin': 'round',
    }),
  )
  icon.append(svgNode('path', { d: 'M12 16v5', ...stroke }))
  return icon
}
