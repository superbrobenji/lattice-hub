import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InlineEdit({ value, onSave, disabled, placeholder }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Keep draft in sync when value changes externally (e.g. after save + refresh)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="bg-elevated border border-accent/50 rounded px-2 py-0.5 text-sm text-white w-full focus:outline-none focus:border-accent"
      />
    );
  }

  return (
    <button
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className="text-sm text-white text-left truncate w-full hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-default"
    >
      {value || <span className="text-muted">{placeholder ?? "click to edit"}</span>}
    </button>
  );
}
