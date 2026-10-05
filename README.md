# RadioAtlas

**世界电台，一个旋钮。** 转动地球，点一个国家，即刻收听当地的直播电台。

![RadioAtlas 首页](docs/screenshot.png)

> 状态：`v0.3` — 数据层、播放内核、可旋转地球仪、广东专区与交互体系已完成。

---

## 1. 这个项目解决什么

全球有数万个免费互联网电台流，但分散、失效率高、缺少统一的检索入口。
RadioAtlas 把它们收敛成一颗**可以拖着转的地球**：国家按电台密度着色，点开即听；
另设**广东专区**，把珠三角与全省地市电台单独归类。

**数据源**：[Radio Browser](https://www.radio-browser.info/) —— 志愿者维护的开放电台目录。

| 指标 | 实测值（2026-10） |
| --- | --- |
| 在线电台 | 60,228 |
| 覆盖国家/地区 | 241 |
| 语言 | 698 |
| 流派标签 | 12,477 |
| 鉴权 | **无需 API Key** |
| 限速 | 建议 2–3 req/s |

---

## 2. 技术决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 框架 | **Next.js 16（App Router）+ React 19** | 服务端直连目录 API、SEO 友好、路由处理器可承载代理与缓存 |
| 语言 | **TypeScript（strict + `noUncheckedIndexedAccess`）** | 上游 API 字段多且可为空，需要类型兜底 |
| 样式 | **Tailwind CSS v4** | 零配置 `@theme`，暗色优先 |
| 音频 | **hls.js + 原生 `<audio>`** | 实测热门台大量为 `.m3u8`，原生 `<audio>` 除 Safari 外无法播放 |
| 地图 | **自绘 SVG 正交投影地球**（`d3-geo` + `world-atlas`） | 不依赖在线瓦片，暗色完全可控，离线可用 |
| 控件 | **全部自绘**（listbox / switch / range） | 原生 `<select>` 弹层由系统绘制，暗色下对比度失控 |
| 状态 | **React Context** | 全局单例播放器，跨路由不中断 |
| 测试 | **Vitest + CDP 端到端** | 单元测纯逻辑，CDP 测真实鼠标交互 |

### 关键约束一：目录请求必须走服务端

1. **User-Agent**：Radio Browser 要求客户端标识自己，而浏览器**无法**通过 `fetch` 设置 `User-Agent`。只有服务端代理能满足。
2. **限速**：2–3 req/s 的软预算，必须集中做缓存。
3. **缓存**：服务端可做 TTL + `s-maxage`，把热查询压到近乎零上游请求。

### 关键约束二：`has_geo_info` 查询是线性全表扫描

设计地图时踩到的最大坑。同一接口不同行数的耗时：

| 请求行数 | 50 | 120 | 150 | 250 | 600 | 1500 |
| --- | --- | --- | --- | --- | --- | --- |
| 耗时 | 1.7s | 2.9s | 8.2s | 18.7s | 25.9s | **>60s（超时）** |

耗时随行数近似线性增长，**不是**网络问题。因此光点分两层：
**全球层**只取 120 个（~3s），**国家层**选中后按 `countrycode` 取 200 个
（实测 CN 1.5s / DE 2.6s / FR 4.8s / US 6.2s），都用 1 小时缓存，且**永不阻塞**电台列表。

对照：不加 `has_geo_info` 的普通查询很快，但坐标覆盖率极低
（`topclick` 300 条仅 76 条有坐标，`bycountrycodeexact/CN` 300 条仅 7 条）。

### 关键约束三：点击排行被刷量污染

目录的 `clickcount` 计数器可被轻易刷高。实测全球点击排行前 10 名**全是尼日利亚电台**，
票数只有 38–466 却累计了 4000–6000 次点击：

| 排序 | 榜首 | 票数 | 点击 |
| --- | --- | --- | --- |
| `clickcount` | Sports Radio Brila FM (NG) | 219 | 6390 |
| `votes` | MANGORADIO (DE) | 826,695 | 605 |

因此**默认排序用 `votes`**，首页初始列表刻意不走 `/json/stations/topclick`（它就是点击排行）。

### 关键约束四：中国的省份字段不可用

`/json/states/China` 只索引了**澳门和香港**，大陆省份完全缺失。只能靠 `state=` 检索，
而字段值是**威妥玛拼音 + 拼音 + 中文 + 错拼**的大杂烩：

| 值 | 含义 | 条数 |
| --- | --- | --- |
| `Kwangtung` | 广东 | 76 |
| `Guangdong` | 广东 | 6 |
| `Kwangsi` | **广西**（易混） | 27 |
| `Chekiang` / `Zhejiang` | 浙江（两种拼写并存） | 117 / 100 |
| `jilin` / `Jilin` | 吉林（大小写重复） | 34 / 37 |
| `Music` / `Maule` | 垃圾数据 | 2 / 1 |
| （空） | 未标注 | **435** |

广东专区因此合并 `Kwangtung` + `Guangdong` 去重，再按站名归类到 21 个城市。
空 state 的 435 条无法回收 —— 拉取全国需要 54s。

---

## 3. 架构与数据流

```
浏览器
  │  1. 页面 SSR
  ▼
Next.js Server Component ──► src/lib/radio-browser/queries.ts ──► Radio Browser API
  │                            （镜像轮询 de1 → nl1 → at1，超时 8s）
  ├─► src/lib/geo/countries.ts     每国台数 + 中文名（数字 ISO 为键）
  └─► src/lib/geo/guangdong.ts     合并两种拼写 + 城市归类

浏览器
  │  2. 地球仪（客户端）
  ▼
fetch /geo/countries-110m.json  ──► topojson-client ──► 177 条国界
        │
        └─► 每帧：geoOrthographic.rotate() → geoPath() → 直接写 SVG 的 d 属性
            （实测 5.04 ms/帧；绕开 React 协调是能跑满帧率的关键）

浏览器
  │  3. 检索 / 播放
  ▼
GET /api/stations  ──► TtlCache（5 分钟）
GET /api/map       ──► TtlCache（1 小时）
AudioPlayerProvider ──► .m3u8 ? hls.js : <audio src>
                          └─ 成功播放 → POST /api/click（best-effort）
```

### 地球仪为什么每帧重投影

球体一旋转，所有国界的投影就变了，**无法**像平面地图那样预生成静态路径。
所以改成把 TopoJSON（107 KB）下发到浏览器，用 d3-geo 实时投影。

关键实现细节：

- **绕开 React**：每帧只改 177 个 `<path>` 的 `d` 属性和光点的 `cx/cy`，不做 React 协调。
- **背面剔除**：预计算每个国家的角半径，`geoDistance(centroid, centre) > 90° + radius` 时直接置空，
  省掉约 1/4 的投影工作（实测 177 条中通常只画 133–144 条）。
- **拖拽惯性 + 缓动飞行**：指数衰减，帧率无关（`1 - e^(-k·dt)`）。
- **自动旋转**：空闲 4.5s 后缓慢自转，**用户一旦交互就永久停止**，避免持续占用 CPU。

### 一个必须记住的坑：`setPointerCapture` 会吞掉 click

拖拽旋转需要在 `pointerdown` 时 `setPointerCapture`，但这会把整个按压-释放序列
重定向到捕获元素（`<svg>`），于是浏览器把 `click` 派发到 SVG 根节点，**而不是国家路径**。
表现是「点国家没反应」。

解法：在 `pointerdown` 时用 `event.target.closest()` 做命中测试并记下来，
在 `pointerup` 时若未发生拖拽再派发。**不要依赖路径上的 `onClick`。**

> 这个 bug 一开始被掩盖了 —— 早期测试用 `dispatchEvent(new MouseEvent('click'))` 直接派发到路径上，
> 绕过了指针捕获。换成 CDP 真实鼠标事件后才暴露。

---

## 4. 文件结构

```
.
├── .github/workflows/ci.yml        # typecheck → lint → test → build
├── public/geo/countries-110m.json  # TopoJSON 国界（geo:build 生成）
├── scripts/
│   ├── build-geo-data.mjs          # npm run geo:build
│   ├── bench-globe.mjs             # 正交投影每帧耗时基准
│   ├── check-globe-orientation.mjs # 校验 d3 rotate() 约定
│   ├── verify-globe-flow.mjs       # npm run verify:globe（CDP 真实鼠标）
│   └── screenshot.mjs              # CDP 截图
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 全局播放器 Provider + PlayerBar
│   │   ├── page.tsx                # SSR 首页
│   │   ├── globals.css             # @theme + 焦点环 + 地球 SVG 原语
│   │   └── api/
│   │       ├── stations/route.ts   # 检索代理 + TTL 缓存 + 参数校验
│   │       ├── map/route.ts        # 光点（全局 / 按国家两档），下发经纬度
│   │       ├── countries/route.ts  # 国家列表
│   │       ├── tags/route.ts       # 流派标签
│   │       └── click/route.ts      # 播放点击回传
│   ├── components/
│   │   ├── AtlasExplorer.tsx       # 客户端总控：地球 + 筛选 + 全球列表
│   │   ├── GuangdongSection.tsx    # 广东专区（城市 chips）
│   │   ├── map/WorldGlobe.tsx      # 可旋转地球仪
│   │   ├── ui/Select.tsx           # 自绘 listbox（ARIA combobox 模式）
│   │   ├── ui/Toggle.tsx           # 自绘 switch
│   │   ├── player/                 # AudioPlayerProvider + PlayerBar
│   │   ├── StationCard.tsx         # 电台卡片
│   │   └── StationGrid.tsx         # 网格 + 折叠展开
│   ├── hooks/useStations.ts
│   └── lib/
│       ├── radio-browser/          # types / client / cache / queries
│       ├── geo/
│       │   ├── country-meta.json   # 数字 ISO → alpha-2 + 中文名（生成物）
│       │   ├── globe.ts            # 旋转/缩放/动画纯函数
│       │   ├── regions.ts          # 省级别名 + 城市归类
│       │   ├── guangdong.ts        # 广东数据合并
│       │   ├── density.ts          # 密度分档与配色
│       │   ├── countries.ts        # 台数 join
│       │   └── types.ts
│       ├── audio/hls-loader.ts
│       └── format.ts
├── vitest.config.mts / vitest.setup.ts
└── next.config.ts / postcss.config.mjs / eslint.config.mjs / tsconfig.json
```

---

## 5. API 端点

### `GET /api/stations`

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `q` | 电台名称模糊匹配 | — |
| `country` | ISO 3166-1 alpha-2 | — |
| `language` / `tag` / `codec` | 语言 / 流派 / 编码 | — |
| `bitrateMin` | 最低码率 kbps | — |
| `https` | `1` = 仅 HTTPS 流 | — |
| `order` | `votes` \| `clickcount` \| `clicktrend` \| `bitrate` \| `name` \| `random` | `votes` |
| `reverse` | `0` 关闭倒序 | `1` |
| `limit` / `offset` | 1–200 / 分页 | `60` / `0` |

响应：`{ stations, total, cached }`，`Cache-Control: s-maxage=300`。

### `GET /api/map`

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `country` | ISO alpha-2；省略则返回全球稀疏层 | 全局 |
| `limit` | 20–300 | 全局 `120` / 按国 `200` |

响应：`{ markers, scope }`，坐标为**经纬度**（客户端自行投影）。`s-maxage=3600`，上游超时 20s。

### `GET /api/countries` · `GET /api/tags`

参考数据，`s-maxage=3600`。

### `POST /api/click?uuid=<stationuuid>`

回传播放，保持目录排名可信。始终 `204`，失败静默。

---

## 6. 本地运行

```bash
node -v              # 需要 >= 20.9
npm install
cp .env.example .env.local    # 可选，生产建议设置
npm run dev          # http://localhost:3000
```

### 脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` / `build` / `start` | 开发 / 生产构建 / 启动 |
| `npm run geo:build` | 生成 `country-meta.json` 并复制 TopoJSON 到 `public/` |
| `npm run verify:globe` | CDP 驱动真实鼠标，验证拖拽旋转 / 点击国家 / 自动旋转停止 |
| `npm run typecheck` / `lint` / `test` | 类型 / 风格 / 单测 |
| `npm run verify` | typecheck → lint → test → build |

> `geo:build` 依赖 `world-atlas` / `world-countries` / `topojson-client`（devDependencies）。
> 运行时 `topojson-client` 与 `d3-geo` 会打进客户端包（约 46 KB gzip），这是旋转地球的必然代价。

---

## 7. 测试

共 **113** 个用例，覆盖最容易悄悄坏掉的部分：

| 文件 | 覆盖内容 |
| --- | --- |
| `globe.test.ts` | 经度归一化边界（±180/±540）、拖拽方向、缩放平移、跨换日线取短路、缓动插值端点、惯性衰减 |
| `regions.test.ts` | 广东 27 个站名的城市归类、**`Kwangsi` 不得被当成广东**、最长关键词优先、只返回已知城市 |
| `viewport` 相关 | （已随平面地图移除） |
| `client.test.ts` | URL 拼接与空值丢弃、参数映射、UA 头、镜像回退、全失败抛 `RadioBrowserError` |
| `cache.test.ts` | 存取、TTL 过期、单条 TTL、LRU 淘汰、重复写入刷新新近度 |
| `queries.test.ts` | 默认排序必须是 `votes` 且不得走 `topclick` |
| `density.test.ts` | 分档边界值、索引不越界、配色端点 |
| `countries.test.ts` | 三方 join、数字 ISO 补零、空目录兜底 |
| `format.test.ts` | 标签切分、`—` 兜底、数量缩写、流地址解析 |
| `hls-loader.test.ts` | `.m3u8`（含 query/hash、大小写）识别 |

```bash
npm run test
```

### 端到端冒烟

`npm run verify:globe` 用 CDP 派发**真实鼠标事件**（不是合成 click），并断言：

```
initial   : {"paths":177,"drawn":144,"markers":68,...}
after drag: {"paths":177,"drawn":142,"markers":88,"cnD":""}
after idle: {"paths":177,"drawn":142,"markers":88,"cnD":""}
auto-rotate stopped: YES
clicking CA at (571, 266)
selection : {"selected":"CA","chip":"加拿大1.5K 个电台","results":"共 60 个结果","markers":200}
```

需要先 `npm run dev`，且 Chrome 监听 9222 调试端口。

---

## 8. 路线图

**v0.4 — 播放健壮性**
- 可选流代理，解锁 HTTP-only 电台
- 失败自动重试 + 同国家备选台推荐
- MediaSession API（锁屏 / 耳机控制）

**v0.5 — 内容深度**
- 电台详情页（`/station/[uuid]`）+ 分享链接
- 收藏与最近播放（localStorage）
- 更多地区专区（复用 `regions.ts` 的别名表）

**v0.6 — 可达性**
- 地球仪键盘导航（当前依赖筛选栏里的国家下拉作为等价入口）
- i18n（zh / en）

---

## 9. 数据来源与致谢

- 电台数据：[Radio Browser](https://www.radio-browser.info/) — 社区维护，免费开放。
  本项目仅做检索与播放，**不重新分发**任何音频流。
- 国界数据：[world-atlas](https://github.com/topojson/world-atlas)（Natural Earth，公有领域）。
- 国家元数据：[world-countries](https://github.com/mledoze/countries)（ODbL）。
- 交互灵感：[Radio Garden](https://radio.garden/) —— 转动地球听广播的原始创意。

## 10. 许可

[MIT](./LICENSE)
