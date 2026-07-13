interface Props {
  status: "ok" | "error" | "warn";
  size?: "sm" | "md";
}

const colorMap = {
  ok: "bg-ok",
  error: "bg-danger",
  warn: "bg-warn",
};

const sizeMap = { sm: "size-2", md: "size-3" };

export function StatusDot({ status, size = "md" }: Props) {
  return (
    <span
      className={`inline-block rounded-full ${colorMap[status]} ${sizeMap[size]} ${
        status === "ok" ? "animate-pulse" : ""
      }`}
    />
  );
}
