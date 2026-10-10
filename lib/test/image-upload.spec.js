import { expect, test } from 'imp/test'

const UPLOAD = '#image imp-image-upload'

const FRAME = `${UPLOAD} >>> .frame`

const shownValue = (page) => page.$eval('#image-value', (node) => node.textContent)

const pickPicture = (page) =>
  page.$eval(`${UPLOAD} >>> #control`, async (input) => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 200
    const context = canvas.getContext('2d')
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, 200, 200)
    context.fillStyle = '#0000ff'
    context.fillRect(200, 0, 200, 200)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob], 'shot.png', { type: 'image/png' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })

const clickAction = (page, text) =>
  page.$$eval(`${UPLOAD} >>> imp-button`, (hosts, wanted) => {
    const host = hosts.find((node) => node.shadowRoot.textContent.trim() === wanted)
    host.shadowRoot.querySelector('button').click()
  }, text)

const decoded = (page) =>
  page.$eval('#image-value', async (node) => {
    const image = new Image()
    image.src = node.textContent
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const [left, , , leftAlpha] = context.getImageData(5, 50, 1, 1).data
    const [right, , rightBlue] = context.getImageData(94, 50, 1, 1).data
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      type: node.textContent.slice(0, 22),
      leftRed: left > 200 && leftAlpha === 255,
      rightRed: right > 200,
      rightBlue: rightBlue > 200,
    }
  })

test('a picked picture opens the editor, and the arrow keys move the frame', async ({ page }) => {
  await pickPicture(page)
  await page.waitForSelector(`${UPLOAD} >>> .editor:not([hidden])`)
  const focused = await page.$eval(UPLOAD, (node) => node.shadowRoot.activeElement?.className)
  expect(focused).toEqual('frame circle')
  expect(await shownValue(page)).toEqual('')
  for (let step = 0; step < 20; step++) await page.keyboard.press('ArrowLeft')
  await clickAction(page, 'Done')
  await page.waitForSelector(`${UPLOAD} >>> .result:not([hidden])`)
  expect(await decoded(page)).toEqual({
    width: 100,
    height: 100,
    type: 'data:image/png;base64,',
    leftRed: true,
    rightRed: true,
    rightBlue: false,
  })
})

test('Adjust reopens the crop, and a drag moves the frame over the picture', async ({ page }) => {
  await clickAction(page, 'Adjust')
  await page.waitForSelector(`${UPLOAD} >>> .editor:not([hidden])`)
  const box = await page.$eval(FRAME, (node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  expect(Math.round(box.width)).toEqual(Math.round(box.height))
  const startX = box.x + box.width * 0.9
  const y = box.y + box.height / 2
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(startX - box.width * 0.5, y, { steps: 5 })
  await page.mouse.move(startX - box.width * 1.5, y, { steps: 5 })
  await page.mouse.up()
  await clickAction(page, 'Done')
  await page.waitForSelector(`${UPLOAD} >>> .result:not([hidden])`)
  expect(await decoded(page)).toEqual({
    width: 100,
    height: 100,
    type: 'data:image/png;base64,',
    leftRed: false,
    rightRed: false,
    rightBlue: true,
  })
})

test('the zoom slider shrinks the crop, and Remove clears the value', async ({ page }) => {
  await clickAction(page, 'Adjust')
  await page.waitForSelector(`${UPLOAD} >>> .editor:not([hidden])`)
  await page.$eval(`${UPLOAD} >>> #zoom`, (input) => {
    input.value = '4'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clickAction(page, 'Done')
  await page.waitForSelector(`${UPLOAD} >>> .result:not([hidden])`)
  expect((await decoded(page)).width).toEqual(50)
  await clickAction(page, 'Remove')
  await page.waitForSelector(`${UPLOAD} >>> .zone:not([hidden])`)
  expect(await shownValue(page)).toEqual('')
})

test('a HEIC photo that the browser cannot decode shows the HEIC message', async ({ page }) => {
  await page.$eval(`${UPLOAD} >>> #control`, (input) => {
    const header = [0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0]
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(header)], 'IMG_0001.HEIC', { type: '' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForSelector(`${UPLOAD} >>> #control[aria-invalid="true"]`)
  expect(await page.$eval(`${UPLOAD} >>> .error`, (node) => node.textContent)).toEqual(
    'This browser cannot open the HEIC photo IMG_0001.HEIC. Save it as a JPEG and pick it again.',
  )
  expect(await page.$eval(`${UPLOAD} >>> .editor`, (node) => node.hidden)).toEqual(true)
  expect(await shownValue(page)).toEqual('')
})
