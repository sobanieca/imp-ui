import { expect, test } from 'imp/test'

const spillsIn = (page, display) =>
  page.evaluate(async (display) => {
    const parentOf = (node) => node.parentElement ?? node.getRootNode().host ?? null
    const showcase = document.querySelector('narrow-showcase')
    const cases = [...showcase.shadowRoot.querySelectorAll('.narrow-case')]
    for (const box of cases) box.style.cssText = `display: ${display}; flex-wrap: wrap`
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const nodesOf = (root) =>
      [...root.querySelectorAll('*')].flatMap((node) =>
        node.shadowRoot ? [node, ...nodesOf(node.shadowRoot)] : [node]
      )
    const found = cases.flatMap((box) => {
      const edge = box.getBoundingClientRect().right + 1
      const clipped = (node) => {
        for (let up = parentOf(node); up !== null && up !== box; up = parentOf(up)) {
          const style = getComputedStyle(up)
          const clips = style.overflowX !== 'visible' ||
            (style.clipPath !== 'none' && style.position === 'absolute')
          if (clips && up.getBoundingClientRect().right <= edge) return true
        }
        return false
      }
      const wide = nodesOf(box).filter((node) => {
        const { right, width } = node.getBoundingClientRect()
        return width > 0 && right > edge && !clipped(node) &&
          getComputedStyle(node).visibility !== 'hidden'
      })
      const widthOf = (host) =>
        Math.max(
          0,
          ...[...(host.shadowRoot?.children ?? [])].map((node) =>
            node.getBoundingClientRect().width
          ),
        )
      const collapsed = [...box.children].filter((host) =>
        widthOf(host) < 24 && host.shadowRoot?.textContent.trim().length > 3
      )
      if (collapsed.length > 0) return [`${box.dataset.name}: collapsed`]
      if (wide.length === 0) return []
      const [first] = wide
      const over = Math.round(first.getBoundingClientRect().right - edge)
      return [`${box.dataset.name}: ${first.localName}.${first.getAttribute('class')} ${over}px`]
    })
    return { count: cases.length, found }
  }, display)

test('no component spills out of a 320px column, as a block or as a flex item', async ({ page }) => {
  await page.setViewport({ width: 800, height: 900 })
  for (const display of ['block', 'flex']) {
    const { count, found } = await spillsIn(page, display)
    expect(count).toEqual(36)
    expect(found).toEqual([])
  }
})

test('a chart in a narrow column shows whole axis labels that do not overlap', async ({ page }) => {
  await page.setViewport({ width: 800, height: 900 })
  for (const name of ['chart', 'chart-days']) {
    const labels = await page.evaluate((name) => {
      const box = document.querySelector('narrow-showcase').shadowRoot
        .querySelector(`[data-name="${name}"]`)
      const chartRoot = box.querySelector('imp-chart').shadowRoot
      return [...chartRoot.querySelectorAll('.category > span:not([hidden])')].map((label) => {
        const { left, right } = label.getBoundingClientRect()
        return {
          left,
          right,
          cut: label.scrollWidth > label.parentElement.clientWidth + 1 &&
            !label.closest('.thinned'),
        }
      })
    }, name)
    expect(labels.length > 1).toBeTruthy()
    expect(labels.filter(({ cut }) => cut)).toEqual([])
    const overlaps = labels.slice(1).filter((label, index) => label.left < labels[index].right)
    expect(overlaps).toEqual([])
  }
})
