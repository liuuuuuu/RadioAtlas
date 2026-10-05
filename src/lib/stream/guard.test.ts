import { describe, expect, it, vi } from "vitest";

// `node:dns/promises` is interop'd as a CommonJS module, so the mock needs a
// `default` export as well as the named one.
vi.mock("node:dns/promises", () => {
  const lookup = vi.fn(async (hostname: string) => {
    if (hostname === "public.example") return [{ address: "93.184.216.34", family: 4 }];
    if (hostname === "sneaky.example") return [{ address: "10.0.0.5", family: 4 }];
    if (hostname === "split.example") {
      return [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ];
    }
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  });

  return { lookup, default: { lookup } };
});

const { isAbsoluteHttpUrl, isPrivateAddress, isPublicHttpUrl } = await import("./guard");

describe("isPrivateAddress", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "169.254.169.254", // cloud metadata
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "100.64.0.1", // CGNAT
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "172.15.255.255", "2606:4700::1"])(
    "allows %s",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});

describe("isAbsoluteHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(isAbsoluteHttpUrl("http://a.example/x")).toBe(true);
    expect(isAbsoluteHttpUrl("https://a.example/x")).toBe(true);
    expect(isAbsoluteHttpUrl("ftp://a.example/x")).toBe(false);
    expect(isAbsoluteHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isAbsoluteHttpUrl("/relative")).toBe(false);
    expect(isAbsoluteHttpUrl("")).toBe(false);
  });
});

describe("isPublicHttpUrl", () => {
  it("rejects non-http schemes without touching DNS", async () => {
    expect(await isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(await isPublicHttpUrl("gopher://a.example")).toBe(false);
  });

  it("rejects unparseable input", async () => {
    expect(await isPublicHttpUrl("nonsense")).toBe(false);
  });

  it("rejects loopback and metadata addresses given as literals", async () => {
    expect(await isPublicHttpUrl("http://127.0.0.1:8080/admin")).toBe(false);
    expect(await isPublicHttpUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(await isPublicHttpUrl("http://[::1]:9000/")).toBe(false);
  });

  it("rejects local hostnames", async () => {
    expect(await isPublicHttpUrl("http://localhost/x")).toBe(false);
    expect(await isPublicHttpUrl("http://db.internal/x")).toBe(false);
    expect(await isPublicHttpUrl("http://printer.local/x")).toBe(false);
  });

  it("accepts a hostname resolving to a public address", async () => {
    expect(await isPublicHttpUrl("http://public.example/stream.mp3")).toBe(true);
  });

  it("rejects a public-looking hostname that resolves to a private address", async () => {
    expect(await isPublicHttpUrl("http://sneaky.example/x")).toBe(false);
  });

  it("rejects when any resolved address is private", async () => {
    expect(await isPublicHttpUrl("http://split.example/x")).toBe(false);
  });

  it("rejects hosts that do not resolve", async () => {
    expect(await isPublicHttpUrl("http://nowhere.example/x")).toBe(false);
  });
});
