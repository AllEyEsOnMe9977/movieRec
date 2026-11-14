import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/lib/types";

interface MovieCardProps {
  movie: Movie;
}

// فرمت فشرده‌ی تعداد رأی (مثلاً ۱.۲ میلیون) - یک بار ساخته می‌شود
const votesFormatter = new Intl.NumberFormat("fa-IR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// امتیاز عددی معتبر: null، NaN (مثل "N/A") و صفر (یعنی «امتیازی ثبت نشده») حذف می‌شوند
function isValidScore(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

// امتیاز متنی معتبر (Rotten Tomatoes / Metacritic): مقدار خالی یا "N/A" حذف می‌شود
function cleanText(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A") return null;
  return trimmed;
}

// یک نشان کوچک امتیاز برای کارت
interface ScoreChip {
  key: string;
  text: string;
  title: string; // توضیح هنگام hover
  className: string;
}

// ساخت لیست نشان‌های امتیاز؛ فقط مواردی که داده‌ی معتبر دارند اضافه می‌شوند
function buildScoreChips(movie: Movie): ScoreChip[] {
  const chips: ScoreChip[] = [];

  // امتیاز TMDB
  if (isValidScore(movie.voteAverage)) {
    chips.push({
      key: "tmdb",
      text: `TMDB ${movie.voteAverage.toFixed(1)}`,
      title: "امتیاز TMDB",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    });
  }

  // امتیاز Rotten Tomatoes (مثلاً 87%)
  const rt = cleanText(movie.rottenTomatoes);
  if (rt) {
    chips.push({
      key: "rt",
      text: `🍅 ${rt}`,
      title: "امتیاز Rotten Tomatoes",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    });
  }

  // امتیاز Metacritic (مثلاً 75/100 → فقط 75 نمایش داده می‌شود)
  const mc = cleanText(movie.metacritic);
  if (mc) {
    chips.push({
      key: "mc",
      text: `MC ${mc.split("/")[0]}`,
      title: "امتیاز Metacritic",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    });
  }

  // تعداد رأی‌های IMDb
  const votes = Number(movie.imdbVotes);
  if (Number.isFinite(votes) && votes > 0) {
    chips.push({
      key: "votes",
      text: `👥 ${votesFormatter.format(votes)}`,
      title: "تعداد رأی IMDb",
      className: "border-border bg-surface-hover text-muted",
    });
  }

  return chips;
}

// کارت نمایش یک فیلم در گرید اصلی
export default function MovieCard({ movie }: MovieCardProps) {
  // هشدار لاگ: امتیاز IMDb در دیتابیس عدد نیست (مثلاً "N/A")؛ نشان آن نمایش داده نمی‌شود
  if (movie.imdbRating !== null && !Number.isFinite(movie.imdbRating)) {
    console.warn(`[MovieCard] invalid imdbRating for movie ${movie.id}`);
  }

  const showImdb = isValidScore(movie.imdbRating);
  const chips = buildScoreChips(movie);

  return (
    <Link
      href={`/movies/${movie.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent/50 hover:bg-surface-hover"
    >
      <div className="relative aspect-[2/3] w-full bg-surface-hover">
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={movie.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm text-muted">
            بدون پوستر
          </div>
        )}

        {/* نشان اصلی: امتیاز IMDb روی پوستر */}
        {showImdb && (
          <div
            title="امتیاز IMDb"
            className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-amber-400 backdrop-blur"
          >
            ★ {movie.imdbRating!.toFixed(1)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {movie.title}
        </h3>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {/* سال و مدت زمان */}
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{movie.releaseYear ?? "—"}</span>
            {movie.runtime && <span>{movie.runtime} دقیقه</span>}
          </div>

          {/* سایر امتیازها و تعداد رأی (فقط در صورت وجود داده) */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  title={chip.title}
                  dir="ltr"
                  className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight ${chip.className}`}
                >
                  {chip.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}