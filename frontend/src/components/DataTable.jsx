import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from './ui';

/**
 * Searchable, sortable, paginated table.
 * columns: [{ key, label, render?(row), sortValue?(row), sortable?, className? }]
 * filters: extra controls rendered in the filter bar
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  searchKeys,
  searchPlaceholder = 'Search…',
  filters,
  pageSize = 10,
  initialSort,
  empty = { title: 'No records found' },
  toolbarRight,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const keys = searchKeys || columns.map((c) => c.key);
    return rows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
  }, [rows, query, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const get = col?.sortValue || ((r) => r[sort.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      const da = Date.parse(va);
      const db = Date.parse(vb);
      if (typeof va === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(va) && !Number.isNaN(da) && !Number.isNaN(db)) return (da - db) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  useEffect(() => { setPage(1); }, [query, rows.length]);
  const visible = sorted.slice((page - 1) * size, page * size);

  const toggleSort = (key) => {
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  return (
    <>
      <div className="filters">
        <div className="search input-icon">
          <Search size={15} />
          <input className="input" type="search" placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search table" />
        </div>
        {filters}
        {toolbarRight && <><div className="spacer" />{toolbarRight}</>}
      </div>
      {sorted.length === 0 ? (
        <EmptyState {...(query ? { title: 'No matches', message: `Nothing matches “${query}”. Try a different search or clear the filters.` } : empty)} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((c) => {
                    const sortable = c.sortable !== false && c.key && !c.key.startsWith('_');
                    const active = sort?.key === c.key;
                    return (
                      <th
                        key={c.key || c.label}
                        className={`${sortable ? 'sortable' : ''} ${c.className || ''}`}
                        onClick={sortable ? () => toggleSort(c.key) : undefined}
                        onKeyDown={sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(c.key); } } : undefined}
                        tabIndex={sortable ? 0 : undefined}
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        scope="col"
                      >
                        {c.label}
                        {sortable && (
                          <span className="sort">
                            {active ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={rowKey ? r[rowKey] : i}>
                    {columns.map((c) => (
                      <td key={c.key || c.label} className={c.className || ''}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span>
              Showing {(page - 1) * size + 1}–{Math.min(page * size, sorted.length)} of {sorted.length}
              {sorted.length !== rows.length && ` (filtered from ${rows.length})`}
            </span>
            <div className="row">
              <label className="row small" style={{ gap: 6 }}>
                Rows
                <select className="select" style={{ height: 30, width: 70 }} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-secondary btn-sm icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
              <span className="num">Page {page} / {pages}</span>
              <button type="button" className="btn btn-secondary btn-sm icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
