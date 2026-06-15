// Layout primitives: stack, row, grid, spacer, container.
// Gap presets: gap: 'sm' (8px) | 'md' (16px, default) | 'lg' (24px).

import { css, div } from "../imp/imp.js";
import { cx, split } from "./util.js";

const GAPS = {
  sm: "var(--imp-space-8)",
  md: "var(--imp-space-16)",
  lg: "var(--imp-space-24)",
};
const gapOf = (g) => GAPS[g] ?? g ?? GAPS.md;

const stackCss = css`
  display: flex;
  flex-direction: column;
`;

export function stack(...args) {
  const [{ gap, class: extra, ...rest }, children] = split(args);
  return div({
    ...rest,
    class: cx(stackCss, extra),
    style: { gap: gapOf(gap) },
  }, children);
}

const rowCss = css`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

// props.wrap → flex-wrap; props.align/justify pass through.
export function row(...args) {
  const [{ gap, wrap, align, justify, class: extra, ...rest }, children] =
    split(args);
  return div({
    ...rest,
    class: cx(rowCss, extra),
    style: {
      gap: gapOf(gap),
      flexWrap: wrap ? "wrap" : null,
      alignItems: align ?? null,
      justifyContent: justify ?? null,
    },
  }, children);
}

const gridCss = css`
  display: grid;
`;

export function grid(...args) {
  const [{ cols = 2, gap, class: extra, ...rest }, children] = split(args);
  return div({
    ...rest,
    class: cx(gridCss, extra),
    style: {
      gap: gapOf(gap),
      gridTemplateColumns: typeof cols === "number"
        ? `repeat(${cols}, 1fr)`
        : cols,
    },
  }, children);
}

const spacerCss = css`
  flex: 1;
`;

export const spacer = () => div({ class: spacerCss });

const containerCss = css`
  max-inline-size: 960px;
  margin-inline: auto;
  padding-inline: var(--imp-space-16);
`;

export function container(...args) {
  const [{ class: extra, ...rest }, children] = split(args);
  return div({ ...rest, class: cx(containerCss, extra) }, children);
}
