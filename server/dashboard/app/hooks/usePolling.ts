import { useEffect } from "react";
import { useFetcher } from "react-router";

export function usePolling<T>(url: string, intervalMs: number) {
  const fetcher = useFetcher<T>();

  useEffect(() => {
    const id = setInterval(() => {
      fetcher.load(url);
    }, intervalMs);
    return () => clearInterval(id);
  }, [url, intervalMs]);

  return { data: fetcher.data as T | undefined, reload: () => fetcher.load(url) };
}
