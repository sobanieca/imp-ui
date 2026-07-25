import { component } from '../../component.js'
import { el } from '../../render.js'
import { oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { ALIGNMENTS, alignRules, fontFamily, toneRules, TONES } from '../shared/css.js'

const LEVELS = [1, 2, 3, 4, 5, 6]

const KNOWN_PROPS = ['level', 'tone', 'align']

const styles = `
  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    ${fontFamily}
    font-weight: var(--imp-font-weight-bold, 700);
    line-height: var(--imp-line-height-tight, 1.25);
    text-wrap: balance;
  }

  h1 { font-size: var(--imp-font-size-2xl, 2rem) }
  h2 { font-size: var(--imp-font-size-xl, 1.5rem) }
  h3 { font-size: var(--imp-font-size-lg, 1.125rem) }
  h4, h5, h6 { font-size: var(--imp-font-size-md, 1rem) }

  ${toneRules}
  ${alignRules}
`

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs('heading', args)
    warnUnknownProps('heading', props, KNOWN_PROPS)
    const level = oneOf('heading', 'level', props.level, LEVELS, 1)
    const tone = oneOf('heading', 'tone', props.tone, TONES, 'default')
    const align = oneOf('heading', 'align', props.align, ALIGNMENTS, 'start')
    return el(
      `h${level}`,
      { class: [`tone-${tone}`, `align-${align}`] },
      ...children,
    )
  },
}

let create = null

export const heading = (...args) => {
  create ??= component('imp-heading', definition)
  return create(...args)
}
