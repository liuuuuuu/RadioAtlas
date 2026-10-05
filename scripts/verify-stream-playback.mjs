/**
 * Verifies that a plain-HTTP station actually plays through the relay.
 *
 * Usage (launch + verify + kill in ONE shell command):
 *   chrome --headless=new --remote-debugging-port=9222 \
 *          --autoplay-policy=no-user-gesture-required \
 *          --user-data-dir="$TEMP/chrome-cdp" about:blank &
 *   CHROME_PID=$!; sleep 7
 *   node scripts/verify-stream-playback.mjs 9222 [cardIndex]
 *   kill $CHROME_PID
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PORT = Number(process.argv[2] ?? 9222);
const CARD_INDEX = Number(process.argv[3] ?? 3);
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

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});

await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(12_000);

const SELECT_CARD = `[...document.querySelectorAll('section[aria-label="全球电台探索"] button[aria-pressed]')][${CARD_INDEX}]`;

// The card is usually below the fold; a click outside the viewport hits nothing.
await evaluate(`(() => {
  const card = ${SELECT_CARD};
  if (card) card.scrollIntoView({ block: 'center', behavior: 'instant' });
})()`);
await sleep(800);

const target = await evaluate(`(() => {
  const card = ${SELECT_CARD};
  if (!card) return JSON.stringify({ error: 'card not found' });
  const r = card.getBoundingClientRect();
  return JSON.stringify({
    label: card.getAttribute('aria-label'),
    x: Math.round(r.x + r.width / 2),
    y: Math.round(r.y + r.height / 2),
    inViewport: r.top >= 0 && r.bottom <= innerHeight,
  });
})()`);

console.log("target:", target);
const { x, y } = JSON.parse(target);

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

await sleep(9000);

// The <audio> element is created with `new Audio()` and is deliberately not in
// the document, so inspect the player bar's rendered text instead.
// Note: Guangdong's city chips also carry aria-pressed, so playing station
// cards are identified by their "暂停" label instead.
console.log(
  "player:",
  await evaluate(`JSON.stringify({
    hasRelayChip: document.body.innerText.includes('中转'),
    hasRetryButton: document.body.innerText.includes('重试'),
    playingCards: [...document.querySelectorAll('button[aria-pressed="true"]')]
      .filter((b) => (b.getAttribute('aria-label') || '').startsWith('暂停')).length,
    playerBar: (() => {
      const bar = [...document.querySelectorAll('div')].find((d) => {
        const style = getComputedStyle(d);
        return style.position === 'fixed' && style.bottom === '0px' && d.querySelector('button[aria-label]');
      });
      return bar ? bar.innerText.replace(/\\n/g, ' | ').slice(0, 160) : null;
    })(),
  })`),
);

console.log(
  "relay probe:",
  await evaluate(
    `(async () => {
      const res = await fetch('/api/stations?limit=4');
      const { stations } = await res.json();
      const httpStation = stations.find((s) => (s.url_resolved || s.url || '').startsWith('http://'));
      if (!httpStation) return 'no HTTP station in the first 4 results';
      const stream = await fetch('/api/stream?uuid=' + httpStation.stationuuid);
      return JSON.stringify({
        station: httpStation.name,
        status: stream.status,
        type: stream.headers.get('content-type'),
      });
    })()`,
    true,
  ),
);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(HERE, "player-shot.png"), Buffer.from(shot.data, "base64"));
console.log("screenshot -> scripts/player-shot.png");

socket.close();
