/**
 * Drives a headless Chrome over CDP to verify the map's select-a-country flow:
 * click a country -> the view zooms to it and the station list re-queries.
 *
 * Usage: node scripts/verify-map-flow.mjs <chrome-debug-port> <iso2> <out.png>
 */
import { writeFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 9222);
const ISO2 = process.argv[3] ?? "CN";
const OUT = process.argv[4] ?? "shot.png";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("no page target found");

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
  width: 1440,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});

await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(14_000); // let SSR, hydration and the marker fetch settle

const before = await send("Runtime.evaluate", {
  expression: `document.querySelectorAll('.atlas-country').length`,
  returnByValue: true,
});
console.log(`country paths rendered: ${before.result.value}`);

const click = await send("Runtime.evaluate", {
  expression: `(() => {
    const el = document.querySelector('.atlas-country[data-iso2="${ISO2}"]');
    if (!el) return 'NOT_FOUND';
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, view: window,
      clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
    }));
    return 'CLICKED';
  })()`,
  returnByValue: true,
});
console.log(`click ${ISO2}: ${click.result.value}`);

await sleep(12_000); // marker fetch for the selected country

const state = await send("Runtime.evaluate", {
  expression: `(() => {
    const selected = document.querySelector('.atlas-country[data-selected="true"]');
    const reset = [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('重置'));
    const resultLine = [...document.querySelectorAll('span')]
      .map(s => s.textContent).find(t => t && t.startsWith('共 '));
    const markers = document.querySelectorAll('.atlas-marker').length;
    return JSON.stringify({
      selectedIso2: selected ? selected.getAttribute('data-iso2') : null,
      zoomLabel: reset ? reset.textContent : null,
      resultLine: resultLine ?? null,
      markers,
    });
  })()`,
  returnByValue: true,
});
console.log(`state: ${state.result.value}`);

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log(`screenshot -> ${OUT}`);

socket.close();
