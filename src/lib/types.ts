// نوع داده‌ی خام یک ردیف از جدول movies (همانطور که از mysql2 برمی‌گردد)
export interface MovieRow {
  id: number;
  title: string | null;
  original_title: string | null;
  overview: string | null;
  release_date: string | null; // YYYY-MM-DD (dateStrings: true در db.ts)
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: string | null; // decimal از mysql2 به صورت string می‌آید
  imdb_id: string | null;
  imdb_rating: string | null;
  imdb_votes: number | null;
  genres: string | null; // JSON string مثل ["Drama","Action"]
  runtime: number | null;
  sent_at: string | null;
  rotten_tomatoes: string | null;
  metacritic: string | null;
  trailer_key: string | null;
}

// نوع پردازش‌شده و آماده برای نمایش در UI
export interface Movie {
  id: number;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  releaseDate: string | null;
  releaseYear: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  imdbId: string | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  genres: string[];
  runtime: number | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
  trailerKey: string | null;
  trailerUrl: string | null;
}

// ساختار JSON داخل ستون reviews.review (بر اساس نمونه‌های موجود در دیتابیس)
export interface ReviewSection {
  overview?: string;
  analysis?: string;
  pros?: string[];
  cons?: string[];
  verdict?: string;
}

export interface ReviewData {
  title?: string;
  persianTitle?: string;
  posterUrl?: string | null;
  imdbRating?: string | null;
  spoilerFree?: ReviewSection;
  spoilers?: ReviewSection;
}

export interface Review {
  movieId: number;
  createdAt: string | null;
  data: ReviewData | null;
  raw: string | null; // اگر JSON parse نشد، متن خام را نگه می‌داریم
}
