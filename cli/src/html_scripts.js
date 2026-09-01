const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

const attributeValue = (attributes, name) =>
  attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']?([^"'\\s>]*)`, 'i'))?.[1]

export const isJavaScriptType = (type) => !type || type === 'module' || type === 'text/javascript'

export const isModuleType = (type) => type === 'module'

export const isLocalScriptSource = (src) =>
  !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//')

export const htmlScripts = (html) => {
  const scripts = []
  for (const match of html.matchAll(SCRIPT_TAG)) {
    const attributes = match[1]
    const src = /\bsrc\s*=/i.test(attributes) ? attributeValue(attributes, 'src') ?? '' : null
    const bodyStart = match.index + match[0].indexOf('>') + 1
    scripts.push({
      src,
      type: attributeValue(attributes, 'type')?.toLowerCase() ?? null,
      text: match[2],
      lineOffset: html.slice(0, bodyStart).split('\n').length - 1,
      start: bodyStart,
      end: bodyStart + match[2].length,
    })
  }
  return scripts
}
