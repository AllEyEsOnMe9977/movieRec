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
  // در حالت سالم چیزی نمایش نمی‌دهیم تا صفحه تمیز بماند
  if (ok) return null;

  // لاگ خطای اتصال در سرور
  console.error(`[DbStatusBanner] DB connection failed: ${message}`);

  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      ❌ خطا در اتصال به دیتابیس: {message}
    </div>
  );
}
