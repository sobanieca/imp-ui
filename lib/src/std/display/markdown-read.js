import { el } from '../../api/html.js'
import { isSafeImage, isSafeLink } from '../shared/links.js'

const FENCE = /^```(.*)$/

const HEADING = /^(#{1,6}) (.*)$/

const QUOTE = /^> ?(.*)$/

const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/

const BULLET = /^[-*+](?: .*|$)/

const NUMBER = /^(\d{1,9})[.)](?: .*|$)/

const INDENT = /^( *)(.*)$/

const ALIGNED_OPEN = /^<(p|h[1-6]|div) align="(left|center|right)">(.*)$/

const ALIGNED_CLOSE = /<\/(?:p|h[1-6]|div)>$/

const HARD_BREAK = /(?:\\| {2,})$/

const PUNCTUATION = /[!-/:-@[-`{-~]/

const INLINE_TAGS = ['b', 'strong', 'i', 'em', 's', 'del', 'strike', 'code', 'a', 'img', 'br']

const WORD = /\w/

const MESSAGE_LINK_REL = 'noopener noreferrer nofollow ugc'

const isBlank = (line) => line.trim() === ''

const startsBlock = (line) =>
  FENCE.test(line)
  || HEADING.test(line)
  || QUOTE.test(line)
  || RULE.test(line)
  || BULLET.test(line)
  || NUMBER.test(line)
  || ALIGNED_OPEN.test(line)

const closingIndex = (text, from, marker) => {
  let index = from
  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2
      continue
    }
    if (text.startsWith(marker, index) && index > from) return index
    index += 1
  }
  return -1
}

const codeSpanEnd = (text, from, ticks) => {
  let index = from
  while (index < text.length) {
    if (text.startsWith(ticks, index) && text[index + ticks.length] !== '`') return index
    index += 1
  }
  return -1
}

const addressEnd = (text, from) => {
  let depth = 0
  let index = from
  while (index < text.length) {
    const char = text[index]
    if (char === '\\') index += 1
    else if (char === '(') depth += 1
    else if (char === ')') {
      if (depth === 0) return index
      depth -= 1
    }
    index += 1
  }
  return -1
}

const linkParts = (text, from) => {
  const close = closingIndex(text, from, ']')
  if (close === -1 || text[close + 1] !== '(') return null
  const end = addressEnd(text, close + 2)
  if (end === -1) return null
  return { label: text.slice(from, close), url: text.slice(close + 2, end), end: end + 1 }
}

