import { defineComponent } from '../shared/define.js'
import { dialog, div, el, p, span, textarea } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText, oneOf } from '../shared/args.js'
import { captureReport, pickElement, placeOverElement } from '../../report.js'
import { button } from '../general/button.js'
import { createState } from '../../state.js'
import { focusRing, fontFamily, forcedColors, hiddenRule, SIZES, token } from '../shared/css.js'

const NAME = 'bugReport'

const TRIGGERS = ['button', 'link']

const KNOWN_PROPS = ['as', 'variant', 'size', 'label', 'onSubmit', 'events']

const COMMENT_ID = 'comment'

const messages = {
  'imp.bugReport.trigger': 'Report a problem',
  'imp.bugReport.picking': 'Click the part of the page the problem is about',
  'imp.bugReport.pickingHint': 'Escape cancels',
  'imp.bugReport.title': 'Report a problem',
  'imp.bugReport.comment': 'What went wrong?',
  'imp.bugReport.placeholder': 'Describe what you expected and what happened instead',
  'imp.bugReport.send': 'Send report',
  'imp.bugReport.cancel': 'Cancel',
  'imp.bugReport.needsComment': 'Describe the problem before sending it',
  'imp.bugReport.failed': 'The report could not be sent - try again',
  'imp.bugReport.sent': 'Thanks - your report was sent',
}

