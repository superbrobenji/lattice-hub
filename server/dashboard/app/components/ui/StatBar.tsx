interface StatBarProps {
  value: number;   // current value
  max: number;     // maximum value
  label: string;   // e.g. "CPU"
  unit?: string;   // e.g. "%" or "MB"
  formatValue?: (v: number) => string;
}

function defaultFormat(v: number) {
  return v.toFixed(1);
}

export function StatBar({ value, max, label, unit = "%", formatValue = defaultFormat }: StatBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor =
    pct > 85 ? "bg-danger" : pct > 65 ? "bg-warn" : "bg-accent";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>
          {formatValue(value)}{unit}
          {max > 0 && unit !== "%" && ` / ${formatValue(max)}${unit}`}
        </span>
      </div>
      <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
