import { useEffect, useState } from "react";
import type { ContainerStats } from "~/types/containers";

export function useContainerStats(name: string, enabled = true) {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/stats/${name}`);
        if (!res.ok) throw new Error(`${res.status}`);
        setStats(await res.json());
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    };

    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, [name, enabled]);

  return { stats, error };
}
