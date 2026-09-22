import { focusRing, fontFamily, token } from './css.js'

export const menuStyles = () => `
  .panel {
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
    min-inline-size: 10rem;
    padding: ${token('space-1')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .option {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    margin: 0;
    border: none;
    border-radius: ${token('radius-item')};
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    background-color: transparent;
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
    text-decoration: none;
    white-space: nowrap;
    text-align: start;
    cursor: pointer;
  }

  .option:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .option:focus-visible {${focusRing()}}

  .option:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .option .icon {
    display: block;
    inline-size: 1em;
    block-size: 1em;
  }

  @media (forced-colors: active) {
    .panel { border-color: CanvasText }
  }
`

export const MENU_OPTION = { class: 'option', role: 'menuitem', tabindex: '-1' }

export const wireMenu = ({ panel, opener, options, onToggle }) => {
  let open = false
  let heldFocus = false

  const selectable = () => options.filter((option) => !option.disabled)

  const focusOption = (option) => {
    if (!option) return
    for (const other of options) other.tabIndex = other === option ? 0 : -1
    option.focus()
  }

  const step = (direction) => {
    const candidates = selectable()
    const from = candidates.indexOf(panel.getRootNode().activeElement)
    focusOption(candidates[(from + direction + candidates.length) % candidates.length])
  }

  const close = () => {
    if (open) panel.hidePopover()
  }

  panel.append(...options)

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') return close()
    if (event.key === 'ArrowDown') step(1)
    else if (event.key === 'ArrowUp') step(-1)
    else if (event.key === 'Home') focusOption(selectable()[0])
    else if (event.key === 'End') focusOption(selectable().at(-1))
    else return
    event.preventDefault()
  })

  panel.addEventListener('beforetoggle', (event) => {
    open = event.newState === 'open'
    onToggle(open)
    heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
  })

  panel.addEventListener('toggle', (event) => {
    if (event.newState === 'open') {
      const candidates = selectable()
      focusOption(candidates.find((option) => option.tabIndex === 0) ?? candidates[0])
      return
    }
    if (heldFocus) opener.focus()
  })

  return { close }
}
