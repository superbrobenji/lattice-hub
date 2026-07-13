import { Link, useFetcher } from "react-router";
import { Badge, containerStateBadge } from "~/components/ui/Badge";
import type { ContainerInfo } from "~/types/containers";

interface ContainerRowProps {
  container: ContainerInfo;
}

export function ContainerRow({ container }: ContainerRowProps) {
  const fetcher = useFetcher();
  const name = container.names[0]?.replace("/", "") ?? container.id;
  const isRestarting = fetcher.state !== "idle";

  const handleRestart = () => {
    if (!confirm(`Restart ${name}?`)) return;
    fetcher.submit(null, {
      method: "post",
      action: `/infrastructure/${name}/restart`,
    });
  };

  return (
    <tr className="border-b border-border bg-surface hover:bg-elevated transition-colors">
      <td className="px-4 py-3">
        <Link
          to={`/infrastructure/${name}`}
          className="font-mono text-sm text-accent hover:underline"
        >
          {name}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-muted font-mono truncate max-w-[200px]">
        {container.image}
      </td>
      <td className="px-4 py-3">
        <Badge label={container.state} variant={containerStateBadge(container.state)} />
      </td>
      <td className="px-4 py-3 text-sm text-muted">{container.status}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/infrastructure/${name}`}
            className="text-xs text-accent hover:underline"
          >
            Detail
          </Link>
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            className="text-xs text-muted hover:text-danger transition-colors disabled:opacity-50"
          >
            {isRestarting ? "…" : "Restart"}
          </button>
        </div>
      </td>
    </tr>
  );
}
