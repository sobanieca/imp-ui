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

export const searchIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  icon.append(
    svgNode('circle', { cx: '11', cy: '11', r: '7', ...stroke }),
    svgNode('path', { d: 'M16.5 16.5 21 21', ...stroke }),
  )
  return icon
}

export const chevronIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  icon.append(svgNode('path', { d: 'M9 5l7 7-7 7', ...stroke, 'stroke-linejoin': 'round' }))
  return icon
}

export const menuIcon = (className = 'icon') => {
  const icon = iconRoot(className)
  for (const y of ['6', '12', '18']) {
    icon.append(svgNode('path', { d: `M4 ${y}h16`, ...stroke }))
  }
  return icon
}
