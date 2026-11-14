interface DbStatusBannerProps {
  ok: boolean;
  message: string;
  movieCount?: number;
}

// نوار وضعیت اتصال دیتابیس - برای فاز اول که فقط باید صحت اتصال و دریافت داده را تایید کنیم
export default function DbStatusBanner({
  ok,
  message,
  movieCount,
}: DbStatusBannerProps) {
  return (
    <div
      className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
    >
      {ok ? (
        <span>
          ✅ اتصال به دیتابیس برقرار است — تعداد فیلم‌های دارای اطلاعات:{" "}
          <strong>{(movieCount ?? 0).toLocaleString("fa-IR")}</strong>
        </span>
      ) : (
        <span>❌ خطا در اتصال به دیتابیس: {message}</span>
      )}
    </div>
  );
}
