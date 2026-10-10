import { defineComponent } from '../shared/define.js'
import { focusRoving, rovingMove, rovingPick } from '../shared/roving.js'
import { div, el, input, p } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import {
  BINDING_PROPS,
  CONTROL_ID,
  createShell,
  LABEL_ID,
  SHELL_PROPS,
  shellStyles,
  VALIDATION_PROPS,
} from './shell.js'
import { icon } from '../general/icon.js'
import { attachTooltip, tooltipStyles } from '../display/tooltip.js'
import { anchoredStyles } from '../shared/anchored.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'
import {
  luBold,
  luCode,
  luFaceSlightlySmiling,
  luHeading1,
  luHeading2,
  luHeading3,
  luImage,
  luItalic,
  luLink,
  luList,
  luListOrdered,
  luSquareCode,
  luStrikethrough,
  luTextAlignCenter,
  luTextAlignEnd,
  luTextAlignStart,
  luTextQuote,
} from '../../icons/lucide-icons.js'
import { markdownToNodes } from '../display/markdown-read.js'
import { isSafeLink } from '../shared/links.js'
import { markdownViewStyles } from '../display/markdown-view.js'
import {
  alignmentOf,
  codeBlockText,
  createMarkdownWriter,
  escapeHtml,
  nodesToMarkdown,
} from './markdown-write.js'
import { embedImage, IMAGE_ACCEPT, isHeifFile, isImageFile } from './image-tools.js'
import { createEmojiPanel, EMOJI_PANEL_MESSAGES, emojiPanelStyles } from '../shared/emoji-panel.js'
import { closeOnTabOut } from '../shared/tab-out.js'

const NAME = 'richTextEditor'

const KEYS_ID = 'keys'

const LINK_PANEL_ID = 'link-panel'

const LINK_ADDRESS_ID = 'link-address'

const EMOJI_PANEL_ID = 'emoji-panel'

const keyOf = (name) => `imp.richTextEditor.${name}`

const messages = {
  [keyOf('toolbar')]: 'Formatting',
  [keyOf('bold')]: 'Bold',
  [keyOf('italic')]: 'Italic',
  [keyOf('strike')]: 'Strikethrough',
  [keyOf('code')]: 'Code',
  [keyOf('heading1')]: 'Heading 1',
  [keyOf('heading2')]: 'Heading 2',
  [keyOf('heading3')]: 'Heading 3',
  [keyOf('quote')]: 'Quote',
  [keyOf('codeBlock')]: 'Code block',
  [keyOf('bullets')]: 'Bulleted list',
  [keyOf('numbers')]: 'Numbered list',
  [keyOf('link')]: 'Link',
  [keyOf('image')]: 'Image',
  [keyOf('emoji')]: 'Emoji',
  [keyOf('alignStart')]: 'Align start',
  [keyOf('alignCenter')]: 'Align center',
  [keyOf('alignEnd')]: 'Align end',
  [keyOf('linkAddress')]: 'Link address',
  [keyOf('linkApply')]: 'Apply link',
  [keyOf('linkRemove')]: 'Remove link',
  [keyOf('imageAdding')]: 'Adding image...',
  [keyOf('imageFailed')]: 'The image could not be added',
  [keyOf('heifFailed')]:
    'This browser cannot open the HEIC photo {name}. Save it as a JPEG and add it again.',
  [keyOf('keys')]: 'Tab indents a list item. Press Escape, then Tab, to leave the editor.',
}

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  ...VALIDATION_PROPS,
  'rows',
  'imageSize',
  'placeholder',
  'readonly',
]

const DEFAULT_ROWS = 6

const DEFAULT_IMAGE_SIZE = 1280

const ICON_SIZE = '1.25rem'

const CARET_LANDING = '\u200b'

const TEXT_BLOCKS = 'p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre'

