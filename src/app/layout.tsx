import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

// فونت فارسی وزیرمتن - از گوگل فونتز لود می‌شود (نیاز به اینترنت هنگام build/dev دارد)
const vazirmatn = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "آرشیو فیلم",
  description: "آرشیو شخصی فیلم‌ها با اطلاعات کامل و نقد",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
