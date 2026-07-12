export const asNodes = (rendered) => {
  if (rendered === null || rendered === undefined || typeof rendered === 'boolean') return []
  if (Array.isArray(rendered)) return rendered.flatMap(asNodes)
  if (rendered instanceof Node) return [rendered]
  if (
    typeof rendered === 'string' || typeof rendered === 'number' || typeof rendered === 'bigint'
  ) {
    return [document.createTextNode(String(rendered))]
  }
  return []
}
