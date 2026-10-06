"use client";

import { useEffect, useRef, useState } from "react";

export interface ShareButtonProps {
  /** Page title, used for the share sheet and the copied text. */
  title: string;
  /** Path to share, e.g. `/station/<uuid>`. Resolved against the current origin. */
  path: string;
  text?: string;
}

/**
 * Shares a station, preferring the native sheet and falling back to the
 * clipboard.
 *
 * `navigator.share` rejects with AbortError when the user dismisses the sheet —
 * that is not a failure, so it must not fall through to copying.
 */
export function ShareButton({ title, path, text }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleShare = async () => {
    const url = new URL(path, window.location.origin).toString();

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Dismissing the sheet throws AbortError; only fall through on real errors.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, denied permission) — nothing to do.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition active:scale-[0.97] ${
        copied
          ? "border-accent/60 bg-accent/10 text-accent"
          : "border-line bg-surface-1 text-ink-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
      {copied ? "链接已复制" : "分享"}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M18 16.1c-.8 0-1.5.3-2 .8l-7.1-4.1c.1-.2.1-.5.1-.8s0-.6-.1-.8L16 7.1c.5.5 1.2.8 2 .8a2.9 2.9 0 1 0-2.9-2.9c0 .3 0 .6.1.8L8.1 9.9a2.9 2.9 0 1 0 0 4.2l7.1 4.2c-.1.2-.1.5-.1.7a2.9 2.9 0 1 0 2.9-2.9z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M9.6 17.2 4.4 12l1.4-1.4 3.8 3.8 8.6-8.6L19.6 7z" />
    </svg>
  );
}
