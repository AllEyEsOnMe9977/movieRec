import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import RatingBadge from "@/components/RatingBadge";
import ReviewSectionCard from "@/components/ReviewSectionCard";
import SiteHeader from "@/components/SiteHeader";
import { getMovieById } from "@/lib/movies";

// صفحه‌ی جزئیات یک فیلم به همراه نقد (در صورت وجود)
export default async function MovieDetailPage({
  params,
}: PageProps<"/movies/[id]">) {
  const { id } = await params;
  const movieId = Number(id);

  if (!Number.isFinite(movieId)) {
    notFound();
  }

  const { movie, review } = await getMovieById(movieId);

  if (!movie) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        {/* بک‌دراپ پس‌زمینه - فقط جنبه‌ی تزئینی دارد و روی هدر یا عنوان اورلپ نمی‌شود */}
        {movie.backdropUrl && (
          <div className="absolute inset-x-0 top-0 -z-10 h-96 w-full overflow-hidden sm:h-[32rem]">
            <Image
              src={movie.backdropUrl}
              alt=""
              fill
              priority
              className="object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background" />
          </div>
        )}

        <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6">
          <Link
            href="/"
            className="mb-6 inline-block text-sm text-muted hover:text-foreground"
          >
            ← بازگشت به لیست فیلم‌ها
          </Link>

          <div className="flex flex-col gap-6 sm:flex-row">
            {/* پوستر */}
            <div className="relative mx-auto aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-xl border border-border bg-surface shadow-lg sm:mx-0">
              {movie.posterUrl ? (
                <Image
                  src={movie.posterUrl}
                  alt={movie.title}
                  fill
                  sizes="192px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted">
                  بدون پوستر
                </div>
              )}
            </div>

            {/* اطلاعات اصلی */}
            <div className="flex flex-1 flex-col gap-3">
              <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                {movie.title}
              </h1>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="text-sm text-muted">{movie.originalTitle}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
                {movie.releaseYear && <span>{movie.releaseYear}</span>}
                {movie.runtime && (
                  <>
                    <span>•</span>
                    <span>{movie.runtime} دقیقه</span>
                  </>
                )}
                {movie.genres.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{movie.genres.join("، ")}</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {movie.imdbRating !== null && (
                  <RatingBadge
                    label="IMDb"
                    value={movie.imdbRating.toFixed(1)}
                    tone="gold"
                  />
                )}
                {movie.voteAverage !== null && (
                  <RatingBadge
                    label="TMDB"
                    value={movie.voteAverage.toFixed(1)}
                    tone="neutral"
                  />
                )}
                {movie.rottenTomatoes && (
                  <RatingBadge
                    label="Rotten Tomatoes"
                    value={movie.rottenTomatoes}
                    tone="red"
                  />
                )}
                {movie.metacritic && (
                  <RatingBadge
                    label="Metacritic"
                    value={movie.metacritic}
                    tone="green"
                  />
                )}
                {movie.imdbVotes !== null && (
                  <RatingBadge
                    label="تعداد رأی IMDb"
                    value={movie.imdbVotes.toLocaleString("fa-IR")}
                    tone="neutral"
                  />
                )}
              </div>

              {movie.overview && (
                <p className="leading-relaxed text-foreground/90">
                  {movie.overview}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {movie.trailerUrl && (
                  <a
                    href={movie.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
                  >
                    ▶ تماشای تریلر
                  </a>
                )}
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-hover"
                  >
                    صفحه IMDb
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* نقد فیلم */}
          {review?.data && (
            <div className="mt-10 flex flex-col gap-6">
              <h2 className="text-xl font-bold text-foreground">نقد فیلم</h2>
              {review.data.spoilerFree && (
                <ReviewSectionCard
                  title="نقد بدون اسپویل"
                  section={review.data.spoilerFree}
                />
              )}
              {review.data.spoilers && (
                <ReviewSectionCard
                  title="نقد کامل (شامل اسپویل)"
                  section={review.data.spoilers}
                  requiresReveal
                />
              )}
            </div>
          )}

          {/* اگر review خام بود (JSON نامعتبر) به صورت متن ساده نشان بده */}
          {review?.raw && (
            <div className="mt-10 rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-xl font-bold text-foreground">نقد فیلم</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {review.raw}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}