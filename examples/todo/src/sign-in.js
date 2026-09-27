import { component } from 'imp'
import { div, h1, p } from 'imp/html'
import { useHttpClient } from 'imp/http'
import { useState } from 'imp/state'
import { form, textField } from 'imp/std/inputs'
import { signIn } from './todos/todo-api.js'
import { writeToken } from './session-token.js'
import { submitButton } from './submit-button.js'
import { tr, translated } from './translate.js'
import { logoMark } from './ui/logo-mark.js'

export const signInPage = component('todo-sign-in', {
  styles: `
    .panel {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: var(--imp-space-5);
      inline-size: min(28rem, calc(100dvi - 2rem));
      padding: var(--imp-space-6);
      background: color-mix(in oklab, var(--imp-color-surface) 82%, transparent);
      backdrop-filter: blur(20px) saturate(1.4);
      border: var(--imp-border-width) solid var(--imp-color-border);
      border-radius: calc(var(--imp-radius-container) * 1.5);
      box-shadow: var(--imp-shadow-lg);
      animation: rise var(--imp-duration-medium) ease-out both;
    }
    .intro { display: flex; flex-direction: column; align-items: center; gap: var(--imp-space-3); text-align: center; }
    h1 {
      margin: 0;
      font: 700 clamp(1.75rem, 1.4rem + 1.5dvi, 2.25rem) / 1.1 var(--imp-font-family-heading);
      letter-spacing: -0.03em;
      color: var(--imp-color-text);
    }
    p { margin: 0; color: var(--imp-color-secondary); font: var(--imp-font-size-md) / var(--imp-line-height-normal) var(--imp-font-family); }
    @keyframes rise { from { opacity: 0; transform: translateY(0.75rem) scale(0.98); } }
    @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
  `,
  setup: (self) => {
    const api = useHttpClient(self, 'todo.api')
    const session = useState(self, 'todo.session')
    const submit = async (credentials) => {
      const user = await signIn(api, credentials)
      writeToken(user.token)
      session.set(user)
    }
    return div(
      { class: 'panel' },
      div(
        { class: 'intro' },
        logoMark({ large: true }),
        h1(tr('signIn.title')),
        p(tr('signIn.intro')),
      ),
      form(
        { initialValues: { name: '', email: '' }, onSubmit: submit },
        textField({
          field: 'name',
          label: translated('signIn.name'),
          required: true,
          minLength: 2,
        }),
        textField({
          field: 'email',
          type: 'email',
          label: translated('signIn.email'),
          required: true,
          pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
        }),
        submitButton('signIn.submit'),
      ),
    )
  },
})
