import { component } from 'imp'
import { div } from 'imp/html'

export const backdrop = component('todo-backdrop', {
  styles: `
    :host { display: block; position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(72px);
      opacity: 0.4;
      animation: drift 26s ease-in-out infinite alternate;
    }
    .violet {
      inline-size: 34rem;
      block-size: 34rem;
      inset-block-start: -10rem;
      inset-inline-start: -8rem;
      background: color-mix(in oklab, var(--imp-color-violet) 55%, transparent);
    }
    .pink {
      inline-size: 28rem;
      block-size: 28rem;
      inset-block-start: 20%;
      inset-inline-end: -8rem;
      background: color-mix(in oklab, var(--imp-color-pink) 45%, transparent);
      animation-duration: 32s;
      animation-direction: alternate-reverse;
    }
    .sky {
      inline-size: 30rem;
      block-size: 30rem;
      inset-block-end: -12rem;
      inset-inline-start: 30%;
      background: color-mix(in oklab, var(--imp-color-sky) 50%, transparent);
      animation-duration: 38s;
    }
    @keyframes drift {
      to { transform: translate3d(3rem, 2rem, 0) scale(1.12); }
    }
    @media (prefers-reduced-motion: reduce) {
      .orb { animation: none; }
    }
    @media (forced-colors: active) {
      :host { display: none; }
    }
  `,
  setup: () =>
    div(div({ class: 'orb violet' }), div({ class: 'orb pink' }), div({ class: 'orb sky' })),
})
