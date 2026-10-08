import { focusRing, fontFamily, token } from './css.js'
import { focusRoving, rovingMove, rovingPick } from './roving.js'

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

  .option .icon,
  .option .check {
    display: block;
    flex: none;
    inline-size: 1em;
    block-size: 1em;
  }

  .option .check {
    margin-inline-start: auto;
    padding-inline-start: ${token('space-2')};
    box-sizing: content-box;
    color: ${token('color-primary')};
  }

  .option[aria-checked='false'] .check {
    visibility: hidden;
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

  const focusOption = (option) => focusRoving(options, option)

  const close = () => {
    if (open) panel.hidePopover()
  }

  panel.append(...options)

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      close()
      heldFocus = false
      return
    }
    const move = rovingMove(event.key, { orientation: 'vertical' })
    if (move === null) return
    const candidates = selectable()
    const from = candidates.indexOf(panel.getRootNode().activeElement)
    focusOption(rovingPick(move, candidates, from))
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
