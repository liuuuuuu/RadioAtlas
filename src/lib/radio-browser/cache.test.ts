import { describe, expect, it } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  it("stores and returns values", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "1");

    expect(cache.get("a")).toBe("1");
    expect(cache.has("a")).toBe(true);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires an entry once its TTL elapses", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, 10, () => now);

    cache.set("a", "1");
    now = 999;
    expect(cache.get("a")).toBe("1");

    now = 1000;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("honours a per-entry TTL override", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, 10, () => now);

    cache.set("short", "1", 100);
    now = 150;

    expect(cache.get("short")).toBeUndefined();
  });

  it("evicts the oldest entry when maxEntries is exceeded", () => {
    const cache = new TtlCache<number>(1000, 2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("treats a re-set key as the most recently used", () => {
    const cache = new TtlCache<number>(1000, 2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10); // refresh
    cache.set("c", 3);

    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBeUndefined();
  });

  it("clears all entries", () => {
    const cache = new TtlCache<number>();
    cache.set("a", 1);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });
});
