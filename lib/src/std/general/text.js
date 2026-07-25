import { component } from '../../component.js'
import { p, span } from '../../render.js'
import { oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import {
  ALIGNMENTS,
  alignRules,
  fontFamily,
  sizeRules,
  SIZES,
  toneRules,
  TONES,
  weightRules,
  WEIGHTS,
} from '../shared/css.js'

const KNOWN_PROPS = ['tone', 'size', 'weight', 'align', 'inline']

const styles = `
  p, span {
    margin: 0;
    ${fontFamily}
    line-height: var(--imp-line-height-normal, 1.6);
  }

  ${toneRules}
  ${sizeRules}
  ${weightRules}
  ${alignRules}
`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs('text', args)
    warnUnknownProps('text', props, KNOWN_PROPS)
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

let create = null

export const text = (...args) => {
  create ??= component('imp-text', definition)
  return create(...args)
}
