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

        {/* قرارگیری باکس مرتب‌سازی در سمت راست (ابتدای محور RTL) */}
        <div className="mb-4 flex flex-wrap items-center justify-start gap-4">
          <SortSelect currentSort={sort} />

          {search && (
            <p className="text-sm text-muted">
              نتایج جستجو برای «{search}» — {moviesResult.total.toLocaleString("fa-IR")}{" "}
              مورد
            </p>
          )}
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