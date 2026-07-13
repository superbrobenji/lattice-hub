import { useEffect, useState } from "react";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "API Reference — Lattice Artist Portal" },
];

export default function ApiDocsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">API Reference</h1>
      {mounted ? <SwaggerWrapper /> : (
        <div className="h-96 bg-surface rounded-lg border border-border animate-pulse" />
      )}
    </div>
  );
}

function SwaggerWrapper() {
  const [SwaggerUI, setSwaggerUI] =
    useState<React.ComponentType<{ url: string }> | null>(null);

  useEffect(() => {
    import("swagger-ui-react").then((m) => {
      setSwaggerUI(() => m.default);
    });
  }, []);

  if (!SwaggerUI) return null;

  return (
    <div className="swagger-wrapper bg-white rounded-lg overflow-hidden">
      <SwaggerUI url="/openapi/v1.yaml" />
    </div>
  );
}
