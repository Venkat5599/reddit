import * as THREE from 'three';
import type { ImposterInit, ResolveResult, TallyResponse } from '../shared/api';

// ---------- palette ----------
const CREW_COLORS = [0xe15b64, 0x5b8def, 0x57cc99, 0xf4a259, 0xc678dd];
const INK = '#f5f7fa';
const DIM = '#9aa5b1';

// ---------- three.js scene ----------
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const labelsEl = document.getElementById('labels') as HTMLDivElement;
const uiEl = document.getElementById('ui') as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060c);
scene.fog = new THREE.Fog(0x05060c, 10, 22);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 1.7, 9);
camera.lookAt(0, 0.4, 0);

scene.add(new THREE.AmbientLight(0x8899bb, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 8, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x5b8def, 0.8);
rim.position.set(-6, 3, -4);
scene.add(rim);

// starfield
{
  const g = new THREE.BufferGeometry();
  const n = 400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 24;
    pos[i * 3 + 2] = -8 - Math.random() * 18;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x6677aa, size: 0.06 })));
}

// floor disc
{
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.MeshStandardMaterial({ color: 0x11162a, roughness: 0.9, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.1;
  scene.add(floor);
}

type Crew = {
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  phase: number;
  ejecting: boolean;
  ejectT: number;
  bodyMat: THREE.MeshStandardMaterial;
};

function makeCrewmate(color: number): Crew {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.55, 8, 16), bodyMat);
  body.position.y = 0.15;
  group.add(body);

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xbfe3ff,
    roughness: 0.15,
    metalness: 0.4,
    emissive: 0x1b3550,
    emissiveIntensity: 0.5,
  });
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), visorMat);
  visor.scale.set(1, 0.7, 0.55);
  visor.position.set(0, 0.42, 0.42);
  group.add(visor);

  const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 6, 12), bodyMat);
  pack.position.set(0, 0.1, -0.5);
  pack.scale.set(0.7, 1, 0.5);
  group.add(pack);

  const legGeo = new THREE.CapsuleGeometry(0.16, 0.12, 6, 10);
  const l = new THREE.Mesh(legGeo, bodyMat);
  l.position.set(-0.22, -0.55, 0);
  group.add(l);
  const r = new THREE.Mesh(legGeo, bodyMat);
  r.position.set(0.22, -0.55, 0);
  group.add(r);

  return {
    group,
    baseX: 0,
    baseZ: 0,
    phase: Math.random() * 6.28,
    ejecting: false,
    ejectT: 0,
    bodyMat,
  };
}

