import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  search?: string;
}

function buildHref(page: number, search?: string) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

// کنترل صفحه‌بندی ساده (قبلی / بعدی + شماره صفحه)
export default function Pagination({ page, totalPages, search }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="mt-8 flex items-center justify-center gap-4 text-sm">
      {hasPrev ? (
        <Link
          href={buildHref(page - 1, search)}
          className="rounded-lg border border-border bg-surface px-4 py-2 hover:bg-surface-hover"
        >
          قبلی
        </Link>
      ) : (
        <span className="rounded-lg border border-border px-4 py-2 text-muted opacity-50">
          قبلی
        </span>
      )}

      <span className="text-muted">
        صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
      </span>

      {hasNext ? (
        <Link
          href={buildHref(page + 1, search)}
          className="rounded-lg border border-border bg-surface px-4 py-2 hover:bg-surface-hover"
        >
          بعدی
        </Link>
      ) : (
        <span className="rounded-lg border border-border px-4 py-2 text-muted opacity-50">
          بعدی
        </span>
      )}
    </nav>
  );
}
