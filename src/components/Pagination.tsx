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

  // لاگ هشدار: صفحه‌ی درخواستی خارج از بازه است (مثلاً URL دستکاری‌شده)
  if (page > totalPages || page < 1) {
    console.warn(`[Pagination] page ${page} out of range 1..${totalPages}`);
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // استایل مشترک دکمه‌ها
  const base = "rounded-lg border px-4 py-2 transition-colors";
  const active = "border-border bg-surface hover:bg-surface-hover";
  const disabled = "cursor-not-allowed border-border text-muted opacity-40";

  // در RTL اولین عنصر سمت راست است: «قبلی» راست، «بعدی» چپ
  return (
    <nav
      aria-label="صفحه‌بندی"
      className="mt-10 flex items-center justify-center gap-3 text-sm"
    >
      {hasPrev ? (
        <Link href={buildHref(page - 1, search, sort)} className={`${base} ${active}`}>
          → قبلی
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} ${disabled}`}>
          → قبلی
        </span>
      )}

      <span className="px-2 text-muted">
        صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
      </span>

      {hasNext ? (
        <Link href={buildHref(page + 1, search, sort)} className={`${base} ${active}`}>
          بعدی ←
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} ${disabled}`}>
          بعدی ←
        </span>
      )}
    </nav>
  );
}
