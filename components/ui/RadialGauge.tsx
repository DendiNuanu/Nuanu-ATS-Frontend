import { cn } from "@/lib/utils";

type RadialGaugeProps = {
  value: number; // 0-100
  size?: number;
  label?: string;
  className?: string;
};

export function RadialGauge({
  value,
  size = 120,
  label,
  className,
}: RadialGaugeProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped >= 85 ? "#16a34a" : clamped >= 70 ? "#006b5f" : "#f59e0b";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900 font-heading">
          {clamped}%
        </span>
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
