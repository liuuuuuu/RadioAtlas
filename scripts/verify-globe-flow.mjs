/**
 * End-to-end check of the globe: real mouse drags and clicks over CDP.
 *
 * Usage (keep launch + verify + kill in ONE shell command):
 *   chrome --headless=new --remote-debugging-port=9222 \
 *          --user-data-dir="$TEMP/chrome-cdp" about:blank &
 *   CHROME_PID=$!; sleep 7
 *   node scripts/verify-globe-flow.mjs 9222 out.png
 *   kill $CHROME_PID
 */
import { writeFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 9222);
const OUT = process.argv[3] ?? "globe.png";

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

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "eval failed");
  }
  return result.result.value;
}

async function drag(from, to, steps = 10) {
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: from.x,
    y: from.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      button: "left",
      buttons: 1,
    });
    await sleep(16);
  }
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: to.x,
    y: to.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

/** A stable fingerprint of what the globe is currently showing. */
const FINGERPRINT = `(() => {
  const paths = [...document.querySelectorAll('.atlas-country')];
  const drawn = paths.filter((p) => (p.getAttribute('d') || '').length > 0);
  const visibleMarkers = [...document.querySelectorAll('.atlas-marker')]
    .filter((m) => m.getAttribute('opacity') === '1').length;
  const probe = paths.find((p) => p.dataset.iso2 === 'CN');
  return JSON.stringify({
    paths: paths.length,
    drawn: drawn.length,
    markers: visibleMarkers,
    cnD: probe ? (probe.getAttribute('d') || '').slice(0, 40) : null,
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
await sleep(13_000);

console.log("initial   :", await evaluate(FINGERPRINT));

// Drag across the globe — should change what is visible.
await drag({ x: 700, y: 560 }, { x: 380, y: 520 });
await sleep(1200);
const afterDrag = await evaluate(FINGERPRINT);
console.log("after drag:", afterDrag);

// Auto-rotate must stay off once the user has taken control.
await sleep(7000);
const afterIdle = await evaluate(FINGERPRINT);
console.log("after idle:", afterIdle);
console.log(
  `auto-rotate stopped: ${JSON.parse(afterDrag).cnD === JSON.parse(afterIdle).cnD ? "YES" : "NO"}`,
);

// Click whatever country is currently front and centre.
const clickTarget = await evaluate(`(() => {
  const svg = document.querySelector('svg[role="img"]');
  const rect = svg.getBoundingClientRect();
  const candidates = [...document.querySelectorAll('.atlas-country[data-selectable="true"]')]
    .filter((p) => (p.getAttribute('d') || '').length > 200)
    .map((p) => ({ iso2: p.dataset.iso2, box: p.getBoundingClientRect() }))
    .filter((c) => c.box.width > 40 && c.box.height > 30 && c.box.x > rect.x + 80 && c.box.right < rect.right - 80);
  if (!candidates.length) return null;
  const pick = candidates[0];
  return JSON.stringify({ iso2: pick.iso2, x: Math.round(pick.box.x + pick.box.width / 2), y: Math.round(pick.box.y + pick.box.height / 2) });
})()`);

if (clickTarget) {
  const { iso2, x, y } = JSON.parse(clickTarget);
  console.log(`clicking ${iso2} at (${x}, ${y})`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  await sleep(10_000);

  console.log(
    "selection :",
    await evaluate(`JSON.stringify({
      selected: document.querySelector('.atlas-country[data-selected="true"]')?.dataset.iso2 ?? null,
      chip: [...document.querySelectorAll('p')].map((p) => p.textContent).find((t) => t && t.includes('个电台') && t.length < 40) ?? null,
      results: [...document.querySelectorAll('span')].map((s) => s.textContent).find((t) => t && t.startsWith('共 ')) ?? null,
      markers: [...document.querySelectorAll('.atlas-marker')].filter((m) => m.getAttribute('opacity') === '1').length,
    })`),
  );
} else {
  console.log("no clickable country found");
}

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log(`screenshot -> ${OUT}`);

socket.close();
