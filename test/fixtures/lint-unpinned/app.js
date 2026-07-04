import mitt from 'npm:mitt@3.0.1'
import dayjs from 'dayjs'
import confetti from 'canvas-confetti'
const loadBase64 = () => import('jsr:@std/encoding@1.0.10/base64')

export const wire = () => {
  mitt()
  dayjs()
  confetti()
  loadBase64()
}
