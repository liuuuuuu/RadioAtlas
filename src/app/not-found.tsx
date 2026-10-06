import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">这个电台不见了</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        链接可能已失效，或者该电台已从目录中移除。回到地图上另找一个吧。
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-surface-0 transition hover:brightness-110 active:scale-[0.97]"
      >
        返回地图
      </Link>
    </main>
  );
}
