# RadioAtlas

**世界电台，一个旋钮。** 从社区维护的开放目录中检索并收听全球直播电台。

> 状态：`v0.1` — 数据层、播放内核与基础界面已打通；**视觉排版与交互细节为下一阶段**。

---

## 1. 这个项目解决什么

全球有数万个免费互联网电台流，但分散、失效率高、缺少统一的检索入口。
RadioAtlas 把它们收敛成一套可筛选、可即点即听、播放不中断的体验。

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
| 状态 | **React Context** | 全局单例播放器，跨路由不中断；避免为此引入状态库 |
| 测试 | **Vitest + Testing Library** | 与 Vite 生态一致，启动快 |
| 部署 | **Vercel**（推荐）/ 任意 Node 运行时 | 路由处理器需要 Node 侧出网 |

### 关键约束：为什么目录请求必须走服务端

1. **User-Agent**：Radio Browser 要求客户端标识自己，而浏览器**无法**通过 `fetch` 设置 `User-Agent`。只有服务端代理能满足。
2. **限速**：2–3 req/s 的软预算，必须集中做缓存，不能让每个用户直连。
3. **缓存**：服务端可做 TTL + `s-maxage`，把热查询压到近乎零上游请求。

### 已知约束（下一阶段处理）

- **混合内容**：大量电台仅有 `http://` 流，在 HTTPS 页面会被浏览器拦截。
  当前策略是暴露「仅 HTTPS」筛选开关 + 卡片上标注 `HTTP` 角标；后续可加**可选流代理**。
- **失效台**：目录中约 11% 的电台已下线。已默认 `hidebroken=true`，播放失败时 UI 明确提示。

---

## 3. 架构与数据流

```
浏览器
  │  1. 页面 SSR
  ▼
Next.js Server Component ──► src/lib/radio-browser/queries.ts
                                    │
                                    ▼
                            src/lib/radio-browser/client.ts
                            （镜像轮询 de1 → nl1 → at1，超时 8s）
                                    │
                                    ▼
                            Radio Browser API  (60k+ 电台)

浏览器
  │  2. 交互检索（筛选/搜索）
  ▼
GET /api/stations ──► TtlCache（5 分钟）──► 命中即返回
                                          └─ 未命中 → 上游 → 回填缓存

浏览器
  │  3. 播放
  ▼
AudioPlayerProvider ──► .m3u8 ? hls.js : <audio src>
                            └─ 成功播放 → POST /api/click（回传点击，best-effort）
```

**镜像容错**：`de1` / `nl1` / `at1` 三台等价镜像依次尝试，任一返回 2xx JSON 即成功；
全部失败才抛 `RadioBrowserError`，并附带每一台的失败原因。

---

## 4. 文件结构

```
.
├── .github/workflows/ci.yml        # typecheck → lint → test → build
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 挂载全局播放器 Provider + PlayerBar
│   │   ├── page.tsx                # SSR 首页：热门电台 + 目录统计
│   │   ├── globals.css             # Tailwind v4 @theme（暗色 token）
│   │   └── api/
│   │       ├── stations/route.ts   # 检索代理 + TTL 缓存 + 参数校验
│   │       ├── countries/route.ts  # 国家列表（按台数降序）
│   │       ├── tags/route.ts       # 流派标签（Top 120）
│   │       └── click/route.ts      # 播放点击回传（POST，best-effort）
│   ├── components/
│   │   ├── player/
│   │   │   ├── AudioPlayerProvider.tsx  # 单例 <audio> + HLS 切换 + 状态机
│   │   │   └── PlayerBar.tsx            # 底部固定播放条
│   │   ├── StationCard.tsx         # 电台卡片（favicon 降级、HLS/HTTP/离线角标）
│   │   ├── StationGrid.tsx         # 响应式网格
│   │   └── StationExplorer.tsx     # 筛选器 + 结果区（客户端）
│   ├── hooks/
│   │   └── useStations.ts          # 检索 hook，带请求中断
│   └── lib/
│       ├── radio-browser/
│       │   ├── types.ts            # Station / Country / Tag / Stats 类型
│       │   ├── client.ts           # 镜像容错、UA、超时、参数映射
│       │   ├── cache.ts            # 通用 TTL 缓存（可注入时钟）
│       │   └── queries.ts          # 读模型：搜索/热门/国家/标签/统计
│       ├── audio/hls-loader.ts     # hls.js 动态加载与原生 HLS 探测
│       └── format.ts               # 展示层格式化与流地址解析
├── vitest.config.mts / vitest.setup.ts
├── next.config.ts / postcss.config.mjs / eslint.config.mjs / tsconfig.json
└── .env.example
```

