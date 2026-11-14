import Link from "next/link";
import SearchBox from "./SearchBox";
// Add near the top of src/components/SiteHeader.tsx:
import DbRefreshButton from '@/components/DbRefreshButton';

// Add inside the header bar container alongside your existing title/search controls:
// هدر بالای سایت شامل عنوان و باکس جستجو
export default function SiteHeader({
  initialSearch,
}: {
  initialSearch?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
        {/* گروه سمت راست: عنوان سایت و باکس جستجو در ابتدای محور RTL */}
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold">
            <span>🎬</span>
            <span>آرشیو فیلم</span>
          </Link>

          <SearchBox initialSearch={initialSearch} />
        </div>

        {/* دکمه همگام‌سازی دیتابیس در سمت چپ */}
        <DbRefreshButton />
    </header>
  );
}
