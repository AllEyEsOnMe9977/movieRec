import type { MovieRow, Movie, ReviewData } from "./types";

// آدرس پایه‌ی تصاویر TMDB
// w500 برای پوستر (اندازه مناسب برای گرید) و w1280 برای بک‌دراپ استفاده می‌شود
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const POSTER_SIZE = "w500";
const BACKDROP_SIZE = "w1280";

export function buildPosterUrl(posterPath: string | null): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${POSTER_SIZE}${posterPath}`;
}

export function buildBackdropUrl(backdropPath: string | null): string | null {
  if (!backdropPath) return null;
  return `${TMDB_IMAGE_BASE}/${BACKDROP_SIZE}${backdropPath}`;
}

export function buildTrailerUrl(trailerKey: string | null): string | null {
  if (!trailerKey) return null;
  // trailer_key معمولاً یک YouTube video id است
  return `https://www.youtube.com/watch?v=${trailerKey}`;
}

// تبدیل رشته‌ی JSON ژانرها به آرایه‌ی امن (در صورت خطا آرایه خالی برمی‌گرداند)
function parseGenres(genresJson: string | null): string[] {
  if (!genresJson) return [];
  try {
    const parsed = JSON.parse(genresJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((g): g is string => typeof g === "string");
    }
    return [];
  } catch {
    return [];
  }
}

function extractYear(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const year = releaseDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

// تبدیل یک ردیف خام از دیتابیس به آبجکت Movie آماده برای UI
export function mapMovieRow(row: MovieRow): Movie {
  const trailerKey = row.trailer_key;
  return {
    id: row.id,
    title: row.title ?? row.original_title ?? "بدون عنوان",
    originalTitle: row.original_title,
    overview: row.overview,
    releaseDate: row.release_date,
    releaseYear: extractYear(row.release_date),
    posterUrl: buildPosterUrl(row.poster_path),
    backdropUrl: buildBackdropUrl(row.backdrop_path),
    voteAverage: row.vote_average !== null ? Number(row.vote_average) : null,
    imdbId: row.imdb_id,
    imdbRating: row.imdb_rating !== null ? Number(row.imdb_rating) : null,
    imdbVotes: row.imdb_votes,
    genres: parseGenres(row.genres),
    runtime: row.runtime,
    rottenTomatoes: row.rotten_tomatoes,
    metacritic: row.metacritic,
    trailerKey,
    trailerUrl: buildTrailerUrl(trailerKey),
  };
}

// پارس امن رشته‌ی JSON نقد؛ اگر خراب بود، متن خام را برمی‌گرداند تا چیزی گم نشود
export function parseReviewJson(raw: string | null): {
  data: ReviewData | null;
  raw: string | null;
} {
  if (!raw) return { data: null, raw: null };
  try {
    const parsed = JSON.parse(raw) as ReviewData;
    return { data: parsed, raw: null };
  } catch {
    return { data: null, raw };
  }
}
