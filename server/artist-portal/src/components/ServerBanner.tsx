export function ServerBanner({ online }: { online: boolean | null }) {
  if (online === null) return <div className="banner loading">Connecting to server...</div>;
  if (!online) return <div className="banner error">Server offline — showing last known state</div>;
  return null;
}