const crewmates: Crew[] = [];
function layoutCrew(count: number) {
  crewmates.forEach((c) => scene.remove(c.group));
  crewmates.length = 0;
  const span = 2.15;
  const start = -((count - 1) * span) / 2;
  for (let i = 0; i < count; i++) {
    const c = makeCrewmate(CREW_COLORS[i % CREW_COLORS.length]!);
    c.baseX = start + i * span;
    c.baseZ = -Math.abs(c.baseX) * 0.25;
    c.group.position.set(c.baseX, 0, c.baseZ);
    c.group.rotation.y = -c.baseX * 0.06;
    c.group.userData = { seat: i };
    scene.add(c.group);
    crewmates.push(c);
  }
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectable = false;
let hoverSeat = -1;
let onSeatPick: ((seat: number) => void) | null = null;

function seatAtEvent(ev: PointerEvent): number {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(
    crewmates.map((c) => c.group),
    true
  );
  if (hits.length === 0) return -1;
  let o: THREE.Object3D | null = hits[0]!.object;
  while (o && o.userData?.seat === undefined) o = o.parent;
  return o ? (o.userData.seat as number) : -1;
}
canvas.addEventListener('pointermove', (ev) => {
  if (!selectable) return;
  hoverSeat = seatAtEvent(ev);
  canvas.style.cursor = hoverSeat >= 0 ? 'pointer' : 'default';
});
canvas.addEventListener('pointerdown', (ev) => {
  if (!selectable) return;
  const s = seatAtEvent(ev);
  if (s >= 0 && onSeatPick) onSeatPick(s);
});

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();
  const dt = clock.getDelta();
  for (let i = 0; i < crewmates.length; i++) {
    const c = crewmates[i]!;
    if (c.ejecting) {
      c.ejectT += dt;
      const p = Math.min(1, c.ejectT / 1.5);
      c.group.position.y = p * 8;
      c.group.position.x = c.baseX + Math.sin(p * 6) * 0.6;
      c.group.rotation.z += dt * 6;
      c.group.rotation.y += dt * 3;
      const s = Math.max(0.001, 1 - p);
      c.group.scale.setScalar(s);
    } else {
      c.group.position.y = Math.sin(t * 1.4 + c.phase) * 0.08;
      const hovered = selectable && hoverSeat === i;
      const target = hovered ? 1.12 : 1;
      const cur = c.group.scale.x;
      c.group.scale.setScalar(cur + (target - cur) * 0.15);
      c.bodyMat.emissive.setHex(hovered ? 0x333333 : 0x000000);
    }
  }
  updateLabelPositions();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

type Label = { el: HTMLDivElement; seat: number };
let labels: Label[] = [];
const tmpV = new THREE.Vector3();

function setLabels(seats: { name: string; clue: string; isYou: boolean }[], showClues: boolean) {
  labelsEl.innerHTML = '';
  labels = [];
  seats.forEach((s, i) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;transform:translate(-50%,0);text-align:center;font-family:inherit;white-space:nowrap;';
    const clueHtml =
      showClues && s.clue
        ? `<div style="font-size:15px;font-weight:700;color:${INK};background:#141c33;border:1px solid #2a3552;border-radius:8px;padding:3px 9px;margin-bottom:4px">${s.clue}</div>`
        : '';
    el.innerHTML =
      clueHtml +
      `<div style="font-size:12px;color:${s.isYou ? '#ffd166' : DIM}">${s.isYou ? 'YOU' : s.name}</div>`;
    labelsEl.appendChild(el);
    labels.push({ el, seat: i });
  });
}
function updateLabelPositions() {
  if (labels.length === 0) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const lb of labels) {
    const c = crewmates[lb.seat];
    if (!c) continue;
    tmpV.set(c.group.position.x, c.group.position.y + 1.15, c.group.position.z);
    tmpV.project(camera);
    const x = (tmpV.x * 0.5 + 0.5) * w;
    const y = (-tmpV.y * 0.5 + 0.5) * h;
    lb.el.style.left = `${x}px`;
    lb.el.style.top = `${y}px`;
    lb.el.style.opacity = c.ejecting ? '0' : '1';
  }
}

let data: ImposterInit;

async function boot() {
  ui(
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:${DIM}">Loading crew…</div>`
  );
  try {
    const res = await fetch('/api/init');
    if (!res.ok) throw new Error(String(res.status));
    data = (await res.json()) as ImposterInit;
    layoutCrew(data.seats.length);
    if (data.hasPlayed && data.resolved) {
      setLabels(data.seats, true);
      showReveal(data.resolved, true);
    } else {
      phaseRole();
    }
  } catch (e) {
    console.error('init failed', e);
    ui(
      `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:${INK}">Could not load the round. Refresh.</div>`
    );
  }
}

function ui(html: string) {
  uiEl.innerHTML = html;
}
function panel(inner: string, align: 'top' | 'bottom' = 'bottom') {
  const pos = align === 'top' ? 'top:0' : 'bottom:0';
  return `<div style="position:absolute;left:0;right:0;${pos};padding:18px;display:flex;flex-direction:column;align-items:center;gap:12px">${inner}</div>`;
}
const BTN = (id: string, label: string, bg = '#57cc99', fg = '#06210f') =>
  `<button class="ui-btn" id="${id}" style="padding:13px 26px;border:0;border-radius:12px;background:${bg};color:${fg};font-size:17px;font-weight:700">${label}</button>`;

