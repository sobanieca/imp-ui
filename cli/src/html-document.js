import { parse } from './vendor/parse5.js'

const URL_ATTRIBUTES = new Set(['href', 'src'])

export const isJavaScriptType = (type) => !type || type === 'module' || type === 'text/javascript'

export const isModuleType = (type) => type === 'module'

export const isLocalScriptSource = (src) =>
  !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//')

const childrenOf = (node) => node?.childNodes ?? []

function* elementsOf(node) {
  for (const child of childrenOf(node)) {
    if (!child.tagName) continue
    yield child
    yield* elementsOf(child.content ?? child)
  }
}

const attributesOf = (element) =>
  new Map(element.attrs.map(({ name, value }) => [name.toLowerCase(), value]))

const lineOf = (source, offset) => source.slice(0, offset).split('\n').length - 1

function contentRange(element) {
  const location = element.sourceCodeLocation
  const start = location.startTag.endOffset
  const end = location.endTag?.startOffset ?? location.endOffset
  return { start, end: Math.max(start, end) }
}

function scriptOf(source, element) {
  const attributes = attributesOf(element)
  const content = contentRange(element)
  return {
    attributes,
    src: attributes.has('src') ? attributes.get('src') : null,
    type: attributes.get('type')?.toLowerCase() ?? null,
    text: source.slice(content.start, content.end),
    start: content.start,
    end: content.end,
    lineOffset: lineOf(source, content.start),
    element: {
      start: element.sourceCodeLocation.startOffset,
      end: element.sourceCodeLocation.endOffset,
    },
  }
}

function valueRange(source, location) {
  const text = source.slice(location.startOffset, location.endOffset)
  const equals = text.indexOf('=')
  if (equals === -1) return null
  let start = equals + 1
  while (/\s/.test(text[start] ?? '')) start++
  let end = text.length
  if (text[start] === '"' || text[start] === "'") {
    start++
    end--
  }
  return { start: location.startOffset + start, end: location.startOffset + end }
}

function urlAttributesOf(source, element) {
  const found = []
  const locations = element.sourceCodeLocation?.startTag?.attrs ?? {}
  for (const { name, value } of element.attrs) {
    if (!URL_ATTRIBUTES.has(name.toLowerCase())) continue
    const location = locations[name]
    const range = location ? valueRange(source, location) : null
    if (range) found.push({ name, value, ...range })
  }
  return found
}

const topElements = (document) => {
  const html = childrenOf(document).find((node) => node.tagName === 'html')
  return {
    html,
    head: childrenOf(html).find((node) => node.tagName === 'head'),
    body: childrenOf(html).find((node) => node.tagName === 'body'),
  }
}

const isCharsetMeta = (node) =>
  node.tagName === 'meta' && node.attrs.some(({ name }) => name.toLowerCase() === 'charset')

function headInsertion(document, { html, head }) {
  const charset = childrenOf(head).find(isCharsetMeta)?.sourceCodeLocation
  if (charset) return { offset: charset.endOffset, wrap: (tags) => `\n${tags}` }
  const headTag = head?.sourceCodeLocation?.startTag
  if (headTag) return { offset: headTag.endOffset, wrap: (tags) => `\n${tags}` }
  const wrapped = (tags) => `\n<head>${tags}</head>`
  const htmlTag = html?.sourceCodeLocation?.startTag
  if (htmlTag) return { offset: htmlTag.endOffset, wrap: wrapped }
  const doctype = childrenOf(document).find((node) => node.nodeName === '#documentType')
  const doctypeEnd = doctype?.sourceCodeLocation?.endOffset
  if (doctypeEnd !== undefined) return { offset: doctypeEnd, wrap: wrapped }
  return { offset: 0, wrap: (tags) => `<head>${tags}</head>\n` }
}

const bodyEnd = (source, { body }) => body?.sourceCodeLocation?.endTag?.startOffset ?? source.length

export function readHtml(source) {
  const document = parse(source, { sourceCodeLocationInfo: true })
  const scripts = []
  const urlAttributes = []
  let title = null
  for (const element of elementsOf(document)) {
    const location = element.sourceCodeLocation
    if (!location) continue
    const urls = urlAttributesOf(source, element)
    if (element.tagName === 'script') {
      const srcAttribute = urls.find((attribute) => attribute.name.toLowerCase() === 'src') ?? null
      scripts.push({ ...scriptOf(source, element), srcAttribute })
    }
    if (element.tagName === 'title' && !title) {
      title = { start: location.startOffset, end: location.endOffset }
    }
    urlAttributes.push(...urls)
  }
  const top = topElements(document)
  return {
    source,
    scripts,
    urlAttributes,
    title,
    head: headInsertion(document, top),
    bodyEnd: bodyEnd(source, top),
  }
}

export function applyEdits(source, edits) {
  let result = source
  for (const edit of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
  }
  return result
}

export function headEdit(document, tags) {
  const { offset, wrap } = document.head
  return { start: offset, end: offset, text: wrap(tags) }
}
