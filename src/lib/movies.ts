import "server-only";
import type { RowDataPacket } from "mysql2";
import pool, { logDb } from "./db";
import { mapMovieRow, parseReviewJson } from "./mappers";
import { normalizeSortOption, type Movie, type MovieRow, type Review, type SortOption } from "./types";

const MOVIES_PER_PAGE = 16;

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

// عبارت‌های عددی امن: هر مقدار نامعتبر (N/A، خالی، صفر، متن) → NULL تا همیشه آخر لیست بیفتد
const NUM = {
  imdbRating:
    "NULLIF(CASE WHEN imdb_rating REGEXP '^[0-9]+([.][0-9]+)?$' THEN CAST(imdb_rating AS DECIMAL(4,2)) END, 0)",
  imdbVotes: "NULLIF(imdb_votes, 0)",
  voteAverage:
    "NULLIF(CASE WHEN vote_average REGEXP '^[0-9]+([.][0-9]+)?$' THEN CAST(vote_average AS DECIMAL(4,2)) END, 0)",
  rottenTomatoes:
    "CASE WHEN rotten_tomatoes REGEXP '^[0-9]+%?$' THEN CAST(REPLACE(rotten_tomatoes, '%', '') AS UNSIGNED) END",
  metacritic:
    "CASE WHEN metacritic REGEXP '^[0-9]+(/100)?$' THEN CAST(SUBSTRING_INDEX(metacritic, '/', 1) AS UNSIGNED) END",
  releaseDate: "NULLIF(release_date, '')",
  runtime: "NULLIF(runtime, 0)",
  sentAt: "sent_at",
} as const;

// سازنده‌ی ORDER BY قطعی (deterministic):
// 1) مقادیر NULL همیشه آخر  2) مرتب‌سازی اصلی  3) id به‌عنوان tiebreaker یکتا
// بدون مرحله‌ی 3، ردیف‌های هم‌ارزش بین صفحات جابجا می‌شوند (تکرار/گم‌شدن فیلم)
function buildOrderBy(
  expr: string,
  dir: "ASC" | "DESC",
  secondary?: string // مرتب‌سازی ثانویه‌ی نزولی (اختیاری)
): string {
  const parts = [`(${expr} IS NULL) ASC`, `${expr} ${dir}`];
  if (secondary) parts.push(`${secondary} DESC`);
  parts.push(`id ${dir}`);
  return parts.join(", ");
}

// نگاشت امن گزینه‌های مرتب‌سازی به عبارت ORDER BY (جلوگیری از SQL Injection)
const SORT_ORDER_BY: Record<SortOption, string> = {
  newest: buildOrderBy(NUM.sentAt, "DESC"),
  oldest: buildOrderBy(NUM.sentAt, "ASC"),
  imdb_rating: buildOrderBy(NUM.imdbRating, "DESC", NUM.imdbVotes),
  imdb_votes: buildOrderBy(NUM.imdbVotes, "DESC"),
  vote_average: buildOrderBy(NUM.voteAverage, "DESC"),
  rotten_tomatoes: buildOrderBy(NUM.rottenTomatoes, "DESC"),
  metacritic: buildOrderBy(NUM.metacritic, "DESC"),
  release_desc: buildOrderBy(NUM.releaseDate, "DESC"),
  release_asc: buildOrderBy(NUM.releaseDate, "ASC"),
  runtime_desc: buildOrderBy(NUM.runtime, "DESC"),
  runtime_asc: buildOrderBy(NUM.runtime, "ASC"),
  title_asc: "title ASC, id ASC",
};

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
  sort?: SortOption;
}): Promise<GetMoviesResult> {
  // شماره‌ی صفحه باید عدد صحیح ≥ 1 باشد (مثلاً ?page=1.5 یا ?page=abc نباید خطا بدهد)
  const requestedPage = Number.isFinite(params.page)
    ? Math.max(1, Math.floor(params.page as number))
    : 1;
  const search = params.search?.trim() ?? "";
  const sort = normalizeSortOption(params.sort);
  const orderBySql = SORT_ORDER_BY[sort];

  const whereClauses = [HAS_DATA_CONDITION];
  const whereParams: unknown[] = [];

  if (search) {
    whereClauses.push("(title LIKE ? OR original_title LIKE ?)");
    const likeTerm = `%${search}%`;
    whereParams.push(likeTerm, likeTerm);
  }

  const whereSql = whereClauses.join(" AND ");

  logDb("در حال گرفتن لیست فیلم‌ها", { page: requestedPage, search, sort, orderBy: orderBySql });

  try {
    const [countRows] = await pool.query<MovieCountRow[]>(
      `SELECT COUNT(*) AS total FROM movies WHERE ${whereSql}`,
      whereParams
    );
    const total = countRows[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / MOVIES_PER_PAGE));

    // اگر صفحه‌ی درخواستی بیشتر از آخرین صفحه باشد، به آخرین صفحه برمی‌گردیم (به‌جای گرید خالی)
    const page = Math.min(requestedPage, totalPages);
    if (page !== requestedPage) {
      logDb("صفحه‌ی درخواستی خارج از بازه بود و اصلاح شد", { requestedPage, page, totalPages });
    }
    const offset = (page - 1) * MOVIES_PER_PAGE;

    const [rows] = await pool.query<(MovieRow & RowDataPacket)[]>(
      `SELECT id, title, original_title, overview, release_date, poster_path,
              backdrop_path, vote_average, imdb_id, imdb_rating, imdb_votes,
              genres, runtime, sent_at, rotten_tomatoes, metacritic, trailer_key
       FROM movies
       WHERE ${whereSql}
       ORDER BY ${orderBySql}
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