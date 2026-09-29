import { parse } from './vendor/parse5.js'

const URL_ATTRIBUTES = new Set(['href', 'src', 'poster'])

const SRCSET_ATTRIBUTES = new Set(['srcset', 'imagesrcset'])

const URL_META_NAMES = new Set([
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'twitter:image',
])

const SCRIPT_URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction'])

export const isJavaScriptType = (type) => !type || type === 'module' || type === 'text/javascript'

export const isModuleType = (type) => type === 'module'

export const isLocalScriptSource = (src) =>
  !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//')

const childrenOf = (node) => node?.childNodes ?? []

function* elementsOf(node, inTemplate = false) {
  for (const child of childrenOf(node)) {
    if (!child.tagName) continue
    yield { element: child, inTemplate }
    yield* elementsOf(child.content ?? child, inTemplate || child.tagName === 'template')
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

function srcsetCandidates(text) {
  const candidates = []
  let index = 0
  while (index < text.length) {
    while (index < text.length && /[\s,]/.test(text[index])) index++
    const start = index
    while (index < text.length && !/\s/.test(text[index])) index++
    const url = text.slice(start, index)
    if (!url) break
    const trimmed = url.replace(/,+$/, '')
    candidates.push({ start, value: trimmed })
    if (trimmed !== url) continue
    let depth = 0
    while (index < text.length) {
      const char = text[index++]
      if (char === '(') depth++
      else if (char === ')') depth--
      else if (char === ',' && depth <= 0) break
    }
  }
  return candidates
}

const metaUrlName = (element) => {
  const attributes = attributesOf(element)
  const name = (attributes.get('property') ?? attributes.get('name') ?? '').toLowerCase()
  return URL_META_NAMES.has(name)
}

const holdsUrl = (element, name) =>
  URL_ATTRIBUTES.has(name) || (name === 'content' && element.tagName === 'meta' &&
    metaUrlName(element))

function urlAttributesOf(source, element) {
  const found = []
  const locations = element.sourceCodeLocation?.startTag?.attrs ?? {}
  for (const { name, value } of element.attrs) {
    const lowerName = name.toLowerCase()
    const isSrcset = SRCSET_ATTRIBUTES.has(lowerName)
    if (!isSrcset && !holdsUrl(element, lowerName)) continue
    const location = locations[name]
    const range = location ? valueRange(source, location) : null
    if (!range) continue
    if (!isSrcset) {
      found.push({ name, value, ...range })
      continue
    }
    for (const candidate of srcsetCandidates(source.slice(range.start, range.end))) {
      const start = range.start + candidate.start
      found.push({ name, value: candidate.value, start, end: start + candidate.value.length })
    }
  }
  return found
}

const lineOfLocation = (location) => location?.startLine ?? 1

function inlineCodeOf(element) {
  const location = element.sourceCodeLocation
  const attributeLocations = location?.startTag?.attrs ?? {}
  const found = []
  const add = (line, construct, advice) => found.push({ line, construct, advice })
  if (element.tagName === 'style') {
    add(lineOfLocation(location), 'a <style> element', 'move the CSS into a file in public/')
  }
  if (element.tagName === 'script') {
    const attributes = attributesOf(element)
    const type = attributes.get('type')?.toLowerCase()
    const text = childrenOf(element).map((child) => child.value ?? '').join('')
    if (!attributes.has('src') && isJavaScriptType(type) && !isModuleType(type) && text.trim()) {
      add(lineOfLocation(location), 'an inline classic <script>', 'move the code into a module')
    }
  }
  for (const { name, value } of element.attrs) {
    const lowerName = name.toLowerCase()
    const line = lineOfLocation(attributeLocations[name] ?? location)
    if (lowerName.startsWith('on') && lowerName.length > 2) {
      add(line, `an inline event handler ${lowerName}=`, 'add the listener in a module')
    } else if (lowerName === 'style') {
      add(line, 'a style attribute', 'move the style into a CSS file in public/')
    } else if (SCRIPT_URL_ATTRIBUTES.has(lowerName) && /^\s*javascript:/i.test(value)) {
      add(line, `a javascript: URL in ${lowerName}=`, 'handle the event in a module')
    }
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
  const inlineCode = []
  let title = null
  for (const { element, inTemplate } of elementsOf(document)) {
    const location = element.sourceCodeLocation
    if (!location) continue
    inlineCode.push(...inlineCodeOf(element))
    const urls = urlAttributesOf(source, element)
    if (element.tagName === 'script' && !inTemplate) {
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
    inlineCode,
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
