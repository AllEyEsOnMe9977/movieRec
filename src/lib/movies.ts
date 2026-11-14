import "server-only";
import type { RowDataPacket } from "mysql2";
import pool, { logDb } from "./db";
import { mapMovieRow, parseReviewJson } from "./mappers";
import type { Movie, MovieRow, Review } from "./types";

const MOVIES_PER_PAGE = 24;

interface MovieCountRow extends RowDataPacket {
  total: number;
}

interface ReviewRow extends RowDataPacket {
  movie_id: number;
  review: string | null;
  created_at: string | null;
}

// فقط فیلم‌هایی که واقعاً داده دارند (خیلی از ردیف‌های دیتابیس فقط id هستند و بقیه NULL)
const HAS_DATA_CONDITION = "title IS NOT NULL";

export interface GetMoviesResult {
  movies: Movie[];
  total: number;
  page: number;
  totalPages: number;
}

// گرفتن لیست فیلم‌ها با صفحه‌بندی و جستجوی اختیاری روی عنوان
export async function getMovies(params: {
  page?: number;
  search?: string;
}): Promise<GetMoviesResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const offset = (page - 1) * MOVIES_PER_PAGE;

  const whereClauses = [HAS_DATA_CONDITION];
  const whereParams: unknown[] = [];

  if (search) {
    whereClauses.push("(title LIKE ? OR original_title LIKE ?)");
    const likeTerm = `%${search}%`;
    whereParams.push(likeTerm, likeTerm);
  }

  const whereSql = whereClauses.join(" AND ");

  logDb("در حال گرفتن لیست فیلم‌ها", { page, search });

  try {
    const [countRows] = await pool.query<MovieCountRow[]>(
      `SELECT COUNT(*) AS total FROM movies WHERE ${whereSql}`,
      whereParams
    );
    const total = countRows[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / MOVIES_PER_PAGE));

    const [rows] = await pool.query<(MovieRow & RowDataPacket)[]>(
      `SELECT id, title, original_title, overview, release_date, poster_path,
              backdrop_path, vote_average, imdb_id, imdb_rating, imdb_votes,
              genres, runtime, sent_at, rotten_tomatoes, metacritic, trailer_key
       FROM movies
       WHERE ${whereSql}
       ORDER BY sent_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, MOVIES_PER_PAGE, offset]
    );

    logDb(`تعداد ${rows.length} فیلم دریافت شد (از مجموع ${total})`);

    return {
      movies: rows.map(mapMovieRow),
      total,
      page,
      totalPages,
    };
  } catch (error) {
    logDb("خطا در گرفتن لیست فیلم‌ها", error);
    throw error;
  }
}

// گرفتن یک فیلم به همراه نقد آن بر اساس id
export async function getMovieById(
  id: number
): Promise<{ movie: Movie | null; review: Review | null }> {
  logDb("در حال گرفتن جزئیات فیلم", { id });

  try {
    const [movieRows] = await pool.query<(MovieRow & RowDataPacket)[]>(
      `SELECT id, title, original_title, overview, release_date, poster_path,
              backdrop_path, vote_average, imdb_id, imdb_rating, imdb_votes,
              genres, runtime, sent_at, rotten_tomatoes, metacritic, trailer_key
       FROM movies
       WHERE id = ? AND ${HAS_DATA_CONDITION}
       LIMIT 1`,
      [id]
    );

    if (movieRows.length === 0) {
      logDb("فیلمی با این id پیدا نشد", { id });
      return { movie: null, review: null };
    }

    const movie = mapMovieRow(movieRows[0]);

    const [reviewRows] = await pool.query<ReviewRow[]>(
      `SELECT movie_id, review, created_at FROM reviews WHERE movie_id = ? LIMIT 1`,
      [id]
    );

    let review: Review | null = null;
    if (reviewRows.length > 0) {
      const { data, raw } = parseReviewJson(reviewRows[0].review);
      review = {
        movieId: reviewRows[0].movie_id,
        createdAt: reviewRows[0].created_at,
        data,
        raw,
      };
    }

    logDb("جزئیات فیلم با موفقیت دریافت شد", { id, hasReview: !!review });

    return { movie, review };
  } catch (error) {
    logDb("خطا در گرفتن جزئیات فیلم", error);
    throw error;
  }
}

// تست ساده‌ی اتصال دیتابیس - برای صفحه‌ی وضعیت استفاده می‌شود
export async function testDbConnection(): Promise<{
  ok: boolean;
  message: string;
  movieCount?: number;
}> {
  try {
    const [rows] = await pool.query<MovieCountRow[]>(
      `SELECT COUNT(*) AS total FROM movies WHERE ${HAS_DATA_CONDITION}`
    );
    const count = rows[0]?.total ?? 0;
    logDb("اتصال دیتابیس موفق بود", { count });
    return {
      ok: true,
      message: "اتصال به دیتابیس با موفقیت انجام شد.",
      movieCount: count,
    };
  } catch (error) {
    logDb("اتصال دیتابیس ناموفق بود", error);
    const message = error instanceof Error ? error.message : "خطای ناشناخته";
    return { ok: false, message };
  }
}

export { MOVIES_PER_PAGE };
