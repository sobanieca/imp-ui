import { button as nativeButton, el, img } from 'imp/html'
import * as html from 'imp/html'
import { button, icon } from 'imp/std'
import { luTrash } from 'imp/icons'

export const logo = () => img({ src: '/logo.svg' })
export const photo = () => html.img({ src: '/photo.jpg' })
export const banner = () => el('img', { src: '/banner.png' })
export const described = () => img({ src: '/chart.png', alt: 'Sales per month' })
export const decorative = () => img({ src: '/wave.svg', alt: '' })
export const forwarded = (props) => img(props)
export const spread = (props) => img({ ...props, src: '/a.png' })

export const remove = () => button({ variant: 'ghost', square: true }, icon(luTrash))
export const removeNamed = () => button({ square: true, label: 'Delete' }, icon(luTrash))
export const removeText = () => button({}, icon(luTrash), 'Delete')
export const nativeRemove = () => nativeButton(icon(luTrash))
export const nativeNamed = () => nativeButton({ 'aria-label': 'Delete' }, icon(luTrash))
export const elRemove = () => el('button', { type: 'button' }, icon(luTrash))
export const empty = () => button({ label: 'Close' })