---

## 5. API 端点

### `GET /api/stations`

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `q` | 电台名称模糊匹配 | — |
| `country` | ISO 3166-1 alpha-2，如 `CN` | — |
| `language` | 语言名 | — |
| `tag` | 流派标签 | — |
| `codec` | `MP3` / `AAC` / `OGG` | — |
| `bitrateMin` | 最低码率 kbps | — |
| `https` | `1` = 仅 HTTPS 流 | — |
| `order` | `clickcount` \| `clicktrend` \| `votes` \| `bitrate` \| `name` \| `random` | `clickcount` |
| `reverse` | `0` 关闭倒序 | `1` |
| `limit` | 1–200 | `60` |
| `offset` | 分页偏移 | `0` |

响应：`{ stations: Station[], total: number, cached: boolean }`，含 `Cache-Control: s-maxage=300`。

### `GET /api/countries` · `GET /api/tags`

返回参考数据，`s-maxage=3600`。

### `POST /api/click?uuid=<stationuuid>`

回传一次播放，保持目录排名可信。始终返回 `204`，失败静默。

---

## 6. 本地运行

```bash
# 1. 环境：Node >= 20.9
node -v

# 2. 安装
npm install

# 3. 配置（可选，但生产环境建议设置）
cp .env.example .env.local

# 4. 开发
npm run dev          # http://localhost:3000

# 5. 构建与生产
npm run build
npm start
```

### 脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` / `start` | 生产构建 / 启动 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint（Next 规则集） |
| `npm run test` | Vitest 单次运行 |
| `npm run test:watch` | Vitest 监听 |
| `npm run verify` | typecheck → lint → test → build 全链路 |

---

## 7. 测试

覆盖**最容易悄悄坏掉**的部分，而不是追求覆盖率数字：

| 文件 | 覆盖内容 |
| --- | --- |
| `client.test.ts` | URL 拼接与空值丢弃、参数 camelCase→snake_case 映射、UA 头、镜像回退（HTTP 错误 / 网络错误）、全失败时抛出带全部尝试记录的 `RadioBrowserError` |
| `cache.test.ts` | 存取、TTL 过期、单条 TTL 覆盖、LRU 淘汰、重复写入刷新新近度、清空 |
| `queries.test.ts` | 搜索默认值（`order=clickcount`/`reverse`/`limit=60`/`hidebroken`）与调用方覆盖 |
| `format.test.ts` | 标签切分与截断、`—` 兜底、数量缩写、流地址解析与 HTTP 不安全判定 |
| `hls-loader.test.ts` | `.m3u8`（含 query/hash、大小写）识别，`.m3u`/`.mp3` 不误判 |

```bash
npm run test
```

---

## 8. 路线图

**v0.2 — 界面与排版（下一步）**
- 首页视觉重做：电台地图 / 世界分区导航
- 电台详情页（`/station/[uuid]`）+ 分享链接
- 收藏与最近播放（localStorage）

**v0.3 — 播放健壮性**
- 可选流代理，解锁 HTTP-only 电台
- 失败自动重试 + 同国家备选台推荐
- MediaSession API（锁屏/耳机控制）

**v0.4 — 内容深度**
- 按地理坐标的「世界地图」浏览
- 定时器 / 睡眠模式
- i18n（zh / en）

---

## 9. 数据来源与致谢

- 电台数据：[Radio Browser](https://www.radio-browser.info/) — 社区维护，免费开放。
  本项目仅做检索与播放，**不重新分发**任何音频流；所有流均由各电台自行提供。
- 若你运营电台或希望下架，请通过 Radio Browser 目录处理，本项目不做本地留存。

## 10. 许可

[MIT](./LICENSE)
