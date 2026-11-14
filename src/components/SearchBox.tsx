"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface SearchBoxProps {
  initialSearch?: string;
}

// باکس جستجوی عنوان فیلم - با submit فرم، کاربر را به صفحه‌ی اصلی با query جدید هدایت می‌کند
export default function SearchBox({ initialSearch = "" }: SearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialSearch);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    router.push(trimmed ? `/?${params.toString()}` : "/");
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 max-w-md gap-2">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="جستجوی نام فیلم..."
        className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
      >
        جستجو
      </button>
    </form>
  );
}
