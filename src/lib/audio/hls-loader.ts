export interface HlsHandle {
  destroy: () => void;
}

/** True for HLS manifests (.m3u8), which <audio> cannot play outside Safari. */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url);
}

/** Safari (and iOS WebViews) can play HLS through the native media element. */
export function canPlayHlsNatively(audio: HTMLAudioElement): boolean {
  return audio.canPlayType("application/vnd.apple.mpegurl") !== "";
}

/**
 * Attach an HLS source to a media element via hls.js.
 *
 * hls.js is imported dynamically: it touches browser globals on import, so a
 * top-level import would break server rendering of client components.
 */
export async function attachHls(
  audio: HTMLAudioElement,
  url: string,
  onFatal?: (message: string) => void,
): Promise<HlsHandle> {
  const { default: Hls } = await import("hls.js");

  if (!Hls.isSupported()) {
    throw new Error("HLS playback is not supported in this browser.");
  }

  return new Promise<HlsHandle>((resolve, reject) => {
    let settled = false;
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      const message = `HLS error: ${data.details}`;
      hls.destroy();

      if (settled) {
        onFatal?.(message);
      } else {
        settled = true;
        reject(new Error(message));
      }
    });

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(url);
      settled = true;
      resolve({ destroy: () => hls.destroy() });
    });

    hls.attachMedia(audio);
  });
}