const styles = () => `
  ${hiddenRule}

  .root {
    display: inline-flex;
    align-items: baseline;
    gap: ${token('space-2')};
    ${fontFamily()}
  }

  .layer {
    position: fixed;
    inset: 0;
    margin: 0;
    border: none;
    padding: 0;
    overflow: visible;
    background: none;
    pointer-events: none;
    ${fontFamily()}
  }

  .outline {
    position: fixed;
    pointer-events: none;
    outline: ${token('focus-ring-width')} solid ${token('color-primary')};
    background-color: color-mix(in srgb, ${token('color-primary')} 18%, transparent);
  }

  .hint {
    position: fixed;
    inset-block-start: ${token('space-4')};
    inset-inline: 0;
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    inline-size: fit-content;
    max-inline-size: calc(100dvi - ${token('space-6')});
    margin-inline: auto;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-full')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-lg')};
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    pointer-events: auto;
  }

  .hint-key {
    color: ${token('color-secondary')};
  }

  .panel {
    position: fixed;
    inset: auto;
    inset-block-end: ${token('space-4')};
    inset-inline-end: ${token('space-4')};
    display: block;
    inline-size: 22rem;
    max-inline-size: calc(100dvi - ${token('space-6')});
    margin: 0;
    padding: ${token('space-4')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-lg')};
    color: ${token('color-text')};
    pointer-events: auto;
  }

  .panel:not([open]) {
    display: none;
  }

  .title {
    margin-block: 0 ${token('space-3')};
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-bold')};
  }

  .field-label {
    display: block;
    margin-block-end: ${token('space-1')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
  }

  textarea {
    box-sizing: border-box;
    inline-size: 100%;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
    resize: vertical;
  }

  textarea:focus-visible {${focusRing()}}

  textarea[aria-invalid='true'] {
    border-color: ${token('color-danger')};
  }

  .error {
    margin-block: ${token('space-2')} 0;
    color: ${token('color-danger')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .row {
    display: flex;
    gap: ${token('space-2')};
    margin-block-start: ${token('space-3')};
  }

  .status {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
  }

  .status:empty {
    display: none;
  }

  ${forcedColors}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const as = oneOf(NAME, 'as', props.as, TRIGGERS, 'button')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const save = typeof props.onSubmit === 'function' ? props.onSubmit : null
    if (!save) {
      impLogger.warn(
        `${NAME}: needs an 'onSubmit' function - it is what stores the report, so without one nothing is sent`,
      )
    }

    const sending = createState('imp.bugReport.sending', false)

    const action = (name, options, key, run) => {
      const control = button({ ...options, events: { click: run } }, lang.text(() => t(key)))
      control.classList.add(name)
      return control
    }

    const outline = div({ class: 'outline', hidden: true })
    const hintCancel = action('hint-cancel', { size: 'sm' }, 'imp.bugReport.cancel', () => finish())
    const hint = div(
      { class: 'hint', hidden: true },
      span(lang.text(() => t('imp.bugReport.picking'))),
      span({ class: 'hint-key' }, lang.text(() => t('imp.bugReport.pickingHint'))),
      hintCancel,
    )

    const field = textarea({ id: COMMENT_ID, rows: 4 })
    const error = p({ class: 'error', role: 'alert', hidden: true })
    const sendButton = action(
      'send',
      { variant: 'primary', loading: sending },
      'imp.bugReport.send',
      () => send(),
    )
    const cancelButton = action(
      'cancel',
      { disabled: sending },
      'imp.bugReport.cancel',
      () => finish(),
    )
    const panel = dialog(
      { class: 'panel' },
      el('h2', { class: 'title' }, lang.text(() => t('imp.bugReport.title'))),
      el(
        'label',
        { class: 'field-label', for: COMMENT_ID },
        lang.text(() => t('imp.bugReport.comment')),
      ),
      field,
      error,
      div({ class: 'row' }, sendButton, cancelButton),
    )
    const layer = div({ class: 'layer', popover: 'manual' }, outline, hint, panel)

    const status = p({ class: 'status', role: 'status' })
    const triggerLabel = children.length ? children : [
      props.label === undefined
        ? lang.text(() => t('imp.bugReport.trigger'))
        : bindText(self, props.label),
    ]
    const trigger = button(
      {
        variant: as === 'link' ? 'link' : props.variant,
        size,
        label: children.length && props.label !== undefined ? props.label : undefined,
        events: { click: () => start() },
      },
      ...triggerLabel,
    )
    trigger.classList.add('trigger')

    const paintWording = () => {
      field.placeholder = t('imp.bugReport.placeholder')
      panel.setAttribute('aria-label', t('imp.bugReport.title'))
    }
    paintWording()
    lang.watch(self, paintWording)

    let mode = 'off'
    let stopPicking = null
    let report = null
    let layerOpen = false

    const openLayer = () => {
      if (layerOpen) return
      layerOpen = true
      layer.showPopover()
    }

    const closeLayer = () => {
      if (!layerOpen) return
      layerOpen = false
      layer.hidePopover()
    }

    const showError = (message) => {
      error.textContent = message
      error.hidden = false
      field.setAttribute('aria-invalid', 'true')
    }

    const clearError = () => {
      error.textContent = ''
      error.hidden = true
      field.removeAttribute('aria-invalid')
    }

    const highlight = (node) => {
      if (!node) {
        outline.hidden = true
        return
      }
      placeOverElement(outline, node)
      outline.hidden = false
    }

    const finish = () => {
      stopPicking?.()
      stopPicking = null
      mode = 'off'
      report = null
      hint.hidden = true
      outline.hidden = true
      if (panel.open) panel.close()
      closeLayer()
      trigger.focus()
    }

    const start = () => {
      if (mode !== 'off') return
      mode = 'picking'
      report = null
      field.value = ''
      clearError()
      status.textContent = ''
      outline.hidden = true
      hint.hidden = false
      openLayer()
      stopPicking = pickElement({
        ignore: [self.host],
        onHover: highlight,
        onPick: (node) => {
          stopPicking = null
          mode = 'commenting'
          hint.hidden = true
          highlight(node)
          report = captureReport(node)
          panel.show()
          field.focus()
        },
        onCancel: () => {
          stopPicking = null
          finish()
        },
      })
    }

    const busy = (running) => {
      sending.set(running)
      panel.setAttribute('aria-busy', String(running))
    }

    const send = async () => {
      if (mode !== 'commenting') return
      const comment = field.value.trim()
      if (!comment) {
        showError(t('imp.bugReport.needsComment'))
        field.focus()
        return
      }
      if (!save) {
        impLogger.error(`${NAME}: a report was written but there is no 'onSubmit' to store it`)
        showError(t('imp.bugReport.failed'))
        return
      }
      clearError()
      mode = 'sending'
      busy(true)
      try {
        await save({ ...report, comment })
        mode = 'commenting'
        finish()
        status.textContent = t('imp.bugReport.sent')
      } catch (failure) {
        impLogger.error(`${NAME}: 'onSubmit' failed to store the report`, failure)
        mode = 'commenting'
        showError(t('imp.bugReport.failed'))
        field.focus()
      } finally {
        busy(false)
      }
    }

    layer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        send()
      }
    })
    self.abortSignal.addEventListener('abort', () => {
      stopPicking?.()
      closeLayer()
    })

    return div({ class: 'root', events: props.events }, trigger, status, layer)
  },
}

export const bugReport = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
