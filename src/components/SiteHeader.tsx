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
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-lg font-bold text-foreground">
          🎬 آرشیو فیلم
        </Link>
        <DbRefreshButton />
        <SearchBox initialSearch={initialSearch} />
      </div>
    </header>
  );
}
