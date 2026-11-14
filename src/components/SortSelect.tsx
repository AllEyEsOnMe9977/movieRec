"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SORT_OPTIONS, type SortOption } from "@/lib/types";

interface SortSelectProps {
  currentSort: SortOption;
}

export default function SortSelect({ currentSort }: SortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSortChange = (nextSort: SortOption) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextSort === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", nextSort);
    }

    // بازگشت به صفحه اول هنگام تغییر مرتب‌سازی
    params.delete("page");

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : "/");
    });
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="movie-sort" className="whitespace-nowrap text-muted">
        مرتب‌سازی:
      </label>
      <select
        id="movie-sort"
        value={currentSort}
        disabled={isPending}
        onChange={(e) => handleSortChange(e.target.value as SortOption)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none transition hover:bg-surface-hover focus:border-accent disabled:opacity-60"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}