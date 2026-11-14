import DbStatusBanner from "@/components/DbStatusBanner";
import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import SiteHeader from "@/components/SiteHeader";
import SortSelect from "@/components/SortSelect";
import { getMovies, testDbConnection } from "@/lib/movies";
import { normalizeSortOption } from "@/lib/types";

// این صفحه سمت سرور رندر می‌شود (Server Component) و مستقیم از دیتابیس داده می‌خواند
export default async function HomePage({
  searchParams,
}: PageProps<"/">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const pageParam = typeof params.page === "string" ? params.page : "1";
  const page = Number.isFinite(Number(pageParam)) ? Number(pageParam) : 1;
  const sort = normalizeSortOption(typeof params.sort === "string" ? params.sort : undefined);

  const [dbStatus, moviesResult] = await Promise.all([
    testDbConnection(),
    getMovies({ page, search, sort }),
  ]);

  return (
    <>
      <SiteHeader initialSearch={search} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <DbStatusBanner
          ok={dbStatus.ok}
          message={dbStatus.message}
          movieCount={dbStatus.movieCount}
        />

        {/* نوار ابزار: تعداد نتایج (راست) و مرتب‌سازی (چپ) */}
        {/* نوار ابزار چسبان: زیر هدر ثابت می‌ماند (top-16 ≈ ارتفاع هدر) */}
        <div className="sticky top-16 z-10 -mx-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
          <p className="text-sm text-muted">
            {search ? <>نتایج «{search}» — </> : null}
            {moviesResult.total.toLocaleString("fa-IR")} فیلم
          </p>

          <SortSelect currentSort={sort} />
        </div>

        <MovieGrid movies={moviesResult.movies} />

        <Pagination
          page={moviesResult.page}
          totalPages={moviesResult.totalPages}
          search={search}
          sort={sort}
        />
      </main>
    </>
  );
}