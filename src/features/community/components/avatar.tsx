import { cn } from "@/lib/utils";

/** Deterministic gradient-initials avatar — no uploads, no broken images. */
export function CommunityAvatar({
  username,
  displayName,
  size = "md",
}: {
  username: string;
  displayName: string;
  size?: "sm" | "md" | "lg";
}) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs"
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 60% 45%), hsl(${(hue + 50) % 360} 65% 35%))`,
      }}
    >
      {initials || "T"}
    </span>
  );
}
