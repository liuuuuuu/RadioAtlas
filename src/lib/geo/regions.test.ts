import { describe, expect, it } from "vitest";
import {
  cityLabel,
  classifyGuangdongCity,
  GUANGDONG_CITIES,
  GUANGDONG_STATE_ALIASES,
  PROVINCE_WIDE_ID,
} from "./regions";

describe("GUANGDONG_STATE_ALIASES", () => {
  it("covers both romanisations but not Kwangsi (Guangxi)", () => {
    expect(GUANGDONG_STATE_ALIASES).toContain("Kwangtung");
    expect(GUANGDONG_STATE_ALIASES).toContain("Guangdong");
    expect(GUANGDONG_STATE_ALIASES as readonly string[]).not.toContain("Kwangsi");
  });
});

describe("classifyGuangdongCity", () => {
  it.each([
    ["广东珠江经济台", PROVINCE_WIDE_ID],
    ["广东新闻广播", PROVINCE_WIDE_ID],
    ["南粤之声", PROVINCE_WIDE_ID],
    ["广州金曲音乐广播", "guangzhou"],
    ["广州市番禺区广播电台", "guangzhou"],
    ["花都人民广播电台", "guangzhou"],
    ["深圳新闻广播", "shenzhen"],
    ["深圳龙岗频道", "shenzhen"],
    ["顺德音乐之声", "foshan"],
    ["佛山南海广播", "foshan"],
    ["鹤山人民广播电台", "jiangmen"],
    ["新会电台", "jiangmen"],
    ["珠海交通875·环保经济广播", "zhuhai"],
    ["怀集音乐之声", "zhaoqing"],
    ["中山综合广播·新锐967", "zhongshan"],
    ["惠州综合广播", "huizhou"],
    ["英德综合广播", "qingyuan"],
    ["兴宁电台", "meizhou"],
    ["澄海电台FM100.5", "shantou"],
    ["普宁人民广播电台", "jieyang"],
    ["潮州戏曲广播", "chaozhou"],
    ["湛江综合广播", "zhanjiang"],
    ["茂名综合广播", "maoming"],
    ["韶关综合广播", "shaoguan"],
    ["河源旅游广播", "heyuan"],
    ["阳江综合广播", "yangjiang"],
    ["云浮综合广播", "yunfu"],
  ])("classifies %s as %s", (name, expected) => {
    expect(classifyGuangdongCity(name)).toBe(expected);
  });

  it("returns null for names with no place hint", () => {
    expect(classifyGuangdongCity("Canton News Radio")).toBeNull();
    expect(classifyGuangdongCity("")).toBeNull();
  });

  it("prefers the more specific place name", () => {
    // "南海" (Foshan) must win over a bare province match.
    expect(classifyGuangdongCity("佛山南海广播")).toBe("foshan");
    // "中山" is a city, not part of a longer unrelated word here.
    expect(classifyGuangdongCity("中山环保旅游之声")).toBe("zhongshan");
  });

  it("only ever returns a known city id", () => {
    const ids = new Set([...GUANGDONG_CITIES.map((city) => city.id), PROVINCE_WIDE_ID]);
    for (const city of GUANGDONG_CITIES) {
      for (const keyword of city.keywords) {
        expect(ids.has(classifyGuangdongCity(`${keyword}广播`) ?? "")).toBe(true);
      }
    }
  });
});

describe("cityLabel", () => {
  it("resolves labels", () => {
    expect(cityLabel("guangzhou")).toBe("广州");
    expect(cityLabel(PROVINCE_WIDE_ID)).toBe("全省");
    expect(cityLabel("nope")).toBe("其他");
  });
});
