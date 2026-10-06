/**
 * Verifies that favourites and recently-played survive a reload.
 *
 * Usage (launch + verify + kill in ONE shell command):
 *   chrome --headless=new --remote-debugging-port=9222 \
 *          --autoplay-policy=no-user-gesture-required \
 *          --user-data-dir="$TEMP/chrome-cdp" about:blank &
 *   CHROME_PID=$!; sleep 7
 *   node scripts/verify-library.mjs 9222
 *   kill $CHROME_PID
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PORT = Number(process.argv[2] ?? 9222);
const HERE = dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("no page target");

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
  else entry.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve);
  socket.addEventListener("error", reject);
});

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, awaitPromise = false) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "eval failed");
  }
  return result.result.value;
}

async function clickAt(x, y) {
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

/**
 * Scrolls a favourite star into view and returns its centre.
 *
 * Scoped to one section: favouriting a station makes the library section appear
 * above the others, which would shift a document-wide index onto a different
 * (or the same) station.
 */
const SCOPE = 'section[aria-label="全球电台探索"]';
const STARS = `${SCOPE} button[aria-label^="收藏"], ${SCOPE} button[aria-label^="取消收藏"]`;

async function findStar(index) {
  await evaluate(`(() => {
    const star = [...document.querySelectorAll('${STARS}')][${index}];
    if (star) star.scrollIntoView({ block: 'center', behavior: 'instant' });
  })()`);
  await sleep(600);

  return evaluate(`(() => {
    const star = [...document.querySelectorAll('${STARS}')][${index}];
    if (!star) return null;
    const r = star.getBoundingClientRect();
    return JSON.stringify({
      label: star.getAttribute('aria-label'),
      pressed: star.getAttribute('aria-pressed'),
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
    });
  })()`);
}

const READ_STORAGE = `(() => {
  const raw = localStorage.getItem('radioatlas.library.v1');
  if (!raw) return JSON.stringify({ stored: false });
  const parsed = JSON.parse(raw);
  return JSON.stringify({
    stored: true,
    favorites: parsed.favorites.map((f) => f.name),
    recents: parsed.recents.map((r) => r.name),
  });
})()`;

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});

await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(12_000);

console.log("location    :", await evaluate("location.href"));
console.log("storage ok  :", await evaluate("(() => { try { localStorage.getItem('x'); return 'yes'; } catch (e) { return String(e.name); } })()"));
console.log("before      :", await evaluate(READ_STORAGE));

// --- Favourite two stations -------------------------------------------------
const starA = await findStar(0);
if (!starA) throw new Error("no favourite buttons found");
const a = JSON.parse(starA);
console.log(`star #0     : ${a.label} (pressed=${a.pressed})`);
await clickAt(a.x, a.y);
await sleep(600);

const starB = await findStar(2);
const b = JSON.parse(starB);
console.log(`star #2     : ${b.label} (pressed=${b.pressed})`);
if (a.label === b.label) throw new Error("test picked the same station twice");
await clickAt(b.x, b.y);
await sleep(600);

console.log("after stars :", await evaluate(READ_STORAGE));

// --- Play a station so it lands in recents ----------------------------------
const card = await evaluate(`(() => {
  const card = document.querySelector('section[aria-label="全球电台探索"] button[aria-pressed]');
  if (!card) return null;
  card.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = card.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + 40), y: Math.round(r.y + 30) });
})()`);
await sleep(600);
const play = JSON.parse(card);
await clickAt(play.x, play.y);
await sleep(8000);

console.log("after play  :", await evaluate(READ_STORAGE));

// --- Sleep timer (needs the player bar, so before the reload) ---------------
const timer = await evaluate(`(() => {
  const btn = document.querySelector('button[aria-label^="睡眠定时"]');
  if (!btn) return null;
  btn.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = btn.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
})()`);
await sleep(500);

if (!timer) {
  console.log("sleep timer : button not found");
} else {
  const t = JSON.parse(timer);
  await clickAt(t.x, t.y);
  await sleep(600);

  const option = await evaluate(`(() => {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.includes('15'));
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return JSON.stringify({ text: item.textContent.trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`);

  if (!option) {
    console.log("sleep timer : 15-minute option not found");
  } else {
    const o = JSON.parse(option);
    await clickAt(o.x, o.y);
    await sleep(2500);
    console.log(
      "sleep timer :",
      await evaluate(`document.querySelector('button[aria-label^="睡眠定时"]')?.getAttribute('aria-label')`),
    );
  }
}

// --- Reload and confirm it persisted ---------------------------------------
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(11_000);

console.log("after reload:", await evaluate(READ_STORAGE));
console.log(
  "library UI  :",
  await evaluate(`JSON.stringify({
    section: Boolean(document.querySelector('section[aria-label="我的电台"]')),
    tabs: [...document.querySelectorAll('section[aria-label="我的电台"] button[aria-pressed]')]
      .map((b) => b.textContent.trim()),
    starred: document.querySelectorAll('button[aria-label^="取消收藏"]').length,
  })`),
);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(HERE, "library-shot.png"), Buffer.from(shot.data, "base64"));
console.log("screenshot -> scripts/library-shot.png");

socket.close();
