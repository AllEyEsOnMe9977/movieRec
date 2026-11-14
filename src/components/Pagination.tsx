import Link from "next/link";
import type { SortOption } from "@/lib/types";

interface PaginationProps {
  page: number;
  totalPages: number;
  search?: string;
  sort?: SortOption;
}

function buildHref(page: number, search?: string, sort?: SortOption) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (sort && sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

// کنترل صفحه‌بندی ساده (قبلی / بعدی + شماره صفحه)
export default function Pagination({ page, totalPages, search, sort }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="mt-8 flex items-center justify-center gap-4 text-sm">
      {hasPrev ? (
        <Link
          href={buildHref(page + 1, search, sort)}
          className="rounded-lg border border-border bg-surface px-4 py-2 hover:bg-surface-hover"
        >
          قبلی
        </Link>
      ) : (
        <span className="rounded-lg border border-border px-4 py-2 text-muted opacity-50">
          بعدی
        </span>
      )}
    </nav>
  );
}
