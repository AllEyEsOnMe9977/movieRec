import Link from "next/link";
import SearchBox from "./SearchBox";
// Add near the top of src/components/SiteHeader.tsx:
import DbRefreshButton from "@/components/DbRefreshButton";

// هدر بالای سایت: عنوان + جستجو (راست) و دکمه همگام‌سازی (چپ)
// نکته: عمداً از backdrop-blur استفاده نشده، چون برای فرزندان fixed (مودال دکمه‌ی همگام‌سازی)
// یک containing block جدید می‌سازد و مودال را خراب می‌کند.
export default function SiteHeader({
  initialSearch,
}: {
  initialSearch?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      {/* کانتینر هم‌عرض با <main> تا هدر و محتوا هم‌تراز باشند */}
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* گروه سمت راست: عنوان سایت و باکس جستجو */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold">
            <span>🎬</span>
            <span>آرشیو فیلم</span>
          </Link>

          <SearchBox initialSearch={initialSearch} />
        </div>

        {/* دکمه همگام‌سازی دیتابیس در سمت چپ */}
        <DbRefreshButton />
      </div>
    </header>
  );
}
