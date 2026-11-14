// اتصال به دیتابیس MySQL با استفاده از connection pool
// این فایل فقط باید در سمت سرور (Server Components / Route Handlers) استفاده شود
import mysql from "mysql2/promise";

// در dev mode ماژول‌ها ممکن است دوباره لود شوند (hot reload)،
// پس pool را روی globalThis نگه می‌داریم تا هر بار connection جدید ساخته نشود.
declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "movies",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true, // تاریخ‌ها را به صورت رشته برمی‌گرداند تا مشکل timezone نداشته باشیم
    charset: "utf8mb4",
  });
}

// لاگ ساده برای دیباگ کردن اتصال دیتابیس
export function logDb(message: string, extra?: unknown) {
  const timestamp = new Date().toISOString();
  if (extra !== undefined) {
    console.log(`[DB ${timestamp}] ${message}`, extra);
  } else {
    console.log(`[DB ${timestamp}] ${message}`);
  }
}

const pool = global._mysqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  global._mysqlPool = pool;
}

export default pool;
