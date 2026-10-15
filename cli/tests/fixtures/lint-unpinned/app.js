import mitt from 'npm:mitt@3.0.1'
import dayjs from 'dayjs'
import confetti from 'canvas-confetti'
const loadNanoid = () => import('npm:nanoid@5.0.7/non-secure')

export const wire = () => {
  mitt()
  dayjs()
  confetti()
  loadNanoid()
}
