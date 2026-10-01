export const pageStyles = `
  :host { display: block; }

  .page {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--imp-space-5);
    max-inline-size: 64rem;
    margin-inline: auto;
    padding-block: var(--imp-space-6) calc(var(--imp-space-6) * 2);
    padding-inline: var(--imp-space-5);
    animation: rise var(--imp-duration-medium) ease-out both;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--imp-space-4);
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: var(--imp-space-5);
    align-items: start;
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(0.5rem); }
  }

  @media (prefers-reduced-motion: reduce) {
    .page { animation: none; }
  }
`
