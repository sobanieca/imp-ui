export const asNodes = (rendered) => {
  if (rendered === null || rendered === undefined || typeof rendered === 'boolean') return []
  if (Array.isArray(rendered)) return rendered.flatMap(asNodes)
  if (rendered instanceof DocumentFragment) return [...rendered.childNodes]
  if (rendered instanceof Node) return [rendered]
  if (
    typeof rendered === 'string' || typeof rendered === 'number' || typeof rendered === 'bigint'
  ) {
    return [document.createTextNode(String(rendered))]
  }
  return []
}

const pendingBindings = new WeakMap()

export const registerBinding = (node, activate) => {
  const activators = pendingBindings.get(node)
  if (activators) activators.push(activate)
  else pendingBindings.set(node, [activate])
}

export const hasPendingBinding = (nodes) => {
  for (const node of nodes) {
    if (pendingBindings.has(node)) return true
    if (node.childNodes.length && hasPendingBinding([...node.childNodes])) return true
  }
  return false
}

const activateNode = (scope, node) => {
  const activators = pendingBindings.get(node)
  if (activators) {
    pendingBindings.delete(node)
    for (const activate of activators) activate(scope)
    scope.addCleanup(() => {
      const registeredSince = pendingBindings.get(node) ?? []
      pendingBindings.set(node, [...activators, ...registeredSince])
    })
  }
  for (let child = node.firstChild; child; child = child.nextSibling) activateNode(scope, child)
}

export const activateBindings = (scope, nodes) => {
  for (const node of nodes) activateNode(scope, node)
}
