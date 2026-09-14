import { token } from '../shared/css.js'

const TOKEN_COLORS = [
  ['keyword', 'purple'],
  ['string', 'green'],
  ['number', 'orange'],
  ['literal', 'orange'],
  ['function', 'blue'],
  ['type', 'teal'],
  ['property', 'indigo'],
  ['variable', 'pink'],
  ['attribute', 'cyan'],
  ['tag', 'purple'],
  ['title', 'blue'],
]

const mixed = (name, amount = '72%') =>
  `color-mix(in oklab, ${token(`color-${name}`)} ${amount}, ${token('color-text')})`

export const tint = (name, amount) =>
  `color-mix(in oklab, ${token(`color-${name}`)} ${amount}, transparent)`

const tokenRules = () =>
  TOKEN_COLORS.map(([type, name]) => `  .token-${type} { color: ${mixed(name)} }`).join('\n')

export const tokenStyles = () => `
${tokenRules()}

  .token-comment {
    color: ${token('color-secondary')};
    font-style: italic;
  }

  .token-punctuation {
    color: ${token('color-secondary')};
  }

  .token-title, .token-emphasis {
    font-weight: ${token('font-weight-bold')};
  }

  .token-inserted {
    color: ${mixed('green')};
    background-color: ${tint('green', '12%')};
  }

  .token-deleted {
    color: ${mixed('red')};
    background-color: ${tint('red', '12%')};
  }

  @media (forced-colors: active) {
    [class^='token-'] { color: CanvasText }
    .token-comment { color: GrayText }
  }
`

export const tokenNodes = (tokens, createSpan) =>
  tokens.map(({ type, text }) => (type === null ? text : createSpan(`token-${type}`, text)))
