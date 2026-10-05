import { StationExplorer } from "@/components/StationExplorer";
import { getStats, getTopStations } from "@/lib/radio-browser/queries";
import { formatCount } from "@/lib/format";
import type { RadioStats, Station } from "@/lib/radio-browser/types";

export const revalidate = 300;

export default async function HomePage() {
  const [stations, stats] = await Promise.all([
    getTopStations(60).catch((): Station[] => []),
    getStats().catch((): RadioStats | null => null),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10">
      <header className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.28em] text-accent">
          Radio Atlas
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          世界电台，一个旋钮
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          从社区维护的开放电台目录中检索全球直播流，按国家、语言与流派筛选。
          点击任意电台即可试听，切换页面不会中断播放。
        </p>

        {stats && (
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Stat label="在线电台" value={formatCount(stats.stations)} />
            <Stat label="覆盖国家/地区" value={String(stats.countries)} />
            <Stat label="语言" value={String(stats.languages)} />
            <Stat label="流派标签" value={formatCount(stats.tags)} />
          </dl>
        )}
      </header>

      {stations.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface-1 p-6 text-sm text-ink-muted">
          暂时无法连接电台目录，请稍后刷新重试。
        </p>
      ) : (
        <StationExplorer initialStations={stations} />
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
