import { cn } from '../../lib/utils.js';
import { EmptyState } from './Avatar.jsx';
import { SkeletonRows } from './Skeleton.jsx';

/**
 * Lightweight table used across dashboards.
 * columns: [{ key, header, render?, className?, align?, hideBelow? }]
 */
export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  empty,
  onRowClick,
  rowKey = (row, index) => row.id ?? index,
  className,
  tableClassName,
}) {
  return (
    <div className={cn('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className={cn('table-base', tableClassName)}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideBelow === 'sm' && 'hidden sm:table-cell',
                    col.hideBelow === 'md' && 'hidden md:table-cell',
                    col.hideBelow === 'lg' && 'hidden lg:table-cell',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <SkeletonRows rows={5} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {empty ?? (
                    <EmptyState
                      title="Nothing here yet"
                      description="Records will appear here as soon as they are created."
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.hideBelow === 'sm' && 'hidden sm:table-cell',
                        col.hideBelow === 'md' && 'hidden md:table-cell',
                        col.hideBelow === 'lg' && 'hidden lg:table-cell',
                        col.className,
                      )}
                    >
                      {col.render ? col.render(row, index) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TableToolbar({ children, className }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TablePagination({ page, pageCount, total, onPageChange, className }) {
  if (pageCount <= 1) return null;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12.5px] text-ink-500',
        className,
      )}
    >
      <span>
        Page {page} of {pageCount} · {total} records
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-line px-2.5 py-1 font-medium transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="rounded-md border border-line px-2.5 py-1 font-medium transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
