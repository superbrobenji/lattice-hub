import { useFetcher } from "react-router";
import { StatusDot } from "~/components/ui/StatusDot";
import { Badge, containerStateBadge } from "~/components/ui/Badge";
import type { ServiceHealth } from "~/types/health";
import { deriveStatus } from "~/types/health";

interface ServiceCardProps {
  service: ServiceHealth;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const fetcher = useFetcher();
  const status = deriveStatus(service);
  const isRestarting = fetcher.state !== "idle";

  const handleRestart = () => {
    if (!confirm(`Restart ${service.name}?`)) return;
    fetcher.submit(null, {
      method: "post",
      action: `/infrastructure/${service.name}/restart`,
    });
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot variant={status} />
          <span className="font-medium text-text text-sm">{service.name}</span>
        </div>
        <Badge
          label={service.dockerState}
          variant={containerStateBadge(service.dockerState)}
        />
      </div>

      <div className="space-y-1 text-xs text-muted">
        {service.httpStatus !== undefined && (
          <div className="flex justify-between">
            <span>HTTP</span>
            <span className={service.httpStatus < 400 ? "text-ok" : "text-danger"}>
              {service.httpStatus} · {service.latencyMs}ms
            </span>
          </div>
        )}
        {service.dockerHealth !== "none" && service.dockerHealth !== "unknown" && (
          <div className="flex justify-between">
            <span>Health</span>
            <span>{service.dockerHealth}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Checked</span>
          <span>{new Date(service.checkedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      <button
        onClick={handleRestart}
        disabled={isRestarting}
        className="w-full py-1.5 text-xs rounded border border-border text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
      >
        {isRestarting ? "Restarting…" : "Restart"}
      </button>
    </div>
  );
}
