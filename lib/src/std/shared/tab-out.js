export const closeOnTabOut = (panel) => {
  let leavingByTab = false
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') leavingByTab = true
  })
  panel.addEventListener('keyup', () => {
    leavingByTab = false
  })
  panel.addEventListener('focusout', (event) => {
    const wasTab = leavingByTab
    leavingByTab = false
    const next = event.relatedTarget
    if (!wasTab || next === null || panel.contains(next)) return
    if (panel.matches(':popover-open')) panel.hidePopover()
  })
}
