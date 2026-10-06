import { AtlasExplorer } from "@/components/AtlasExplorer";
import { GuangdongSection } from "@/components/GuangdongSection";
import { LibrarySection } from "@/components/LibrarySection";
import { buildMapCountries } from "@/lib/geo/countries";
import { getGuangdongStations, type GuangdongStation } from "@/lib/geo/guangdong";
import type { MapCountry } from "@/lib/geo/types";
import { formatCount } from "@/lib/format";
import { getCountries, getStats, getTopStations } from "@/lib/radio-browser/queries";
import type { Country, RadioStats, Station } from "@/lib/radio-browser/types";

export const revalidate = 300;

export default async function HomePage() {
  const [stations, stats, directory, guangdong] = await Promise.all([
    getTopStations(60).catch((): Station[] => []),
    getStats().catch((): RadioStats | null => null),
    getCountries().catch((): Country[] => []),
    getGuangdongStations().catch((): GuangdongStation[] => []),
  ]);

  const countries: MapCountry[] = buildMapCountries(directory);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-8">
      <SiteHeader stats={stats} />

      {stations.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface-1 p-6 text-sm text-ink-muted">
          暂时无法连接电台目录，请稍后刷新重试。
        </p>
      ) : (
        <AtlasExplorer initialStations={stations} countries={countries}>
          {/* Favourites first for returning visitors; renders nothing when empty. */}
          <LibrarySection />
          <GuangdongSection stations={guangdong} />
        </AtlasExplorer>
      )}
    </main>
  );
}

function SiteHeader({ stats }: { stats: RadioStats | null }) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div className="min-w-[280px]">
          <p className="mb-2.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Radio Atlas
          </p>
          <h1 className="text-[1.9rem] font-semibold leading-tight tracking-tight sm:text-4xl">
            世界电台，一个旋钮
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
            转动地球，点一个国家，即刻收听当地的直播电台。数据来自社区维护的开放电台目录。
          </p>
        </div>

        {stats && (
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="在线电台" value={formatCount(stats.stations)} />
            <Stat label="国家/地区" value={String(stats.countries)} />
            <Stat label="语言" value={String(stats.languages)} />
            <Stat label="流派" value={formatCount(stats.tags)} />
          </dl>
        )}
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-line pl-4 first:border-l-0 first:pl-0">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums leading-none">{value}</dd>
    </div>
  );
}
