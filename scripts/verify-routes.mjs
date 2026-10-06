/**
 * HTTP smoke test for the public routes.
 *
 * Run against a live server:
 *   npm run dev            # in another shell
 *   node scripts/verify-routes.mjs [baseUrl]
 *
 * Checks status codes and the bits of markup that would break silently —
 * page titles, Open Graph tags for share previews, and the 404 boundary.
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

/** A station that has a favicon, a homepage and related neighbours. */
const KNOWN_UUID = "9617a958-0601-11e8-ae97-52543be04c81";
const MISSING_UUID = "00000000-0000-0000-0000-000000000000";

let failures = 0;

function check(name, condition, detail = "") {
  const mark = condition ? "PASS" : "FAIL";
  if (!condition) failures += 1;
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchText(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: response.status, body: await response.text() };
}

console.log(`RadioAtlas route smoke test against ${BASE}\n`);

// --- Home -------------------------------------------------------------------
console.log("GET /");
{
  const { status, body } = await fetchText("/");
  check("200", status === 200, `got ${status}`);
  check("renders the globe", body.includes("世界电台分布地球仪"));
  check("renders the Guangdong zone", body.includes("广东专区"));
}

// --- Station detail ---------------------------------------------------------
console.log(`\nGET /station/${KNOWN_UUID.slice(0, 8)}…`);
{
  const { status, body } = await fetchText(`/station/${KNOWN_UUID}`);
  check("200", status === 200, `got ${status}`);
  check("title is the station name", /<title>[^<]+· RadioAtlas<\/title>/.test(body));
  check("has an og:title", body.includes('property="og:title"'));
  check("has an og:description", body.includes('property="og:description"'));
  check("declares a radio station", body.includes('content="music.radio_station"'));
  check("shows the fact grid", body.includes("码率") && body.includes("传输"));
  check("offers play / favourite / share", body.includes("播放") && body.includes("分享"));
  check("lists related stations", body.includes("的其他电台"));
  check("links back to the map", body.includes("返回地图"));
}

// --- 404 boundaries ---------------------------------------------------------
console.log("\nGET /station/<malformed>");
{
  const { status } = await fetchText("/station/not-a-uuid");
  check("404", status === 404, `got ${status}`);
}

console.log("\nGET /station/<unknown>");
{
  const { status } = await fetchText(`/station/${MISSING_UUID}`);
  check("404", status === 404, `got ${status}`);
}

console.log("\nGET /no-such-page");
{
  const { status, body } = await fetchText("/no-such-page");
  check("404", status === 404, `got ${status}`);
  check("uses the branded not-found page", body.includes("这个电台不见了"));
}

console.log(
  failures === 0 ? "\nAll route checks passed." : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