const unescaped = (text) => text.replace(/\\([!-/:-@[-`{-~])/g, '$1')

const pushText = (nodes, text) => {
  if (text === '') return
  const last = nodes.at(-1)
  if (last instanceof Text) last.data += text
  else nodes.push(document.createTextNode(text))
}

const linkNode = (url, label, message) =>
  message
    ? el('a', { href: url, target: '_blank', rel: MESSAGE_LINK_REL, title: url }, ...label)
    : el('a', { href: url }, ...label)

const inlineNodes = (text, message = false) => {
  const nodes = []
  let plain = ''
  let index = 0
  const flush = () => {
    pushText(nodes, unescaped(plain))
    plain = ''
  }
  const wrap = (tag, marker, from) => {
    if (/\s/.test(text[from] ?? ' ')) return false
    if (marker.startsWith('_') && WORD.test(text[from - marker.length - 1] ?? ' ')) return false
    const close = closingIndex(text, from, marker)
    if (close === -1 || close === from) return false
    flush()
    nodes.push(el(tag, ...inlineNodes(text.slice(from, close), message)))
    index = close + marker.length
    return true
  }
  while (index < text.length) {
    const char = text[index]
    if (char === '\\' && index + 1 < text.length && PUNCTUATION.test(text[index + 1])) {
      plain += text.slice(index, index + 2)
      index += 2
      continue
    }
    if (char === '`' && !message) {
      const ticks = /^`+/.exec(text.slice(index))[0]
      const close = codeSpanEnd(text, index + ticks.length, ticks)
      if (close !== -1) {
        flush()
        nodes.push(el('code', text.slice(index + ticks.length, close).trim()))
        index = close + ticks.length
        continue
      }
    }
    if (text.startsWith('**', index) && wrap('strong', '**', index + 2)) continue
    if (text.startsWith('__', index) && wrap('strong', '__', index + 2)) continue
    if (text.startsWith('~~', index) && wrap('s', '~~', index + 2)) continue
    if ((char === '*' || char === '_') && wrap('em', char, index + 1)) continue
    if (text.startsWith('![', index) && !message) {
      const image = linkParts(text, index + 2)
      if (image) {
        flush()
        if (isSafeImage(image.url)) {
          nodes.push(el('img', { src: image.url, alt: unescaped(image.label) }))
        } else pushText(nodes, unescaped(image.label))
        index = image.end
        continue
      }
    }
    if (char === '[') {
      const link = linkParts(text, index + 1)
      if (link) {
        flush()
        const label = inlineNodes(link.label, message)
        if (isSafeLink(link.url)) nodes.push(linkNode(link.url, label, message))
        else nodes.push(...label)
        index = link.end
        continue
      }
    }
    plain += char
    index += 1
  }
  flush()
  return nodes
}

const paragraphNodes = (lines) => {
  const nodes = []
  lines.forEach((line, position) => {
    const hard = HARD_BREAK.test(line)
    const text = line.replace(HARD_BREAK, '')
    nodes.push(...inlineNodes(position === 0 ? text : text.trimStart()))
    if (position === lines.length - 1) return
    if (hard) nodes.push(el('br'))
    else pushText(nodes, ' ')
  })
  return nodes
}

const copyInline = (source) => {
  const nodes = []
  for (const child of source.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      pushText(nodes, child.data)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const tag = child.localName
    if (!INLINE_TAGS.includes(tag)) {
      nodes.push(...copyInline(child))
      continue
    }
    if (tag === 'br') {
      nodes.push(el('br'))
    } else if (tag === 'img') {
      const src = child.getAttribute('src')
      if (isSafeImage(src)) nodes.push(el('img', { src, alt: child.getAttribute('alt') ?? '' }))
    } else if (tag === 'a') {
      const href = child.getAttribute('href') ?? ''
      if (isSafeLink(href)) nodes.push(el('a', { href }, ...copyInline(child)))
      else nodes.push(...copyInline(child))
    } else {
      nodes.push(el(tag, ...copyInline(child)))
    }
  }
  return nodes
}

const alignedBlock = (tag, align, html) => {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const block = el(tag, ...copyInline(parsed.body))
  block.style.textAlign = align
  return block
}

const listMarker = (line) => {
  if (BULLET.test(line)) return { ordered: false, width: 2, start: 1 }
  const number = NUMBER.exec(line)
  if (number) return { ordered: true, width: number[1].length + 2, start: Number(number[1]) }
  return null
}

const stripIndent = (line, width) => {
  const [, spaces, rest] = INDENT.exec(line)
  return spaces.length >= width ? line.slice(width) : rest
}

const indentOf = (line) => INDENT.exec(line)[1].length

const continuesItem = (lines, index, width) => {
  if (index >= lines.length) return false
  if (!isBlank(lines[index])) return indentOf(lines[index]) >= width
  return (
    index + 1 < lines.length && !isBlank(lines[index + 1]) && indentOf(lines[index + 1]) >= width
  )
}

const listItem = (lines, from, width) => {
  const own = [lines[from].slice(width)]
  let index = from + 1
  while (continuesItem(lines, index, width)) {
    own.push(stripIndent(lines[index], width))
    index += 1
  }
  return { own, next: index }
}

const itemNodes = (blocks) => {
  const item = el('li')
  blocks.forEach((block, position) => {
    if (position === 0 && block.localName === 'p') item.append(...block.childNodes)
    else item.append(block)
  })
  return item
}

const listBlock = (lines, from) => {
  const first = listMarker(lines[from])
  const list = el(first.ordered ? 'ol' : 'ul')
  if (first.ordered && first.start !== 1) list.setAttribute('start', String(first.start))
  let index = from
  while (index < lines.length) {
    const marker = listMarker(lines[index])
    if (!marker || marker.ordered !== first.ordered) break
    const { own, next } = listItem(lines, index, marker.width)
    list.append(itemNodes(blockNodes(own)))
    index = next
  }
  return { list, next: index }
}

const fenceBlock = (lines, from) => {
  const language = FENCE.exec(lines[from])[1].trim()
  const body = []
  let index = from + 1
  while (index < lines.length && !FENCE.test(lines[index])) {
    body.push(lines[index])
    index += 1
  }
  const block = el('pre', body.join('\n'))
  if (language !== '') block.dataset.language = language
  return { block, next: Math.min(lines.length, index + 1) }
}

const quoteBlock = (lines, from) => {
  const inner = []
  let index = from
  while (index < lines.length && QUOTE.test(lines[index])) {
    inner.push(QUOTE.exec(lines[index])[1])
    index += 1
  }
  return { block: el('blockquote', ...blockNodes(inner)), next: index }
}

const alignedBlockAt = (lines, from) => {
  const [, tag, align, rest] = ALIGNED_OPEN.exec(lines[from])
  const inner = [rest]
  let index = from + 1
  while (!ALIGNED_CLOSE.test(inner.at(-1)) && index < lines.length && !isBlank(lines[index])) {
    inner.push(lines[index])
    index += 1
  }
  const html = inner.join('\n').replace(ALIGNED_CLOSE, '')
  return { block: alignedBlock(tag, align, html), next: index }
}

const paragraphBlock = (lines, from) => {
  const own = [lines[from]]
  let index = from + 1
  while (index < lines.length && !isBlank(lines[index]) && !startsBlock(lines[index])) {
    own.push(lines[index])
    index += 1
  }
  return { block: el('p', ...paragraphNodes(own)), next: index }
}

const blockNodes = (lines) => {
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (isBlank(line)) {
      index += 1
      continue
    }
    if (FENCE.test(line)) {
      const { block, next } = fenceBlock(lines, index)
      blocks.push(block)
      index = next
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push(el(`h${heading[1].length}`, ...inlineNodes(heading[2].trim())))
      index += 1
      continue
    }
    if (RULE.test(line)) {
      blocks.push(el('hr'))
      index += 1
      continue
    }
    if (QUOTE.test(line)) {
      const { block, next } = quoteBlock(lines, index)
      blocks.push(block)
      index = next
      continue
    }
    if (listMarker(line)) {
      const { list, next } = listBlock(lines, index)
      blocks.push(list)
      index = next
      continue
    }
    if (ALIGNED_OPEN.test(line)) {
      const { block, next } = alignedBlockAt(lines, index)
      blocks.push(block)
      index = next
      continue
    }
    const { block, next } = paragraphBlock(lines, index)
    blocks.push(block)
    index = next
  }
  return blocks
}

// A message knows only paragraphs, line breaks, bold, italic, strikethrough and links. Every other
// construct stays as its text, and every line break of the source is a line break.
const messageNodes = (lines) => {
  const blocks = []
  let own = []
  const flush = () => {
    if (own.length === 0) return
    const nodes = []
    own.forEach((line, position) => {
      if (position > 0) nodes.push(el('br'))
      nodes.push(...inlineNodes(line.trim().replace(HARD_BREAK, ''), true))
    })
    blocks.push(el('p', ...nodes))
    own = []
  }
  for (const line of lines) {
    if (isBlank(line)) flush()
    else own.push(line)
  }
  flush()
  return blocks
}

export const MARKDOWN_FORMATS = ['document', 'message']

export const markdownToNodes = (markdown, { format = 'document' } = {}) => {
  const lines = String(markdown ?? '').split(/\r?\n/)
  return format === 'message' ? messageNodes(lines) : blockNodes(lines)
}
