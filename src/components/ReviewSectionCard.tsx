"use client";

import { useState } from "react";
import type { ReviewSection } from "@/lib/types";

interface ReviewSectionCardProps {
  title: string;
  section: ReviewSection;
  requiresReveal?: boolean; // برای بخش اسپویلردار، ابتدا مخفی نمایش داده می‌شود
}

// یک بخش از نقد (بدون اسپویل یا با اسپویل) شامل خلاصه، نکات مثبت/منفی و جمع‌بندی
export default function ReviewSectionCard({
  title,
  section,
  requiresReveal = false,
}: ReviewSectionCardProps) {
  const [revealed, setRevealed] = useState(!requiresReveal);
  const text = section.overview ?? section.analysis;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-base font-bold text-foreground">{title}</h3>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
        >
          نمایش نقد اسپویلردار (با احتیاط کلیک کنید)
        </button>
      ) : (
        <div className="flex flex-col gap-4">
          {text && (
            <p className="leading-relaxed text-foreground/90">{text}</p>
          )}

          {section.pros && section.pros.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-emerald-400">
                نکات مثبت
              </h4>
              <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
                {section.pros.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-emerald-400">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.cons && section.cons.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-rose-400">
                نکات منفی
              </h4>
              <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
                {section.cons.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-rose-400">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.verdict && (
            <div className="rounded-lg bg-surface-hover p-3">
              <h4 className="mb-1 text-sm font-semibold text-accent">
                جمع‌بندی
              </h4>
              <p className="text-sm leading-relaxed text-foreground/90">
                {section.verdict}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
