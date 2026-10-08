import { isSafeLink } from '../display/markdown-read.js'

const BLOCK_TAGS = [
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'pre',
  'hr',
  'li',
]

const HEADING = /^h([1-6])$/

const SPECIAL = /[\\*_`[\]~<]/g

const LINE_START = /^(?:#{1,6} |> |[-+] |\d{1,9}[.)] |-{3,}$)/

const HTML_SPECIAL = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

const isElement = (node) => node.nodeType === Node.ELEMENT_NODE

const isBlock = (node) => isElement(node) && BLOCK_TAGS.includes(node.localName)

const safeHref = (node) => {
  const href = node.getAttribute('href')
  return href !== null && isSafeLink(href) ? href : null
}

const isPending = (node) => isElement(node) && node.hasAttribute('data-pending')

const plainText = (data) =>
  data.replaceAll('\u00a0', ' ').replaceAll('\u200b', '').replaceAll('\n', ' ')

const escapeText = (data) => plainText(data).replace(SPECIAL, (char) => `\\${char}`)

export const escapeHtml = (data) => plainText(data).replace(/[&<>"]/g, (char) => HTML_SPECIAL[char])

const escapeLineStart = (text) => (LINE_START.test(text) ? `\\${text}` : text)

const spanStyle = (node) => {
  const { fontWeight, fontStyle, textDecoration } = node.style
  if (fontWeight === 'bold' || Number(fontWeight) >= 600) return 'strong'
  if (fontStyle === 'italic') return 'em'
  if (textDecoration.includes('line-through')) return 's'
  return null
}

const kindOf = (node) => {
  switch (node.localName) {
    case 'b':
    case 'strong':
      return 'strong'
    case 'i':
    case 'em':
      return 'em'
    case 's':
    case 'del':
    case 'strike':
      return 's'
    case 'code':
    case 'a':
    case 'img':
    case 'br':
      return node.localName
    case 'span':
      return spanStyle(node)
    default:
      return null
  }
}

const around = (inner, open, close = open) => {
  const trimmed = inner.trim()
  if (trimmed === '') return inner
  const lead = inner.slice(0, inner.length - inner.trimStart().length)
  const tail = inner.slice(inner.trimEnd().length)
  return `${lead}${open}${trimmed}${close}${tail}`
}

const codeSpan = (text) => {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length))
  const ticks = '`'.repeat(longest + 1)
  const padded = longest > 0 || text.startsWith('`') || text.endsWith('`') ? ` ${text} ` : text
  return `${ticks}${padded}${ticks}`
}

const inlineMarkdown = (node) => {
  let out = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeText(child.data)
      continue
    }
    if (!isElement(child) || isPending(child)) continue
    const kind = kindOf(child)
    if (kind === 'br') out += '\\\n'
    else if (kind === 'img') out += `![${escapeText(child.alt)}](${child.getAttribute('src')})`
    else if (kind === 'code') out += codeSpan(plainText(child.textContent))
    else if (kind === 'a' && safeHref(child) === null) out += inlineMarkdown(child)
    else if (kind === 'a') out += `[${inlineMarkdown(child)}](${safeHref(child)})`
    else if (kind === 'strong') out += around(inlineMarkdown(child), '**')
    else if (kind === 'em') out += around(inlineMarkdown(child), '_')
    else if (kind === 's') out += around(inlineMarkdown(child), '~~')
    else out += inlineMarkdown(child)
  }
  return out
}

const inlineHtml = (node) => {
  let out = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeHtml(child.data)
      continue
    }
    if (!isElement(child) || isPending(child)) continue
    const kind = kindOf(child)
    if (kind === 'br') out += '<br>'
    else if (kind === 'img') {
      out += `<img src="${escapeHtml(child.getAttribute('src'))}" alt="${escapeHtml(child.alt)}">`
    } else if (kind === 'a' && safeHref(child) === null) out += inlineHtml(child)
    else if (kind === 'a') {
      out += `<a href="${escapeHtml(safeHref(child))}">${inlineHtml(child)}</a>`
    } else if (kind === null) out += inlineHtml(child)
    else out += `<${kind}>${inlineHtml(child)}</${kind}>`
  }
  return out
}

const physicalAlignment = (node) => {
  const value = node.style.textAlign || node.getAttribute('align') || ''
  return value.toLowerCase()
}

