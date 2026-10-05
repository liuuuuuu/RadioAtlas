"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional right-aligned hint, e.g. a station count. */
  hint?: string;
}

export interface SelectProps {
  /** Accessible name; also rendered as a small caption above the control. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  /** When false the placeholder is not offered as a choice. */
  allowEmpty?: boolean;
}

/**
 * A listbox built from scratch.
 *
 * Native `<select>` popups are drawn by the OS and ignore our dark theme — on
 * Windows they render as a light panel with unreadable contrast, which was the
 * most jarring part of the old filter bar. This implements the ARIA combobox +
 * listbox pattern so keyboard and screen-reader behaviour is preserved:
 * Enter/Space/Arrow to open, Arrow/Home/End to move, Enter to commit, Escape to
 * dismiss, click-outside to close.
 */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = true,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const baseId = useId();

  const items = useMemo<SelectOption[]>(
    () => (allowEmpty ? [{ value: "", label: placeholder }, ...options] : options),
    [allowEmpty, options, placeholder],
  );

  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const selected = items[selectedIndex];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openAt = useCallback(
    (index: number) => {
      setActiveIndex(Math.min(Math.max(index, 0), items.length - 1));
      setOpen(true);
    },
    [items.length],
  );

  const commit = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      onChange(item.value);
      setOpen(false);
    },
    [items, onChange],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openAt(selectedIndex);
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, items.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      default:
        break;
    }
  };

  const isPlaceholder = !value;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${baseId}-list`}
        aria-activedescendant={open ? `${baseId}-opt-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={handleKeyDown}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-left text-sm transition ${
          open
            ? "border-accent/70 bg-surface-2"
            : "border-line bg-surface-1 hover:border-line/80 hover:bg-surface-2"
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-wider text-ink-muted">{label}</span>
          <span className={`block truncate ${isPlaceholder ? "text-ink-muted" : "text-ink"}`}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${baseId}-list`}
          role="listbox"
          aria-label={label}
          className="absolute z-40 mt-1.5 max-h-72 w-full min-w-[200px] overflow-y-auto rounded-xl border border-line bg-surface-1 p-1 shadow-2xl"
        >
          {items.map((item, index) => {
            const isSelected = item.value === value;
            const isActive = index === activeIndex;

            return (
              <li
                key={item.value || "__all__"}
                id={`${baseId}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition ${
                  isActive ? "bg-surface-2 text-ink" : "text-ink-muted"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {item.hint && (
                    <span className="text-[11px] tabular-nums text-ink-muted">{item.hint}</span>
                  )}
                  {isSelected && <CheckIcon />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-4 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-accent">
      <path d="M9.6 17.2 4.4 12l1.4-1.4 3.8 3.8 8.6-8.6L19.6 7z" />
    </svg>
  );
}
