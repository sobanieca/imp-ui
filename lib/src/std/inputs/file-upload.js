import { defineComponent } from '../shared/define.js'
import { div, el, li, p, span, ul } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { luUpload, luX } from '../../icons/lucide-icons.js'
import { createFieldBinding } from './field.js'
import { acceptsFile, formatFileSize, readAccept } from './file-rules.js'
import { FORM_MESSAGES } from './form-state.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'

const NAME = 'fileUpload'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'multiple',
  'accept',
  'maxSize',
  'onFiles',
  'validate',
  'validateAsync',
]

const HINT_ID = 'hint'

const PROMPT_KEY = 'imp.fileUpload.prompt'

const ACCEPTS_KEY = 'imp.fileUpload.accepts'

const MAX_SIZE_KEY = 'imp.fileUpload.maxSize'

const REMOVE_KEY = 'imp.fileUpload.remove'

const TOO_LARGE_KEY = 'imp.fileUpload.tooLarge'

const WRONG_TYPE_KEY = 'imp.fileUpload.wrongType'

const REQUIRED_KEY = 'imp.form.required'

const messages = {
  [PROMPT_KEY]: 'Drop files here, or browse',
  [ACCEPTS_KEY]: 'Accepts {types}',
  [MAX_SIZE_KEY]: 'Up to {size} for each file',
  [REMOVE_KEY]: 'Remove {name}',
  [TOO_LARGE_KEY]: '{name} is larger than {size}',
  [WRONG_TYPE_KEY]: '{name} is not an accepted file type',
}

const styles = () => `
  ${shellStyles()}

  .upload {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    min-inline-size: 0;
    ${fontFamily()}
  }

  #${CONTROL_ID} {
    ${visuallyHidden}
  }

  .zone {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${token('space-1')};
    box-sizing: border-box;
    padding-block: ${token('space-5')};
    padding-inline: ${token('space-4')};
    border: ${token('border-width')} dashed ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    color: ${token('color-secondary')};
    text-align: center;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out;
  }

  .zone:hover,
  .zone.over {
    border-color: ${token('color-primary')};
    background-color: ${token('color-surface-hover')};
  }

  .zone.over {
    border-style: solid;
  }

  #${CONTROL_ID}:focus-visible + .zone {${focusRing()}}

  #${CONTROL_ID}[aria-invalid='true'] + .zone {
    border-color: ${token('color-danger')};
  }

  #${CONTROL_ID}:disabled + .zone {
    opacity: ${token('disabled-opacity')};
    border-color: ${token('color-border')};
    background-color: ${token('color-surface')};
  }

  .prompt {
    color: ${token('color-text')};
    font-size: ${token('font-size-md')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    cursor: pointer;
  }

  .prompt::after {
    content: '';
    position: absolute;
    inset: 0;
    cursor: pointer;
  }

  #${CONTROL_ID}:disabled + .zone .prompt,
  #${CONTROL_ID}:disabled + .zone .prompt::after {
    cursor: not-allowed;
  }

  .hint {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    column-gap: ${token('space-3')};
    margin: 0;
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  .files {
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .files[hidden] {
    display: none;
  }

  .file {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')} ${token('space-1')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .name {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    flex: none;
    color: ${token('color-secondary')};
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .zone { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .zone.over { border-color: Highlight }
  }
`

let created = 0

const nextId = () => `file-${Date.now().toString(36)}-${++created}`

const asEntries = (value) =>
  Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : []

const isEmpty = (value) => asEntries(value).length === 0

const sameFiles = (left, right) =>
  left.length === right.length && left.every((file, index) => file === right[index])

const readMaxSize = (maxSize) => {
  if (maxSize === undefined) return null
  if (Number.isFinite(maxSize) && maxSize > 0) return maxSize
  impLogger.warn(`${NAME}: 'maxSize' must be a number of bytes above 0 - ignoring it`)
  return null
}

const readValidate = (validate) => {
  if (validate === undefined) return null
  if (typeof validate === 'function') return validate
  impLogger.warn(
    `${NAME}: 'validate' must be a function returning a message or null - ignoring it`,
  )
  return null
}