export const alignmentOf = (node, rightToLeft) => {
  const physical = physicalAlignment(node)
  if (physical === 'center' || physical === 'end') return physical
  if (physical === 'left') return rightToLeft ? 'end' : 'start'
  if (physical === 'right') return rightToLeft ? 'start' : 'end'
  return 'start'
}

const alignedHtml = (node, tag, alignment, rightToLeft) => {
  const physical = alignment === 'center' ? 'center' : rightToLeft ? 'left' : 'right'
  return `<${tag} align="${physical}">${inlineHtml(node).trim()}</${tag}>`
}

const textBlock = (node, rightToLeft) => {
  const heading = HEADING.exec(node.localName)
  const tag = heading ? node.localName : 'p'
  const alignment = alignmentOf(node, rightToLeft)
  if (alignment !== 'start') {
    const html = alignedHtml(node, tag, alignment, rightToLeft)
    return html === `<${tag} align="center"></${tag}>` ? null : html
  }
  const text = inlineMarkdown(node).trim()
  if (text === '') return null
  return heading ? `${'#'.repeat(Number(heading[1]))} ${text}` : escapeLineStart(text)
}

export const codeBlockText = (node) => {
  let out = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) out += child.data.replaceAll('\u00a0', ' ')
    else if (child.localName === 'br') out += '\n'
    else if (isElement(child)) out += codeBlockText(child)
  }
  return out
}

const fenceBlock = (node) => {
  const text = codeBlockText(node).replace(/\n$/, '')
  const longest = Math.max(2, ...[...text.matchAll(/`{3,}/g)].map((run) => run[0].length))
  const fence = '`'.repeat(longest + 1)
  return `${fence}${node.dataset.language ?? ''}\n${text}\n${fence}`
}

const quoteBlock = (node, rightToLeft) =>
  blocks(node, rightToLeft)
    .join('\n\n')
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n')

const indented = (text, width) =>
  text.split('\n').map((line) => (line === '' ? '' : ' '.repeat(width) + line)).join('\n')

const listItem = (node, marker, rightToLeft) => {
  const [first = '', ...rest] = blocks(node, rightToLeft)
  const head = first === '' ? marker.trimEnd() : `${marker}${first}`
  return [head, ...rest.map((block) => indented(block, marker.length))].join('\n')
}

const listBlock = (node, rightToLeft) => {
  const ordered = node.localName === 'ol'
  let number = Number(node.getAttribute('start') ?? 1)
  const items = []
  for (const child of node.children) {
    if (child.localName === 'ul' || child.localName === 'ol') {
      const nested = listBlock(child, rightToLeft)
      if (items.length === 0) items.push(nested)
      else items[items.length - 1] += `\n${indented(nested, ordered ? 3 : 2)}`
      continue
    }
    if (child.localName !== 'li') continue
    const marker = ordered ? `${number}. ` : '- '
    number += 1
    items.push(listItem(child, marker, rightToLeft))
  }
  return items.join('\n')
}

const hasBlockChild = (node) => [...node.childNodes].some(isBlock)

const blockOf = (node, rightToLeft) => {
  const tag = node.localName
  if (tag === 'hr') return ['---']
  if (tag === 'pre') return [fenceBlock(node)]
  if (tag === 'blockquote') return [quoteBlock(node, rightToLeft)]
  if (tag === 'ul' || tag === 'ol') return [listBlock(node, rightToLeft)]
  if (hasBlockChild(node)) return blocks(node, rightToLeft)
  const text = textBlock(node, rightToLeft)
  return text === null ? [] : [text]
}

const blocks = (container, rightToLeft) => {
  const out = []
  const run = document.createElement('p')
  const flush = () => {
    if (run.childNodes.length === 0) return
    const text = textBlock(run, rightToLeft)
    if (text !== null) out.push(text)
    run.replaceChildren()
  }
  for (const child of [...container.childNodes]) {
    if (isBlock(child)) {
      flush()
      out.push(...blockOf(child, rightToLeft))
    } else if (isElement(child) && hasBlockChild(child)) {
      flush()
      out.push(...blocks(child, rightToLeft))
    } else {
      run.append(child.cloneNode(true))
    }
  }
  flush()
  return out
}

export const nodesToMarkdown = (container, { rightToLeft = false } = {}) =>
  blocks(container, rightToLeft).join('\n\n')
