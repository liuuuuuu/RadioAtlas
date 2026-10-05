"use client";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}

/**
 * Switch-style toggle. The old control was a raw `<input type="checkbox">`
 * with `accent-color`, which renders as a mismatched OS widget on Windows and
 * gives a 13px hit target. This keeps the semantics (`role="switch"`) but makes
 * the whole row clickable and keyboard operable.
 */
export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex h-11 items-center gap-2.5 rounded-xl border px-3.5 text-sm transition active:scale-[0.98] ${
        checked
          ? "border-accent/60 bg-accent/10 text-ink"
          : "border-line bg-surface-1 text-ink-muted hover:border-line/80 hover:text-ink"
      }`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${
          checked ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`absolute size-3 rounded-full bg-surface-0 transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="whitespace-nowrap">{label}</span>
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </button>
  );
}
