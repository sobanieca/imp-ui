import { defineComponent } from '../shared/define.js'
import { el } from '../../api/html.js'
import { oneOf } from '../shared/args.js'
import { ALIGNMENTS, alignRules, token, toneRules, TONES } from '../shared/css.js'

const LEVELS = [1, 2, 3, 4, 5, 6]

const KNOWN_PROPS = ['level', 'tone', 'align']

const styles = () => `
  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    font-family: ${token('font-family-heading')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    text-wrap: balance;
  }

  h1 { font-size: ${token('font-size-2xl')} }
  h2 { font-size: ${token('font-size-xl')} }
  h3 { font-size: ${token('font-size-lg')} }
  h4, h5, h6 { font-size: ${token('font-size-md')} }

  ${toneRules()}

  .tone-default {
    color: ${token('color-heading')};
  }

  ${alignRules()}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (_self, props, children) => {
    const level = oneOf('heading', 'level', props.level, LEVELS, 1)
    const tone = oneOf('heading', 'tone', props.tone, TONES, 'default')
    const align = oneOf('heading', 'align', props.align, ALIGNMENTS, 'start')
    return el(`h${level}`, { class: [`tone-${tone}`, `align-${align}`] }, ...children)
  },
}

export const heading = (...args) => defineComponent('heading', () => definition)(...args)
