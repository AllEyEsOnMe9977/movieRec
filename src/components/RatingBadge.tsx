interface RatingBadgeProps {
  label: string;
  value: string;
  tone?: "gold" | "green" | "red" | "neutral";
}

const TONE_CLASSES: Record<NonNullable<RatingBadgeProps["tone"]>, string> = {
  gold: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  red: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  neutral: "bg-surface-hover text-muted border-border",
};

// یک نشان کوچک برای نمایش امتیازها (IMDb، TMDB، Rotten Tomatoes، Metacritic)
export default function RatingBadge({
  label,
  value,
  tone = "neutral",
}: RatingBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
