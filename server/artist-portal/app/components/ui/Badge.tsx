import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  variant?: "default" | "type" | "zone";
}

const variantMap = {
  default: "bg-elevated text-muted",
  type: "bg-elevated text-accent border border-accent/30",
  zone: "bg-elevated text-muted border border-border",
};

export function Badge({ children, variant = "default" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantMap[variant]}`}
    >
      {children}
    </span>
  );
}
