import Link from "next/link";
import SearchBox from "./SearchBox";

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
        <SearchBox initialSearch={initialSearch} />
      </div>
    </header>
  );
}
