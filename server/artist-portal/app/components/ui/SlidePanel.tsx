import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function SlidePanel({ open, onClose, title, children, width = "w-80" }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-20"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed right-0 top-0 h-full ${width} bg-surface border-l border-border flex flex-col z-30 shadow-2xl`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold truncate pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors shrink-0 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
