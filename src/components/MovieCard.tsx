import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/lib/types";

interface MovieCardProps {
  movie: Movie;
}

// کارت نمایش یک فیلم در گرید اصلی
export default function MovieCard({ movie }: MovieCardProps) {
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

        {movie.imdbRating !== null && (
          <div className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-amber-400 backdrop-blur">
            {movie.imdbRating.toFixed(1)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {movie.title}
        </h3>
        <div className="mt-auto flex items-center justify-between text-xs text-muted">
          <span>{movie.releaseYear ?? "—"}</span>
          {movie.runtime && <span>{movie.runtime} دقیقه</span>}
        </div>
      </div>
    </Link>
  );
}
