import { token } from '../shared/css.js'

export const markdownViewStyles = (scope) => `
  ${scope} > :first-child { margin-block-start: 0 }
  ${scope} > :last-child { margin-block-end: 0 }

  ${scope} p,
  ${scope} div,
  ${scope} blockquote,
  ${scope} pre,
  ${scope} ul,
  ${scope} ol,
  ${scope} h1,
  ${scope} h2,
  ${scope} h3,
  ${scope} h4,
  ${scope} h5,
  ${scope} h6 {
    margin-block: ${token('space-2')};
  }

  ${scope} h1,
  ${scope} h2,
  ${scope} h3,
  ${scope} h4,
  ${scope} h5,
  ${scope} h6 {
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
  }

  ${scope} h1 { font-size: ${token('font-size-2xl')} }
  ${scope} h2 { font-size: ${token('font-size-xl')} }
  ${scope} h3 { font-size: ${token('font-size-lg')} }
  ${scope} h4, ${scope} h5, ${scope} h6 { font-size: ${token('font-size-md')} }

  ${scope} blockquote {
    margin-inline: 0;
    padding-inline-start: ${token('space-3')};
    border-inline-start: 3px solid ${token('color-border')};
    color: ${token('color-secondary')};
  }

  ${scope} pre,
  ${scope} code {
    font-family: ${token('font-family-mono')};
    background-color: ${token('color-surface-sunken')};
    border-radius: ${token('radius-item')};
  }

  ${scope} pre {
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    font-size: ${token('font-size-sm')};
    white-space: pre;
    overflow: auto;
  }

  ${scope} code {
    padding-inline: 0.25em;
    font-size: 0.9em;
  }

  ${scope} ul,
  ${scope} ol {
    padding-inline-start: ${token('space-5')};
  }

  ${scope} a {
    color: ${token('color-primary')};
    text-decoration: underline;
  }

  ${scope} img {
    max-inline-size: 100%;
    block-size: auto;
    border-radius: ${token('radius-item')};
    vertical-align: middle;
  }

  ${scope} hr {
    margin-block: ${token('space-3')};
    border: 0;
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }
`
