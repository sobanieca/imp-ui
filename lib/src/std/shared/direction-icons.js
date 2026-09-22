import { dir } from '../../api/i18n.js'
import { icon } from '../general/icon.js'
import { luChevronLeft, luChevronRight } from '../../icons/lucide-icons.js'

export const backIcon = (size = 'sm') =>
  dir.view((direction) => icon(direction === 'rtl' ? luChevronRight : luChevronLeft, { size }))

export const forwardIcon = (size = 'sm') =>
  dir.view((direction) => icon(direction === 'rtl' ? luChevronLeft : luChevronRight, { size }))
