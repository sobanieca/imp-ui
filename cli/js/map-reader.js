export const mapReader = ({ key }) => {
  const MAP = Symbol.for(key)
  const module = globalThis.__impMapModule

  const labelOf = (node) => {
    if (typeof node.label === 'string') return node.label
    if (typeof node.label === 'function') {
      try {
        return String(node.label({ params: {}, option: undefined }))
      } catch {
        return node.defaultLabel
      }
    }
    return node.defaultLabel
  }

  const notesOf = (node) => ({
    access: node.access === undefined ? null : JSON.stringify(node.access),
    hidden: node.nav === false,
    group: node.group ?? null,
  })

  const rows = (node, depth, into) => {
    for (const child of node.children) {
      into.push({
        depth,
        location: child.pattern,
        label: labelOf(child),
        ...notesOf(child),
        description: child.description ?? '',
      })
      rows(child, depth + 1, into)
    }
    return into
  }

  const maps = Object.entries(module)
    .filter(([, value]) => value?.[MAP] !== undefined)
    .map(([name, value]) => {
      const internals = value[MAP]
      return {
        name,
        props: { ...notesOf(internals.props), description: internals.props.description ?? null },
        grafted: internals.graftedInto !== null,
        patterns: internals.nodes.map((node) => node.pattern),
        rows: rows(internals.root, 1, []),
      }
    })
  return JSON.stringify(maps)
}
