import { fontFamily, forcedColors } from '../shared/css.js'

export const controlStyles = `
  input,
  textarea,
  select {
    inline-size: 100%;
    box-sizing: border-box;
    margin: 0;
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-3, 12px);
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-md, 6px);
    background-color: var(--imp-color-surface, #ffffff);
    color: var(--imp-color-text, #0f172a);
    ${fontFamily}
    font-size: var(--imp-font-size-md, 1rem);
    line-height: var(--imp-line-height-normal, 1.6);
    transition: border-color var(--imp-duration-fast, 120ms) ease-out;
  }

  select {
    padding-inline-end: var(--imp-space-6, 32px);
  }

  textarea {
    resize: vertical;
  }

  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 2px;
  }

  input:disabled,
  textarea:disabled,
  select:disabled {
    cursor: not-allowed;
    opacity: var(--imp-disabled-opacity, 0.55);
  }

  input[aria-invalid='true'],
  textarea[aria-invalid='true'],
  select[aria-invalid='true'] {
    border-color: var(--imp-color-danger, #dc2626);
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

export const checkableStyles = `
  .check {
    display: flex;
    align-items: flex-start;
    gap: var(--imp-space-2, 8px);
    min-inline-size: 0;
  }

  .check input {
    flex: none;
    inline-size: 1.125rem;
    block-size: 1.125rem;
    margin: 0;
    accent-color: var(--imp-color-primary, #2563eb);
  }

  .check input:focus-visible {
    outline: var(--imp-focus-ring-width, 2px) solid var(--imp-color-focus-ring, #2563eb);
    outline-offset: 2px;
  }

  .check input:disabled {
    cursor: not-allowed;
    opacity: var(--imp-disabled-opacity, 0.55);
  }

  .check-label {
    ${fontFamily}
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-md, 1rem);
    line-height: var(--imp-line-height-normal, 1.6);
  }

  ${forcedColors}
`
