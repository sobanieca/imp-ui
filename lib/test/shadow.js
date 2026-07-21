export const settled = () => new Promise((resolve) => setTimeout(resolve))

export const renderedText = (node) => {
  if (node.nodeType === Node.TEXT_NODE) return node.data
  const scope = node.shadowRoot ?? node
  return [...scope.childNodes].map(renderedText).join('')
}
