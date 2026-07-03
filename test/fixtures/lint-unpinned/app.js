import mitt from 'npm:mitt@3'
import { encodeBase64 } from 'jsr:@std/encoding'
const loadLodash = () => import('npm:lodash-es@^4.17')

export const wire = () => {
  mitt()
  encodeBase64('imp')
  loadLodash()
}