function phaseRole() {
  setLabels(
    data.seats.map((s) => ({ ...s, clue: '' })),
    false
  );
  const isImp = data.role === 'imposter';
  const roleCard = isImp
    ? `<div style="font-size:13px;letter-spacing:3px;color:#e15b64">YOUR ROLE</div>
       <div style="font-size:40px;font-weight:800;color:#e15b64">IMPOSTER 🔪</div>
       <div style="font-size:16px;color:${DIM};max-width:320px;text-align:center">You do NOT know the secret word. Category: <b style="color:${INK}">${data.category}</b>. Blend in — then guess the word to escape.</div>`
    : `<div style="font-size:13px;letter-spacing:3px;color:#57cc99">YOUR ROLE</div>
       <div style="font-size:40px;font-weight:800;color:#57cc99">CREW 🛡️</div>
       <div style="font-size:16px;color:${DIM};text-align:center">Category: <b style="color:${INK}">${data.category}</b></div>
       <div style="font-size:15px;color:${DIM}">The secret word is</div>
       <div style="font-size:34px;font-weight:800;color:${INK}">${data.word}</div>
       <div style="font-size:14px;color:${DIM};max-width:320px;text-align:center">One crewmate doesn't know it. Read the clues and vote them out.</div>`;
  ui(
    `<div style="position:absolute;left:0;right:0;top:0;padding:20px;display:flex;flex-direction:column;align-items:center;gap:8px">${roleCard}</div>` +
      panel(BTN('go', "See everyone's clues →"))
  );
  document.getElementById('go')!.addEventListener('click', phaseClue);
}

function phaseClue() {
  const isImp = data.role === 'imposter';
  ui(
    panel(
      `<div style="font-size:15px;color:${DIM};text-align:center;max-width:320px">${isImp ? 'Bluff a one-word clue so the crew trusts you' : 'Add a one-word clue about the secret word'}</div>
       <input id="clue" maxlength="16" placeholder="one word…" style="pointer-events:auto;padding:12px 16px;border-radius:10px;border:1px solid #2a3552;background:#0b1020;color:#fff;font-size:17px;text-align:center;width:220px"/>
       ${BTN('submit', 'Lock in clue')}`
    )
  );
  const input = document.getElementById('clue') as HTMLInputElement;
  input.focus();
  document.getElementById('submit')!.addEventListener('click', () => {
    const myClue = input.value.trim().split(/\s+/)[0] || (isImp ? '???' : '…');
    const seats = data.seats.map((s) => (s.isYou ? { ...s, clue: myClue } : s));
    data = { ...data, seats };
    phaseBoard();
  });
}

let picked = -1;
function phaseBoard() {
  setLabels(data.seats, true);
  const isImp = data.role === 'imposter';
  if (isImp) {
    const opts = data.wordOptions
      .map(
        (w) =>
          `<button class="ui-btn wopt" data-w="${w}" style="padding:12px 20px;border:2px solid #2a3552;border-radius:10px;background:#111a2e;color:${INK};font-size:16px;font-weight:700">${w}</button>`
      )
      .join('');
    ui(
      panel(
        `<div style="font-size:18px;font-weight:700;color:#e15b64;text-align:center">You're the imposter. Guess the secret word to escape.</div>
         <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:380px">${opts}</div>`
      )
    );
    document.querySelectorAll<HTMLButtonElement>('.wopt').forEach((b) => {
      b.addEventListener('click', () => resolveRound(undefined, b.dataset.w!));
    });
  } else {
    selectable = true;
    onSeatPick = (seat) => {
      if (data.seats[seat]?.isYou) return;
      picked = seat;
      renderAccuse();
    };
    renderAccuse();
  }
  startTimer();
}

