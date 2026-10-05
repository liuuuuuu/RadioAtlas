import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard for the stream proxy.
 *
 * The proxy exists so plain-HTTP stations can be played from an HTTPS page.
 * Left unguarded it would be an open relay that can reach anything the server
 * can — including cloud metadata endpoints and internal services. Two layers:
 *
 *   1. Callers must supply a `stationuuid` that exists in the directory, so the
 *      only URLs we ever fetch originate from Radio Browser.
 *   2. Every URL — including the child playlists and segments of an HLS stream,
 *      which legitimately live on other hosts — is checked here.
 */

const BLOCKED_HOSTNAMES = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i;

/** True for loopback, private, link-local, CGNAT, multicast and metadata ranges. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a = -1, b = -1] = parts;
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;

    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (version === 6) {
    const normalized = address.toLowerCase().split("%")[0] ?? "";
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fe80")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    // IPv4-mapped, e.g. ::ffff:127.0.0.1
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true;
}

/**
 * Only http(s) URLs pointing at public hosts are allowed.
 * Hostnames are resolved so that a public-looking name pointing at a private
 * address is still rejected.
 */
export async function isPublicHttpUrl(raw: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || BLOCKED_HOSTNAMES.test(hostname)) return false;

  if (isIP(hostname)) return !isPrivateAddress(hostname);

  try {
    const records = await lookup(hostname, { all: true });
    if (records.length === 0) return false;
    // Reject if *any* resolved address is private — a split answer is not trusted.
    return records.every((record) => !isPrivateAddress(record.address));
  } catch {
    return false;
  }
}

/** Guard for the `u` parameter: must be an absolute http(s) URL. */
export function isAbsoluteHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
