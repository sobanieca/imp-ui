import { fontFamily, forcedColors, groupableSeam, seamLift, token } from '../shared/css.js'

export const controlStyles = () => `
  input,
  textarea,
  select {
    inline-size: 100%;
    box-sizing: border-box;
    margin: 0;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    border: ${token('border-width')} solid ${token('color-border')};
    ${groupableSeam()}
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
    transition: border-color ${token('duration-fast')} ease-out;
  }

  select {
    padding-inline-end: ${token('space-6')};
  }

  textarea {
    resize: vertical;
  }

  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: ${token('focus-ring-width')} solid ${token('color-primary')};
    outline-offset: 2px;
  }

  ${seamLift('input')}
  ${seamLift('textarea')}
  ${seamLift('select')}

  input:disabled,
  textarea:disabled,
  select:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  input[aria-invalid='true'],
  textarea[aria-invalid='true'],
  select[aria-invalid='true'] {
    border-color: ${token('color-danger')};
  }

  @media (prefers-reduced-motion: reduce) {
    input,
    textarea,
    select {
      transition: none;
    }
  }

  ${forcedColors}
`

export const checkableStyles = () => `
  .check {
    display: flex;
    align-items: flex-start;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .check input {
    flex: none;
    inline-size: 1.125rem;
    block-size: 1.125rem;
    margin: 0;
    accent-color: ${token('color-primary')};
  }

  .check input:focus-visible {
    outline: ${token('focus-ring-width')} solid ${token('color-primary')};
    outline-offset: 2px;
  }

  .check input:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .check-label {
    ${fontFamily()}
    color: ${token('color-text')};
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
  }

  ${forcedColors}
`
