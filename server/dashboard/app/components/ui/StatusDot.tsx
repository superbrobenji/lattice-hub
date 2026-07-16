export type StatusVariant = "ok" | "warn" | "error" | "unknown";

interface StatusDotProps {
  variant: StatusVariant;
  size?: "sm" | "md";
}

const variantClasses: Record<StatusVariant, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-danger",
  unknown: "bg-muted",
};

const pulseClasses: Record<StatusVariant, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-danger",
  unknown: "",
};

export function StatusDot({ variant, size = "md" }: StatusDotProps) {
  const sizeClass = size === "sm" ? "size-2" : "size-2.5";
  return (
    <span className="relative inline-flex">
      <span
        className={`${sizeClass} rounded-full ${variantClasses[variant]} block`}
      />
      {variant === "ok" && (
        <span
          className={`absolute inset-0 rounded-full ${pulseClasses[variant]} animate-ping opacity-75`}
        />
      )}
    </span>
  );
}
