import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AudioPlayerProvider } from "@/components/player/AudioPlayerProvider";
import { PlayerBar } from "@/components/player/PlayerBar";

export const metadata: Metadata = {
  title: {
    default: "RadioAtlas — 世界电台，一个旋钮",
    template: "%s · RadioAtlas",
  },
  description:
    "Explore and listen to live radio stations from around the world. Powered by the community-run Radio Browser directory.",
  applicationName: "RadioAtlas",
  keywords: ["radio", "internet radio", "live radio", "world radio", "电台", "广播"],
};

export const viewport: Viewport = {
  themeColor: "#080a0e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-surface-0 text-ink antialiased">
        <AudioPlayerProvider>
          {/* Bottom padding keeps content clear of the fixed player bar. */}
          <div className="pb-32">{children}</div>
          <PlayerBar />
        </AudioPlayerProvider>
      </body>
    </html>
  );
}