const TOOL_GROUPS = [
  [
    { id: 'bold', icon: luBold },
    { id: 'italic', icon: luItalic },
    { id: 'strike', icon: luStrikethrough },
    { id: 'code', icon: luCode },
  ],
  [
    { id: 'heading1', icon: luHeading1 },
    { id: 'heading2', icon: luHeading2 },
    { id: 'heading3', icon: luHeading3 },
    { id: 'quote', icon: luTextQuote },
    { id: 'codeBlock', icon: luSquareCode },
  ],
  [
    { id: 'bullets', icon: luList },
    { id: 'numbers', icon: luListOrdered },
  ],
  [
    { id: 'link', icon: luLink, opens: LINK_PANEL_ID },
    { id: 'image', icon: luImage },
    { id: 'emoji', icon: luFaceSlightlySmiling, opens: EMOJI_PANEL_ID },
  ],
  [
    { id: 'alignStart', icon: luTextAlignStart, flips: true },
    { id: 'alignCenter', icon: luTextAlignCenter },
    { id: 'alignEnd', icon: luTextAlignEnd, flips: true },
  ],
]

const HEADINGS = { heading1: 'h1', heading2: 'h2', heading3: 'h3' }

const ALIGNMENTS = { alignStart: 'start', alignCenter: 'center', alignEnd: 'end' }

const JUSTIFY = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }

const styles = () => `
${shellStyles()}
${tooltipStyles()}
${emojiPanelStyles()}

  .editor {
    display: flex;
    flex-direction: column;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    transition: border-color ${token('duration-fast')} ease-out;
  }

  .editor:has(.area:focus-visible) {
    ${focusRing()}
  }

  .editor.disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .editor:has(.area[aria-invalid='true']) {
    border-color: ${token('color-danger')};
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: ${token('space-2')};
    padding: ${token('space-1')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    border-start-start-radius: inherit;
    border-start-end-radius: inherit;
    background-color: ${token('color-surface-sunken')};
  }

  .group {
    display: flex;
    gap: 2px;
  }

  .tool,
  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    border: ${token('border-width')} solid transparent;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-text')};
    ${fontFamily()}
    cursor: pointer;
    transition:
      background-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  .tool {
    padding: ${token('space-1')};
  }

  .tool:hover:not(:disabled),
  .action:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .tool:focus-visible,
  .action:focus-visible,
  .address:focus-visible {
    ${focusRing()}
  }

  .tool[aria-pressed='true'] {
    background-color: ${token('color-surface')};
    border-color: ${token('color-primary')};
    color: ${token('color-primary')};
  }

  .tool:disabled {
    cursor: not-allowed;
  }

  .tool.flips:dir(rtl) svg {
    scale: -1 1;
  }

  .area {
    position: relative;
    box-sizing: border-box;
    min-block-size: calc(var(--rows) * ${token('line-height-normal')} * 1em + 2 * ${
  token('space-2')
});
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    outline: none;
    ${fontFamily()}
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .area[aria-disabled='true'] {
    cursor: not-allowed;
  }

  .area[data-empty]::before {
    content: attr(data-placeholder);
    position: absolute;
    inset-block-start: ${token('space-2')};
    inset-inline-start: ${token('space-3')};
    color: ${token('color-secondary')};
    pointer-events: none;
  }

${markdownViewStyles('.area')}

  img[data-pending] {
    opacity: 0.5;
    cursor: progress;
  }

  img[data-pending].failed {
    color: ${token('color-danger')};
    font-size: ${token('font-size-sm')};
    opacity: 1;
  }

  ${
  anchoredStyles({
    trigger: '.tool-link',
    panel: '.panel-link',
    placement: 'block-end',
    align: 'start',
    anchor: '--imp-rich-text-link',
  })
}

  ${
  anchoredStyles({
    trigger: '.tool-emoji',
    panel: '.panel-emoji',
    placement: 'block-end',
    align: 'start',
    anchor: '--imp-rich-text-emoji',
  })
}

  .panel {
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .panel-link {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    min-inline-size: 18rem;
  }

  .panel-label {
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
  }

  .address {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  .address[aria-invalid='true'] {
    border-color: ${token('color-danger')};
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: ${token('space-2')};
  }

  .action {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')};
    border-color: ${token('color-border')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
  }

  .action.primary {
    border-color: transparent;
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
  }

  .keys {${visuallyHidden}}

  @media (prefers-reduced-motion: reduce) {
    .editor, .tool, .action { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .editor, .toolbar, .panel, .address { border-color: ButtonBorder }
    .editor:has(.area:focus-visible) { outline-color: Highlight }
    .tool[aria-pressed='true'] {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
  }
`

