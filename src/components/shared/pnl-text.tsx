import { cn, formatINR } from "@/lib/utils";

export function PnlText({
  value,
  className,
  // Money is never rounded away — brokers bill in paise, we show paise.
  decimals = true,
  signed = true,
}: {
  value: number;
  className?: string;
  decimals?: boolean;
  signed?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-money",
        value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted",
        className
      )}
    >
      {formatINR(value, { decimals, signed })}
    </span>
  );
}