const readOnFiles = (onFiles) => {
  if (onFiles === undefined) return null
  if (typeof onFiles === 'function') return onFiles
  impLogger.warn(`${NAME}: 'onFiles' must be a function that takes the File objects`)
  return null
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - the component draws the drop zone itself`)
    }
    const multiple = Boolean(props.multiple)
    const accept = readAccept(NAME, props.accept)
    const maxSize = readMaxSize(props.maxSize)
    const onFiles = readOnFiles(props.onFiles)
    const held = new Map()
    let handed = []
    let rejection = null
    let disabled = false

    const ownValidate = readValidate(props.validate)
    const binding = createFieldBinding(NAME, {
      ...props,
      required: undefined,
      validate: (value) => {
        if (rejection) return rejection
        if (props.required && isEmpty(value)) return { key: REQUIRED_KEY }
        return ownValidate ? ownValidate(value) : null
      },
    }, { self })

    const problemWith = (file) => {
      if (!acceptsFile(accept, file)) return { key: WRONG_TYPE_KEY, params: { name: file.name } }
      if (maxSize !== null && file.size > maxSize) {
        return {
          key: TOO_LARGE_KEY,
          params: { name: file.name, size: formatFileSize(maxSize, lang.get()) },
        }
      }
      return null
    }

    const add = (files) => {
      if (disabled || files.length === 0) return
      const offered = multiple ? files : files.slice(0, 1)
      const problems = offered.map(problemWith)
      rejection = problems.find(Boolean) ?? null
      const fresh = offered.filter((_file, index) => problems[index] === null).map((file) => {
        const id = nextId()
        held.set(id, file)
        return { id, name: file.name, size: file.size, type: file.type }
      })
      binding.touch()
      if (fresh.length > 0) {
        binding.commit(multiple ? [...asEntries(binding.read()), ...fresh] : fresh)
      }
      binding.check()
    }

    const remove = (id) => {
      rejection = null
      binding.touch()
      binding.commit(asEntries(binding.read()).filter((entry) => entry.id !== id))
      binding.check()
      control.focus()
    }

    const control = el('input', {
      id: CONTROL_ID,
      type: 'file',
      ...(multiple ? { multiple: true } : {}),
      ...(accept.length > 0 ? { accept: accept.join(',') } : {}),
      events: {
        change: () => {
          add([...control.files])
          control.value = ''
        },
        blur: () => {
          binding.touch()
          binding.check()
        },
      },
    })

    const hintParts = () =>
      [
        accept.length > 0 ? t(ACCEPTS_KEY, { types: accept.join(', ') }) : null,
        maxSize !== null ? t(MAX_SIZE_KEY, { size: formatFileSize(maxSize, lang.get()) }) : null,
      ].filter(Boolean)
    const hasHint = accept.length > 0 || maxSize !== null
    const hint = hasHint ? p({ class: 'hint', id: HINT_ID }) : null

    const zone = div(
      {
        class: 'zone',
        events: {
          dragover: (event) => {
            if (disabled) return
            event.preventDefault()
            zone.classList.add('over')
          },
          dragleave: (event) => {
            if (!zone.contains(event.relatedTarget)) zone.classList.remove('over')
          },
          drop: (event) => {
            if (disabled) return
            event.preventDefault()
            zone.classList.remove('over')
            add([...(event.dataTransfer?.files ?? [])])
          },
        },
      },
      icon(luUpload, { size: 'md' }),
      el('label', { class: 'prompt', for: CONTROL_ID }, lang.text(() => t(PROMPT_KEY))),
      hint,
    )

    const list = ul({ class: 'files' })
    let shown = []

    const paint = () => {
      hint?.replaceChildren(...hintParts().map((part) => span(part)))
      list.hidden = shown.length === 0
      list.replaceChildren(...shown.map((entry) =>
        li(
          { class: 'file' },
          span({ class: 'name' }, String(entry.name ?? '')),
          Number.isFinite(entry.size)
            ? span({ class: 'size' }, formatFileSize(entry.size, lang.get()))
            : null,
          button(
            {
              variant: 'ghost',
              size: 'sm',
              square: true,
              disabled,
              label: t(REMOVE_KEY, { name: entry.name }),
              events: { click: () => remove(entry.id) },
            },
            icon(luX, { size: 'sm' }),
          ),
        )
      ))
    }

    const handOver = () => {
      const files = shown.map(({ id }) => held.get(id)).filter(Boolean)
      if (sameFiles(files, handed)) return
      handed = files
      if (!onFiles) return
      try {
        Promise.resolve(onFiles([...files])).catch((error) =>
          impLogger.error(`${NAME}: 'onFiles' failed`, error)
        )
      } catch (error) {
        impLogger.error(`${NAME}: 'onFiles' failed`, error)
      }
    }

    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      control.disabled = disabled
      paint()
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        shown = asEntries(value)
        const kept = new Set(shown.map(({ id }) => id))
        for (const id of [...held.keys()]) if (!kept.has(id)) held.delete(id)
        paint()
        handOver()
      }),
    )
    stopOnRemove(
      self,
      binding.watchSubmits(() => {
        rejection = null
      }),
    )
    lang.watch(self, paint)

    const upload = div({ class: 'upload' }, control, zone, list)
    const shell = createShell(self, props, control, {
      presented: upload,
      describedBy: hint ? [HINT_ID] : [],
    })
    shell.attach(binding)
    return shell.root
  },
}

const registerMessages = () => {
  defaultMessages(FORM_MESSAGES)
  defaultMessages(messages)
}

export const fileUpload = (...args) =>
  defineComponent(NAME, () => definition, registerMessages)(...args)
