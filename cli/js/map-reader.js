export const mapReader = ({ key }) => {
  const MAP = Symbol.for(key)
  const module = globalThis.__impMapModule

  const rows = (node, depth, into) => {
    for (const child of node.children) {
      into.push({
        depth,
        location: child.pattern,
        label: child.defaultLabel,
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
        description: internals.props.description ?? null,
        grafted: internals.graftedInto !== null,
        patterns: internals.nodes.map((node) => node.pattern),
        rows:
          Object.keys(internals.props).length > 0
            ? rows(internals.root, 1, [])
            : rows(internals.root, 2, [
                { depth: 1, location: '/', label: internals.root.defaultLabel, description: '' },
              ]),
      }
    })
  return JSON.stringify(maps)
}
