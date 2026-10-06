import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StationDetail } from "@/components/StationDetail";
import { StationGrid } from "@/components/StationGrid";
import { formatBitrate, formatCodec } from "@/lib/format";
import { countryLabel } from "@/lib/geo/countries";
import { getRelatedStations, getStationByUuid } from "@/lib/radio-browser/queries";

export const revalidate = 600;

/** Only well-formed uuids reach the directory — the route is public. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StationPageProps {
  params: Promise<{ uuid: string }>;
}

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
  const { uuid } = await params;
  if (!UUID_PATTERN.test(uuid)) return { title: "电台未找到" };

  const station = await getStationByUuid(uuid).catch(() => null);
  if (!station) return { title: "电台未找到" };

  const place = [station.country, station.state].filter(Boolean).join(" · ");
  const quality = [formatCodec(station.codec), formatBitrate(station.bitrate)]
    .filter((part) => part && part !== "—")
    .join(" ");

  const description = `在线收听 ${station.name}${
    place ? `（${place}）` : ""
  } 的直播电台${quality ? ` · ${quality}` : ""}。`;

  return {
    title: station.name,
    description,
    openGraph: {
      title: station.name,
      description,
      type: "music.radio_station",
    },
  };
}

export default async function StationPage({ params }: StationPageProps) {
  const { uuid } = await params;
  if (!UUID_PATTERN.test(uuid)) notFound();

  const station = await getStationByUuid(uuid).catch(() => null);
  if (!station) notFound();

  const related = await getRelatedStations(station);
  const country = countryLabel(station.countrycode) ?? station.country;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8">
      <Link
        href="/"
        className="mb-7 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
          <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
        </svg>
        返回地图
      </Link>

      <StationDetail station={station} />

      {related.length > 0 && (
        <section className="mt-14" aria-label="相关电台">
          <h2 className="mb-5 text-xl font-semibold tracking-tight sm:text-2xl">
            来自{country}的其他电台
          </h2>
          <StationGrid stations={related} />
        </section>
      )}
    </main>
  );
}
