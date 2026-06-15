// Data components: dataTable, listView, tree.

import {
  button,
  computed,
  css,
  div,
  each,
  li,
  signal,
  span,
  t,
  table,
  tbody,
  td,
  th,
  thead,
  tr,
  ul,
  when,
} from "../imp/imp.js";
import { cx, read } from "./util.js";
import { pagination } from "./navigation.js";

const tableCss = css`
  inline-size: 100%;
  border-collapse: collapse;
  font-size: var(--imp-font-size-sm);
  color: var(--imp-color-text);
  & th, & td {
    text-align: start;
    padding: var(--imp-space-8) var(--imp-space-12);
    border-block-end: 1px solid var(--imp-color-border);
  }
  & th {
    font-weight: var(--imp-font-weight-medium);
    color: var(--imp-color-text-muted);
    white-space: nowrap;
  }
  & th button {
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
  }
  & tbody tr:hover {
    background: var(--imp-color-surface-alt);
  }
`;
const tableFootCss = css`
  display: flex;
  justify-content: flex-end;
  padding-block-start: var(--imp-space-12);
`;
const emptyCss = css`
  color: var(--imp-color-text-muted);
  font-size: var(--imp-font-size-sm);
  padding: var(--imp-space-16);
  text-align: center;
`;

// dataTable({
//   columns: [{ key, label, sortable?, render? }],   render: (row) => child
//   rows:    array or signal of row objects,
//   getKey:  row => key (default row.id — required for stable rows),
//   pageSize: number (omit for no pagination),
// })
export function dataTable(
  {
    columns = [],
    rows = [],
    getKey = (r) => r.id,
    pageSize,
    class: extra,
    ...rest
  } = {},
) {
  const sortKey = signal(null);
  const sortDir = signal(1);
  const page = signal(1);

  const sorted = computed(() => {
    const list = [...(read(rows) ?? [])];
    const key = sortKey();
    if (key) {
      const dir = sortDir();
      list.sort((x, y) => {
        const a = x[key], b = y[key];
        return (a < b ? -1 : a > b ? 1 : 0) * dir;
      });
    }
    return list;
  });
  const pages = computed(() =>
    pageSize ? Math.max(1, Math.ceil(sorted().length / pageSize)) : 1
  );
  const view = computed(() => {
    if (pages() < page()) page.set(pages()); // list shrank under the current page
    if (!pageSize) return sorted();
    return sorted().slice((page() - 1) * pageSize, page() * pageSize);
  });

  const toggleSort = (key) => {
    if (sortKey() === key) sortDir.update((d) => -d);
    else {
      sortKey.set(key);
      sortDir.set(1);
    }
  };
  const arrow = (key) => () =>
    sortKey() === key ? (sortDir() > 0 ? " ↑" : " ↓") : "";

  return div({ ...rest, class: extra }, [
    table({ class: tableCss }, [
      thead(
        tr(columns.map((c) =>
          th(
            c.sortable
              ? button({ events: { click: () => toggleSort(c.key) } }, [
                String(c.label),
                arrow(c.key),
              ])
              : String(c.label),
          )
        )),
      ),
      tbody([
        each(
          view,
          (row) =>
            tr(
              columns.map((c) =>
                td(c.render ? c.render(row) : String(row[c.key] ?? ""))
              ),
            ),
          getKey,
        ),
      ]),
    ]),
    when(
      () => view().length === 0,
      (empty) => empty ? div({ class: emptyCss }, () => t("imp.empty")) : null,
    ),
    pageSize ? div({ class: tableFootCss }, pagination({ page, pages })) : null,
  ]);
}

const listCss = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  & > li {
    padding: var(--imp-space-12);
    border-block-end: 1px solid var(--imp-color-border);
  }
  & > li:last-child {
    border-block-end: none;
  }
`;

// listView({ items, render, getKey?, empty? }) — items: array or signal.
export function listView(
  {
    items = [],
    render = String,
    getKey = (it, i) => it?.id ?? i,
    empty,
    class: extra,
    ...rest
  } = {},
) {
  const list = typeof items === "function" ? items : () => items;
  return div({ ...rest, class: extra }, [
    when(
      () => list().length === 0,
      (isEmpty) =>
        isEmpty
          ? div({ class: emptyCss }, empty ?? (() => t("imp.empty")))
          : ul(
            { class: listCss },
            each(list, (item) => li(render(item)), getKey),
          ),
    ),
  ]);
}

const treeCss = css`
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--imp-font-size-sm);
  & ul {
    list-style: none;
    padding-inline-start: var(--imp-space-16);
    margin: 0;
  }
  & li > div {
    display: flex;
    align-items: center;
    gap: var(--imp-space-4);
    padding: var(--imp-space-4) var(--imp-space-8);
    border-radius: var(--imp-radius-sm);
    cursor: pointer;
  }
  & li > div:hover {
    background: var(--imp-color-surface-alt);
  }
`;
const twistyCss = css`
  display: inline-block;
  inline-size: 14px;
  color: var(--imp-color-text-muted);
  transition: rotate 0.1s;
  &[data-open="true"] {
    rotate: 90deg;
  }
`;

// tree({ nodes: [{ id, label, children? }], onSelect? })
export function tree({ nodes = [], onSelect, class: extra, ...rest } = {}) {
  const item = (node) => {
    const kids = node.children ?? [];
    const open = signal(false);
    return li([
      div({
        events: {
          click: () => {
            if (kids.length) open.update((o) => !o);
            onSelect?.(node);
          },
        },
      }, [
        span(
          { class: twistyCss, "data-open": () => String(open()) },
          kids.length ? "▸" : "",
        ),
        String(node.label),
      ]),
      kids.length ? when(open, (o) => o ? ul(kids.map(item)) : null) : null,
    ]);
  };
  return ul({ ...rest, class: cx(treeCss, extra) }, nodes.map(item));
}
