/**
 * Screenshot a local page over CDP, with a real (non-accelerated) wait so
 * time-based animation lands somewhere predictable.
 *
 * Usage (launch + shoot + kill in one shell command):
 *   chrome --headless=new --remote-debugging-port=9222 --user-data-dir=... about:blank &
 *   CHROME_PID=$!; sleep 7
 *   node scripts/screenshot.mjs 9222 http://localhost:3000/ out.png 1400 12000
 *   kill $CHROME_PID
 *
 * args: <port> <url> <out> [viewportHeight] [waitMs] [scrollY]
 */
import { writeFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 9222);
const URL = process.argv[3] ?? "http://localhost:3000/";
const OUT = process.argv[4] ?? "shot.png";
const HEIGHT = Number(process.argv[5] ?? 1400);
const WAIT = Number(process.argv[6] ?? 12_000);
const SCROLL_Y = Number(process.argv[7] ?? 0);
const WIDTH = Number(process.argv[8] ?? 1440);

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

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: URL });
await sleep(WAIT);

if (SCROLL_Y > 0) {
  await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${SCROLL_Y})` });
  await sleep(1500);
}

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log(`screenshot -> ${OUT} (${WIDTH}x${HEIGHT} @ scrollY=${SCROLL_Y})`);

socket.close();
