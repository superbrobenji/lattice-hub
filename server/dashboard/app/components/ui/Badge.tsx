type BadgeVariant = "default" | "ok" | "warn" | "danger" | "accent" | "muted";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-elevated text-text",
  ok: "bg-ok/20 text-ok",
  warn: "bg-warn/20 text-warn",
  danger: "bg-danger/20 text-danger",
  accent: "bg-accent/20 text-accent",
  muted: "bg-elevated text-muted",
};

export function Badge({ label, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}
    >
      {label}
    </span>
  );
}

export function containerStateBadge(state: string): BadgeVariant {
  if (state === "running") return "ok";
  if (state === "exited" || state === "dead") return "danger";
  if (state === "paused" || state === "restarting") return "warn";
  return "muted";
}