const asText = (value) => (value === undefined || value === null ? '' : String(value))

const positiveInteger = (prop, value, fallback) => {
  if (value === undefined) return fallback
  if (Number.isInteger(value) && value > 0) return value
  impLogger.warn(
    `${NAME}: '${prop}' must be a positive integer - got '${value}', using ${fallback}`,
  )
  return fallback
}

const nameOf = (file) => file.name.replace(/\.[^.]+$/, '')

const physicalOf = (alignment, rightToLeft) => {
  if (alignment === 'center') return 'center'
  const atStart = alignment === 'start'
  return atStart === rightToLeft ? 'right' : 'left'
}

const elementOf = (node) => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)

const run = (command, value) => document.execCommand(command, false, value)

const htmlOf = (nodes) => {
  const holder = document.createElement('div')
  holder.append(...nodes)
  return holder.innerHTML
}

const UNSHOWN = 'head, script, style, template, noscript, title, meta, link'

const representable = (html, rightToLeft) => {
  const { body } = new DOMParser().parseFromString(html, 'text/html')
  for (const node of body.querySelectorAll(UNSHOWN)) node.remove()
  return htmlOf(markdownToNodes(nodesToMarkdown(body, { rightToLeft })))
}

const createSelection = (self, area) => {
  let saved = null

  const current = () => {
    const selection = getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const [range] = selection.getComposedRanges({ shadowRoots: [self.host.shadowRoot] })
    if (!range || !area.contains(range.startContainer) || !area.contains(range.endContainer)) {
      return null
    }
    return range
  }

  const remember = () => {
    const range = current()
    if (range) saved = range
    return range
  }

  const restore = () => {
    area.focus()
    if (!saved || !area.contains(saved.startContainer) || !area.contains(saved.endContainer)) {
      getSelection().setBaseAndExtent(area, area.childNodes.length, area, area.childNodes.length)
      return
    }
    getSelection().setBaseAndExtent(
      saved.startContainer,
      saved.startOffset,
      saved.endContainer,
      saved.endOffset,
    )
  }

  const closest = (selector) => {
    const range = saved
    if (!range || !range.startContainer.isConnected) return null
    const found = elementOf(range.startContainer)?.closest(selector)
    return found && area.contains(found) && found !== area ? found : null
  }

  const select = (node) => {
    const parent = node.parentNode
    const index = [...parent.childNodes].indexOf(node)
    getSelection().setBaseAndExtent(parent, index, parent, index + 1)
  }

  const isCollapsed = () =>
    !saved || (saved.startContainer === saved.endContainer && saved.startOffset === saved.endOffset)

  return { remember, restore, closest, select, isCollapsed }
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass 'label' and 'help' instead of children`)
    }
    const imageSize = positiveInteger('imageSize', props.imageSize, DEFAULT_IMAGE_SIZE)
    const binding = createFieldBinding(NAME, props, { self })
    const readonly = Boolean(props.readonly)
    let disabled = false
    let released = false
    let shown = null

    const area = div({
      id: CONTROL_ID,
      class: 'area',
      role: 'textbox',
      'aria-multiline': 'true',
      ...(props.label === undefined ? {} : { 'aria-labelledby': LABEL_ID }),
      ...(props.placeholder === undefined ? {} : { 'data-placeholder': props.placeholder }),
      ...(readonly ? { 'aria-readonly': 'true' } : {}),
    })
    const selection = createSelection(self, area)
    const isRightToLeft = () => getComputedStyle(area).direction === 'rtl'

    const writer = createMarkdownWriter(area)
    stopOnRemove(self, writer.stop)

    const commit = () => {
      const markdown = writer.write(isRightToLeft())
      shown = markdown
      area.toggleAttribute('data-empty', markdown === '')
      binding.commit(markdown)
    }

    const render = (markdown) => {
      if (markdown === shown) return
      shown = markdown
      const nodes = markdownToNodes(markdown)
      area.replaceChildren(...(nodes.length === 0 ? [p(el('br'))] : nodes))
      area.toggleAttribute('data-empty', markdown.trim() === '')
    }

    const tools = new Map()

    const paintTools = () => {
      const block = selection.closest(TEXT_BLOCKS)
      const alignment = block === null ? 'start' : alignmentOf(block, isRightToLeft())
      const list = selection.closest('ul, ol')
      const pressed = {
        bold: selection.closest('b, strong') !== null,
        italic: selection.closest('i, em') !== null,
        strike: selection.closest('s, del, strike') !== null,
        code: selection.closest('code') !== null,
        heading1: selection.closest('h1') !== null,
        heading2: selection.closest('h2') !== null,
        heading3: selection.closest('h3') !== null,
        quote: selection.closest('blockquote') !== null,
        codeBlock: selection.closest('pre') !== null,
        bullets: list?.localName === 'ul',
        numbers: list?.localName === 'ol',
        link: selection.closest('a') !== null,
        alignStart: alignment === 'start',
        alignCenter: alignment === 'center',
        alignEnd: alignment === 'end',
      }
      for (const [id, button] of tools) {
        if (id in pressed) button.setAttribute('aria-pressed', String(pressed[id]))
      }
    }

    const toggleCode = () => {
      const code = selection.closest('code')
      if (code) {
        selection.select(code)
        run('removeFormat')
        return
      }
      if (selection.isCollapsed()) return
      run('insertHTML', `<code>${escapeHtml(getSelection().toString())}</code>`)
    }

    const leaveCodeBlock = (block) => {
      const lines = codeBlockText(block).replace(/\n$/, '').split('\n')
      getSelection().setBaseAndExtent(block, 0, block, block.childNodes.length)
      run('formatBlock', 'p')
      if (lines.length === 1) return
      run('insertHTML', htmlOf(lines.map((line) => p(line === '' ? el('br') : line))))
    }

    const justify = (alignment) => run(JUSTIFY[physicalOf(alignment, isRightToLeft())])

    const commands = {
      bold: () => run('bold'),
      italic: () => run('italic'),
      strike: () => run('strikeThrough'),
      code: toggleCode,
      quote: () => {
        if (selection.closest('blockquote')) run('outdent')
        else run('formatBlock', 'blockquote')
      },
      codeBlock: () => {
        const block = selection.closest('pre')
        if (block) leaveCodeBlock(block)
        else run('formatBlock', 'pre')
      },
      bullets: () => run('insertUnorderedList'),
      numbers: () => run('insertOrderedList'),
      image: () => fileInput.click(),
    }
    for (const [id, tag] of Object.entries(HEADINGS)) {
      commands[id] = () => run('formatBlock', selection.closest(tag) ? 'p' : tag)
    }
    for (const [id, alignment] of Object.entries(ALIGNMENTS)) {
      commands[id] = () => justify(alignment)
    }

    const apply = (id) => {
      if (id === 'image') return commands.image()
      selection.restore()
      commands[id]()
      selection.remember()
      commit()
      paintTools()
    }

    const insertPending = (preview) => {
      selection.restore()
      const pending = el('img', { src: preview, alt: t(keyOf('imageAdding')), 'data-pending': '' })
      run('insertHTML', `${htmlOf([pending])}${CARET_LANDING}`)
      selection.remember()
      return [...area.querySelectorAll('img')].find((image) =>
        image.getAttribute('src') === preview
      )
    }

    const addImage = (file) => {
      const preview = URL.createObjectURL(file)
      const image = insertPending(preview)
      if (image === undefined) {
        URL.revokeObjectURL(preview)
        return
      }
      embedImage(file, imageSize).then(
        ({ src }) => {
          URL.revokeObjectURL(preview)
          image.src = src
          image.alt = nameOf(file)
          image.removeAttribute('data-pending')
          if (image.isConnected) commit()
        },
        (error) => {
          impLogger.error(`${NAME}: the image '${file.name}' could not be added`, error)
          URL.revokeObjectURL(preview)
          image.removeAttribute('src')
          image.alt = isHeifFile(file)
            ? t(keyOf('heifFailed'), { name: file.name })
            : t(keyOf('imageFailed'))
          image.classList.add('failed')
        },
      )
    }

    const addImages = (files) => {
      const images = [...files].filter(isImageFile)
      if (images.length === 0) return false
      for (const file of images) addImage(file)
      return true
    }

    const fileInput = input({
      type: 'file',
      accept: IMAGE_ACCEPT,
      multiple: true,
      hidden: true,
      tabindex: '-1',
      'aria-hidden': 'true',
      events: {
        change: () => {
          addImages(fileInput.files)
          fileInput.value = ''
        },
      },
    })

    const address = input({
      id: LINK_ADDRESS_ID,
      class: 'address',
      type: 'url',
      placeholder: 'https://',
      autocomplete: 'off',
    })
    const applyLink = el('button', { type: 'button', class: ['action', 'primary'] })
    const removeLink = el('button', { type: 'button', class: 'action' })
    const linkPanel = div(
      { id: LINK_PANEL_ID, class: ['panel', 'panel-link'], popover: 'auto' },
      el('label', { class: 'panel-label', for: LINK_ADDRESS_ID }),
      address,
      div({ class: 'actions' }, removeLink, applyLink),
    )
    const linkAt = () => selection.closest('a')

    const submitLink = () => {
      const url = address.value.trim()
      if (url === '' || !isSafeLink(url)) {
        address.setAttribute('aria-invalid', 'true')
        address.focus()
        return
      }
      const link = linkAt()
      linkPanel.hidePopover()
      selection.restore()
      if (link) selection.select(link)
      if (!link && selection.isCollapsed()) {
        run('insertHTML', `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
      } else run('createLink', url)
      selection.remember()
      commit()
      paintTools()
    }

    const unlink = () => {
      const link = linkAt()
      linkPanel.hidePopover()
      selection.restore()
      if (link) selection.select(link)
      run('unlink')
      selection.remember()
      commit()
      paintTools()
    }

    applyLink.addEventListener('click', submitLink)
    removeLink.addEventListener('click', unlink)
    address.addEventListener('input', () => address.removeAttribute('aria-invalid'))
    address.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      submitLink()
    })
    linkPanel.addEventListener('toggle', (event) => {
      if (event.newState !== 'open') return
      const link = linkAt()
      address.value = link?.getAttribute('href') ?? ''
      address.removeAttribute('aria-invalid')
      removeLink.hidden = link === null
      address.focus()
      address.select()
    })

    const emojiPicker = createEmojiPanel({
      self,
      name: NAME,
      onPick: (emoji) => {
        emojiPanel.hidePopover()
        selection.restore()
        run('insertText', emoji)
        selection.remember()
        commit()
      },
    })
    const emojiPanel = div(
      { id: EMOJI_PANEL_ID, class: 'panel-emoji', popover: 'auto', role: 'dialog' },
      emojiPicker.root,
    )
    emojiPanel.addEventListener('beforetoggle', (event) => {
      if (event.newState === 'open') emojiPicker.reset()
    })
    emojiPanel.addEventListener('toggle', (event) => {
      if (event.newState === 'open') emojiPicker.focusStart()
    })

    const panels = { [LINK_PANEL_ID]: linkPanel, [EMOJI_PANEL_ID]: emojiPanel }
    for (const panel of Object.values(panels)) closeOnTabOut(panel)

    const toolButtons = []
    const tips = []
    const groups = TOOL_GROUPS.map((group) =>
      div(
        { class: 'group' },
        ...group.map((tool) => {
          const button = el(
            'button',
            {
              type: 'button',
              class: ['tool', `tool-${tool.id}`, tool.flips && 'flips'],
              tabindex: toolButtons.length === 0 ? '0' : '-1',
              ...(tool.opens ? { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' } : {}),
            },
            icon({ icon: tool.icon, size: ICON_SIZE }),
          )
          button.addEventListener('mousedown', (event) => event.preventDefault())
          button.addEventListener('click', () => {
            if (tool.opens) {
              selection.remember()
              panels[tool.opens].togglePopover()
            } else apply(tool.id)
          })
          if (tool.opens) {
            panels[tool.opens].addEventListener('toggle', (event) => {
              button.setAttribute('aria-expanded', String(event.newState === 'open'))
            })
          }
          tools.set(tool.id, button)
          toolButtons.push(button)
          tips.push(attachTooltip(self, button, lang.text(() => t(keyOf(tool.id)))))
          return button
        }),
      )
    )

    const toolbar = div(
      { class: 'toolbar', role: 'toolbar', 'aria-controls': CONTROL_ID, hidden: readonly },
      ...groups,
    )
    toolbar.addEventListener('keydown', (event) => {
      const index = toolButtons.indexOf(event.target)
      if (index === -1) return
      const move = rovingMove(event.key, { element: toolbar })
      if (move === null) return
      focusRoving(toolButtons, rovingPick(move, toolButtons, index))
      event.preventDefault()
    })

    area.addEventListener('focus', () => run('defaultParagraphSeparator', 'p'))
    area.addEventListener('input', commit)
    area.addEventListener('blur', () => {
      binding.leave()
      binding.check()
    })
    area.addEventListener('keydown', (event) => {
      if (disabled || readonly) return
      if (event.key === 'Escape') {
        released = true
        return
      }
      if (event.key === 'Tab') {
        const plain = !event.ctrlKey && !event.altKey && !event.metaKey
        const handled = !released && plain && selection.remember() !== null &&
          selection.closest('li') !== null
        released = false
        if (!handled) return
        event.preventDefault()
        run(event.shiftKey ? 'outdent' : 'indent')
        selection.remember()
        commit()
        paintTools()
        return
      }
      released = false
    })
    area.addEventListener('paste', (event) => {
      if (disabled || readonly) return
      selection.remember()
      if (addImages(event.clipboardData.files)) {
        event.preventDefault()
        return
      }
      const html = event.clipboardData.getData('text/html')
      if (html === '') return
      event.preventDefault()
      if (selection.closest('pre')) run('insertText', event.clipboardData.getData('text/plain'))
      else run('insertHTML', representable(html, isRightToLeft()))
    })
    area.addEventListener('dragover', (event) => {
      if ([...event.dataTransfer.types].includes('Files')) event.preventDefault()
    })
    area.addEventListener('drop', (event) => {
      if (![...event.dataTransfer.types].includes('Files')) return
      event.preventDefault()
      if (!disabled && !readonly) addImages(event.dataTransfer.files)
    })
    document.addEventListener(
      'selectionchange',
      () => {
        if (selection.remember() !== null) paintTools()
      },
      { signal: self.abortSignal },
    )

    const keys = p({ class: 'keys', id: KEYS_ID })
    lang.watch(self, () => {
      keys.textContent = t(keyOf('keys'))
      toolbar.setAttribute('aria-label', t(keyOf('toolbar')))
      emojiPanel.setAttribute('aria-label', t(keyOf('emoji')))
      linkPanel.querySelector('label').textContent = t(keyOf('linkAddress'))
      applyLink.textContent = t(keyOf('linkApply'))
      removeLink.textContent = t(keyOf('linkRemove'))
      for (const [id, button] of tools) button.setAttribute('aria-label', t(keyOf(id)))
    })

    const editor = div(
      { class: 'editor' },
      toolbar,
      area,
      keys,
      fileInput,
      linkPanel,
      emojiPanel,
      ...tips,
    )

    const applyStates = () => {
      const editable = !disabled && !readonly
      area.setAttribute('contenteditable', editable ? 'true' : 'false')
      area.setAttribute('aria-disabled', String(disabled))
      editor.classList.toggle('disabled', disabled)
      for (const button of toolButtons) button.disabled = disabled
      if (disabled) {
        for (const panel of Object.values(panels)) {
          if (panel.matches(':popover-open')) panel.hidePopover()
        }
      }
    }

    bindValue(self, props.rows, (value) => {
      area.style.setProperty('--rows', String(positiveInteger('rows', value, DEFAULT_ROWS)))
    })
    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      applyStates()
    })
    stopOnRemove(self, binding.watch((value) => render(asText(value))))

    const shell = createShell(self, props, area, {
      presented: editor,
      describedBy: readonly ? [] : [KEYS_ID],
    })
    shell.attach(binding)
    shell.root.querySelector('label')?.addEventListener('click', () => area.focus())
    return shell.root
  },
}

export const richTextEditor = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages({ ...FORM_MESSAGES, ...EMOJI_PANEL_MESSAGES, ...messages }),
  )(...args)
