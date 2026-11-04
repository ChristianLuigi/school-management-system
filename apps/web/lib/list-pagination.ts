export const LIST_PAGE_SIZE = 10;

export function paginateItems<T>(items: readonly T[], requestedPage: number, pageSize = LIST_PAGE_SIZE) {
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.max(1, Math.floor(pageSize)) : LIST_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(0, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0), pages - 1);
  const offset = page * size;
  return { items: items.slice(offset, offset + size), page, pages, total: items.length,
    start: items.length ? offset + 1 : 0, end: Math.min(offset + size, items.length), hasNext: page < pages - 1 };
}
