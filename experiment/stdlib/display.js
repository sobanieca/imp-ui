// Display components: card, badge, avatar, tag, tooltip.

import { css, div, h3, img, span } from "../imp/imp.js";
import { cx, split } from "./util.js";

const cardCss = css`
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
  border: 1px solid var(--imp-color-border);
  border-radius: var(--imp-radius-md);
  box-shadow: var(--imp-shadow-sm);
  padding: var(--imp-space-16);
`;
const cardTitleCss = css`
  margin: 0 0 var(--imp-space-12) 0;
  font-size: var(--imp-font-size-lg);
  font-weight: var(--imp-font-weight-medium);
`;

export function card(...args) {
  const [{ title, class: extra, ...rest }, children] = split(args);
  return div({ ...rest, class: cx(cardCss, extra) }, [
    title ? h3({ class: cardTitleCss }, title) : null,
    children,
  ]);
}

const badgeCss = css`
  display: inline-block;
  padding: 2px var(--imp-space-8);
  border-radius: var(--imp-radius-full);
  font-size: var(--imp-font-size-xs);
  font-weight: var(--imp-font-weight-medium);
  background: var(--imp-color-primary);
  color: var(--imp-color-on-primary);
  &[data-kind="secondary"] {
    background: var(--imp-color-secondary);
  }
  &[data-kind="accent"] {
    background: var(--imp-color-accent);
  }
  &[data-kind="danger"] {
    background: var(--imp-color-danger);
  }
  &[data-kind="warning"] {
    background: var(--imp-color-warning);
  }
  &[data-kind="success"] {
    background: var(--imp-color-success);
  }
`;

// kind: primary (default) | secondary | accent | danger | warning | success
export function badge(...args) {
  const [{ kind = "primary", class: extra, ...rest }, children] = split(args);
  return span(
    { ...rest, class: cx(badgeCss, extra), "data-kind": kind },
    children,
  );
}

const avatarCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--imp-radius-full);
  background: var(--imp-color-surface-alt);
  color: var(--imp-color-text-muted);
  font-weight: var(--imp-font-weight-medium);
  overflow: hidden;
  & img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
`;

const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase())
    .join("");

export function avatar(
  { src, name = "", size = 40, class: extra, ...rest } = {},
) {
  return span({
    ...rest,
    class: cx(avatarCss, extra),
    title: name || null,
    style: {
      inlineSize: size + "px",
      blockSize: size + "px",
      fontSize: size * 0.4 + "px",
    },
  }, src ? img({ src, alt: name }) : initials(name));
}

const tagCss = css`
  display: inline-block;
  padding: 2px var(--imp-space-8);
  border: 1px solid var(--imp-color-border);
  border-radius: var(--imp-radius-sm);
  font-size: var(--imp-font-size-xs);
  background: var(--imp-color-surface-alt);
  color: var(--imp-color-text-muted);
`;

export function tag(...args) {
  const [{ class: extra, ...rest }, children] = split(args);
  return span({ ...rest, class: cx(tagCss, extra) }, children);
}

const tooltipCss = css`
  position: relative;
  display: inline-block;
  &::after {
    content: attr(data-imp-tip);
    position: absolute;
    inset-block-end: calc(100% + 6px);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    padding: var(--imp-space-4) var(--imp-space-8);
    border-radius: var(--imp-radius-sm);
    background: var(--imp-color-text);
    color: var(--imp-color-bg);
    font-size: var(--imp-font-size-xs);
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    z-index: 10;
  }
  &:hover::after, &:focus-within::after {
    opacity: 1;
  }
`;

// tooltip({ text: 'Delete' }, button(...)) — pure CSS, shows on hover/focus.
export function tooltip(...args) {
  const [{ text, class: extra, ...rest }, children] = split(args);
  return span(
    { ...rest, class: cx(tooltipCss, extra), "data-imp-tip": text },
    children,
  );
}
