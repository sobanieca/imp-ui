export const resolveValue = (value, toCssValue) =>
  value === undefined || value === null ? null : toCssValue(value)

export const applyValues = (element, entries) => {
  for (const [variable, cssValue] of entries) {
    if (cssValue !== null) element.style.setProperty(`--${variable}`, cssValue)
  }
  return element
}

export const declarationStyles = (selector, declarations, defaultsSelector = selector) => {
  const defaults = declarations
    .map(({ variable, fallback }) => `--${variable}: ${fallback};`)
    .join(' ')
  const block = declarations
    .map(({ property, variable, fallback }) => `${property}: var(--${variable}, ${fallback});`)
    .join(' ')
  return [`${defaultsSelector} { ${defaults} }`, `${selector} { ${block} }`].join('\n\n  ')
}
