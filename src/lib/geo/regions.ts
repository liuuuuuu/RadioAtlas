/**
 * Region helpers for the Guangdong section.
 *
 * The directory's `state` field for China is a mess: Wade-Giles romanisation
 * ("Kwangtung"), Pinyin ("Guangdong"), Chinese, lowercase variants and outright
 * junk ("Music", "Maule") all appear. Worse, `/json/states/China` only indexes
 * Macao and Hong Kong, so provinces can only be reached through `state=` search.
 *
 * Measured on the live directory: Kwangtung 76 + Guangdong 6 = 82 stations,
 * with 435 of China's 2052 stations carrying no state at all.
 */

/** Both spellings that mean 广东. Note Kwangsi is 广西 — a different province. */
export const GUANGDONG_STATE_ALIASES = ["Kwangtung", "Guangdong"] as const;

export interface GuangdongCity {
  id: string;
  label: string;
  /** Place names that identify the city inside a station name. */
  keywords: string[];
}

export const GUANGDONG_CITIES: GuangdongCity[] = [
  { id: "guangzhou", label: "广州", keywords: ["广州", "花都", "番禺", "增城", "从化", "南沙", "羊城"] },
  { id: "shenzhen", label: "深圳", keywords: ["深圳", "龙岗", "宝安", "蛇口", "鹏城"] },
  { id: "foshan", label: "佛山", keywords: ["佛山", "顺德", "南海", "禅城", "三水", "高明"] },
  { id: "jiangmen", label: "江门", keywords: ["江门", "新会", "台山", "开平", "恩平", "鹤山"] },
  { id: "dongguan", label: "东莞", keywords: ["东莞", "虎门"] },
  { id: "zhuhai", label: "珠海", keywords: ["珠海", "横琴", "斗门"] },
  { id: "zhaoqing", label: "肇庆", keywords: ["肇庆", "怀集", "四会", "高要"] },
  { id: "zhongshan", label: "中山", keywords: ["中山"] },
  { id: "huizhou", label: "惠州", keywords: ["惠州", "惠东", "博罗"] },
  { id: "qingyuan", label: "清远", keywords: ["清远", "英德", "连州"] },
  { id: "meizhou", label: "梅州", keywords: ["梅州", "兴宁", "五华"] },
  { id: "shantou", label: "汕头", keywords: ["汕头", "潮阳", "澄海"] },
  { id: "jieyang", label: "揭阳", keywords: ["揭阳", "普宁", "惠来"] },
  { id: "chaozhou", label: "潮州", keywords: ["潮州", "饶平"] },
  { id: "shanwei", label: "汕尾", keywords: ["汕尾", "海丰", "陆丰"] },
  { id: "zhanjiang", label: "湛江", keywords: ["湛江", "雷州", "廉江"] },
  { id: "maoming", label: "茂名", keywords: ["茂名", "高州", "化州", "信宜"] },
  { id: "shaoguan", label: "韶关", keywords: ["韶关", "南雄"] },
  { id: "heyuan", label: "河源", keywords: ["河源", "龙川"] },
  { id: "yangjiang", label: "阳江", keywords: ["阳江", "阳春"] },
  { id: "yunfu", label: "云浮", keywords: ["云浮", "罗定"] },
];

/** Stations that name the province rather than a city ("广东新闻广播"). */
export const PROVINCE_WIDE_ID = "province";

/**
 * Flattened keyword -> city index, longest keyword first, so a specific place
 * name wins over a substring of it.
 */
const KEYWORD_INDEX: Array<{ keyword: string; cityId: string }> = GUANGDONG_CITIES.flatMap(
  (city) => city.keywords.map((keyword) => ({ keyword, cityId: city.id })),
).sort((a, b) => b.keyword.length - a.keyword.length);

/**
 * Best-effort city for a station name.
 * Returns null when nothing matches — callers bucket those as "其他".
 */
export function classifyGuangdongCity(stationName: string): string | null {
  if (!stationName) return null;

  for (const entry of KEYWORD_INDEX) {
    if (stationName.includes(entry.keyword)) return entry.cityId;
  }

  if (stationName.includes("广东") || stationName.includes("南粤")) return PROVINCE_WIDE_ID;

  return null;
}

export function cityLabel(id: string): string {
  if (id === PROVINCE_WIDE_ID) return "全省";
  return GUANGDONG_CITIES.find((city) => city.id === id)?.label ?? "其他";
}
