import type { Movie } from "@/lib/types";
import MovieCard from "./MovieCard";

interface MovieGridProps {
  movies: Movie[];
}

// گرید ریسپانسیو برای نمایش لیست فیلم‌ها
export default function MovieGrid({ movies }: MovieGridProps) {
  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-20 text-muted">
        <p className="text-lg font-medium">فیلمی پیدا نشد</p>
        <p className="text-sm">عبارت جستجو را تغییر دهید یا فیلتر را پاک کنید.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}
