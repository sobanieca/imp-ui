import { defineComponent } from '../shared/define.js'
import { p, span } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import {
  ALIGNMENTS,
  alignRules,
  fontFamily,
  sizeRules,
  SIZES,
  token,
  toneRules,
  TONES,
  weightRules,
  WEIGHTS,
} from '../shared/css.js'

const KNOWN_PROPS = ['tone', 'size', 'weight', 'align', 'inline']

const styles = () => `
  p, span {
    margin: 0;
    ${fontFamily()}
    line-height: ${token('line-height-normal')};
  }

  ${toneRules()}
  ${sizeRules()}
  ${weightRules()}
  ${alignRules()}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    const tone = oneOf('text', 'tone', props.tone, TONES, 'default')
    const size = oneOf('text', 'size', props.size, SIZES, 'md')
    const weight = oneOf('text', 'weight', props.weight, WEIGHTS, 'normal')
    const align = oneOf('text', 'align', props.align, ALIGNMENTS, 'start')
    const paragraphOrSpan = props.inline ? span : p
    return paragraphOrSpan(
      { class: [`tone-${tone}`, `size-${size}`, `weight-${weight}`, `align-${align}`] },
      ...children,
    )
  },
}

export const text = (...args) => defineComponent('text', () => definition)(...args)