function renderAccuse() {
  const name = picked >= 0 ? (data.seats[picked]?.name ?? '') : '';
  ui(
    panel(
      `<div id="timerbar" style="width:200px;height:6px;background:#1a2238;border-radius:3px;overflow:hidden"><div id="timerfill" style="height:100%;width:100%;background:#57cc99"></div></div>
       <div style="font-size:18px;font-weight:700;color:${INK};text-align:center">Who's the imposter? Tap a crewmate 👆</div>
       ${
         picked >= 0
           ? `<div style="font-size:15px;color:${DIM}">Accusing <b style="color:#e15b64">${name}</b></div>${BTN('vote', `Vote out ${name}`, '#e15b64', '#fff')}`
           : `<div style="font-size:14px;color:${DIM}">…or read the clues above first</div>`
       }`
    )
  );
  const v = document.getElementById('vote');
  if (v) v.addEventListener('click', () => resolveRound(picked, undefined));
}

let timerRAF = 0;
let timerStart = 0;
function startTimer() {
  timerStart = performance.now();
  cancelAnimationFrame(timerRAF);
  const tick = () => {
    const el = document.getElementById('timerfill');
    if (!el) return;
    const frac = Math.max(0, 1 - (performance.now() - timerStart) / (data.timerSeconds * 1000));
    el.style.width = `${frac * 100}%`;
    el.style.background = frac < 0.3 ? '#e15b64' : '#57cc99';
    if (frac > 0) timerRAF = requestAnimationFrame(tick);
  };
  timerRAF = requestAnimationFrame(tick);
}

async function resolveRound(accusation: number | undefined, guess: string | undefined) {
  selectable = false;
  onSeatPick = null;
  cancelAnimationFrame(timerRAF);
  ui(panel(`<div style="font-size:18px;color:${DIM}">Ejecting…</div>`));
  try {
    const res = await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accusation, guess }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const result = (await res.json()) as ResolveResult;
    showReveal(result, false);
  } catch (e) {
    console.error('resolve failed', e);
    ui(panel(`<div style="color:#e15b64">Something broke. Refresh.</div>`));
  }
}

function showReveal(r: ResolveResult, instant: boolean) {
  const imp = crewmates[r.imposterSeat];
  if (imp && !instant) {
    imp.ejecting = true;
    imp.ejectT = 0;
  } else if (imp && instant) {
    imp.group.visible = false;
  }
  const won = r.won;
  const title = won ? 'YOU WIN 🎉' : 'YOU LOSE 💀';
  const tColor = won ? '#57cc99' : '#e15b64';
  const sub =
    r.role === 'crew'
      ? won
        ? `You caught <b style="color:#e15b64">${r.imposterName}</b> — the imposter!`
        : `Wrong. The imposter was <b style="color:#e15b64">${r.imposterName}</b>.`
      : won
        ? `You escaped! The word was "<b style="color:${INK}">${r.word}</b>" and you nailed it.`
        : `Caught! The word was "<b style="color:${INK}">${r.word}</b>".`;

  const delay = instant ? 0 : 1200;
  setTimeout(() => {
    ui(
      `<div style="position:absolute;left:0;right:0;top:0;padding:22px;display:flex;flex-direction:column;align-items:center;gap:8px">
         <div style="font-size:42px;font-weight:800;color:${tColor}">${title}</div>
         <div style="font-size:16px;color:${DIM};text-align:center;max-width:340px">${sub}</div>
       </div>` +
        panel(
          `<div style="font-size:15px;color:${INK};text-align:center">🔥 Streak ${r.streak} · 🛡️ ${r.crewWins} crew · 🔪 ${r.imposterWins} imposter</div>
           <div id="live" style="font-size:14px;color:${DIM}">📊 ${r.catchRate}% of players caught the imposter (${r.sampleSize})</div>
           <div style="font-size:14px;color:${DIM}">💬 Argue it out in the comments →</div>`
        )
    );
    void pollTally();
  }, delay);
}

async function pollTally() {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const res = await fetch('/api/tally');
      if (!res.ok) continue;
      const t = (await res.json()) as TallyResponse;
      const el = document.getElementById('live');
      if (el) el.textContent = `📊 ${t.catchRate}% of players caught the imposter (${t.sampleSize})`;
    } catch {
      /* ignore */
    }
  }
}

animate();
void boot();
