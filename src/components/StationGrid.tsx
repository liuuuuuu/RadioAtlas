"use client";

import { StationCard } from "./StationCard";
import type { Station } from "@/lib/radio-browser/types";

export function StationGrid({ stations }: { stations: Station[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stations.map((station) => (
        <li key={station.stationuuid}>
          <StationCard station={station} />
        </li>
      ))}
    </ul>
  );
}
